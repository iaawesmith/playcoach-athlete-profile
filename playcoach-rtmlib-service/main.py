from __future__ import annotations

from dataclasses import asdict
from typing import Any, Callable, Sequence

import logging

import cv2
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel, Field

from calibration import compute_confidence_weighted_body_calibration
from preprocessing import (
    AutoZoomDecision,
    BoundingBox,
    apply_crop_and_resize,
    as_bbox_detection,
    build_coordinate_transform,
    compute_auto_zoom_crop,
    map_points_to_original_space,
    select_main_athlete_track,
    summarize_log_lines,
)


logger = logging.getLogger('playcoach-rtmlib-service')
app = FastAPI(title='playcoach-rtmlib-service')


class AnalyzeRequest(BaseModel):
    video_url: str
    start_seconds: float = 0.0
    end_seconds: float | None = None
    solution_class: str = 'wholebody'
    performance_mode: str = 'balanced'
    det_frequency: int = 3
    tracking_enabled: bool = True
    auto_zoom_enabled: bool = True


class AnalyzeResponse(BaseModel):
    keypoints: list[list[list[float]]]
    scores: list[list[float]]
    frame_count: int
    fps: float
    progress_updates: list[dict[str, Any]] = Field(default_factory=list)
    auto_zoom_applied: bool = False
    auto_zoom_reason: str | None = None
    auto_zoom_factor: float | None = None
    auto_zoom_original_fill_ratio: float | None = None
    auto_zoom_final_fill_ratio: float | None = None
    auto_zoom_crop_rect: dict[str, int] | None = None
    auto_zoom_padding: dict[str, int] | None = None
    movement_direction: str | None = None
    movement_confidence: float | None = None
    person_detection_confidence: float | None = None
    safety_backoff_applied: bool = False
    coordinate_transform: dict[str, float] | None = None
    athlete_framing_message: str | None = None
    calibration_source: str | None = None
    calibration_details: dict[str, Any] | None = None
    pixels_per_yard: float | None = None


def sample_detection_frames(frames: Sequence[np.ndarray], max_samples: int = 9) -> list[tuple[int, np.ndarray]]:
    if not frames:
        return []
    if len(frames) <= max_samples:
        return list(enumerate(frames))
    sample_indices = np.linspace(0, len(frames) - 1, max_samples, dtype=int)
    return [(int(index), frames[int(index)]) for index in sample_indices]


def extract_candidate_detections(
    sampled_frames: Sequence[tuple[int, np.ndarray]],
    detector: Callable[[np.ndarray], Sequence[dict[str, Any]]],
) -> list[list[BoundingBox]]:
    detections_by_frame: list[list[BoundingBox]] = []
    for frame_index, frame in sampled_frames:
        candidates = []
        for detection in detector(frame):
            box = detection.get('bbox') or detection.get('box') or detection.get('xyxy')
            confidence = float(detection.get('confidence') or detection.get('score') or 0.0)
            label = str(detection.get('label') or detection.get('class') or 'person')
            if not box or label.lower() != 'person':
                continue
            candidates.append(as_bbox_detection(box, confidence, frame_index))
        detections_by_frame.append(candidates)
    return detections_by_frame


def prepare_zoomed_frames(
    frames: Sequence[np.ndarray],
    decision: AutoZoomDecision,
) -> list[np.ndarray]:
    if not decision.enabled or not decision.crop_rect_original:
        return list(frames)
    output_height, output_width = frames[0].shape[:2]
    return [apply_crop_and_resize(frame, decision.crop_rect_original, (output_width, output_height)) for frame in frames]


def enrich_response_metadata(
    base_response: dict[str, Any],
    decision: AutoZoomDecision,
    calibration_result: dict[str, Any],
) -> dict[str, Any]:
    base_response.update(
        {
            'auto_zoom_applied': decision.enabled,
            'auto_zoom_reason': decision.reason,
            'auto_zoom_factor': decision.zoom_factor,
            'auto_zoom_original_fill_ratio': decision.original_person_fill_ratio,
            'auto_zoom_final_fill_ratio': decision.final_fill_ratio,
            'auto_zoom_crop_rect': decision.crop_rect_original,
            'auto_zoom_padding': decision.padding_applied,
            'movement_direction': decision.movement_direction,
            'movement_confidence': decision.movement_confidence,
            'person_detection_confidence': decision.target_person_confidence,
            'safety_backoff_applied': decision.safety_backoff_applied,
            'coordinate_transform': decision.transform,
            'athlete_framing_message': decision.athlete_message,
            'calibration_source': calibration_result.get('source'),
            'calibration_details': calibration_result.get('details'),
            'pixels_per_yard': calibration_result.get('pixels_per_yard'),
        }
    )
    return base_response


def log_auto_zoom(decision: AutoZoomDecision, calibration_result: dict[str, Any]) -> None:
    for line in summarize_log_lines(decision):
        logger.info(line)
    logger.info(
        'Final calibration source: %s — %s px/yard',
        calibration_result.get('source'),
        calibration_result.get('pixels_per_yard'),
    )


def run_autozoom_pipeline(
    frames: Sequence[np.ndarray],
    detector: Callable[[np.ndarray], Sequence[dict[str, Any]]],
) -> tuple[list[np.ndarray], AutoZoomDecision]:
    if not frames:
        raise ValueError('No frames supplied to run_autozoom_pipeline')

    height, width = frames[0].shape[:2]
    detections_by_frame = extract_candidate_detections(sample_detection_frames(frames), detector)
    main_track = select_main_athlete_track(detections_by_frame)
    decision = compute_auto_zoom_crop(main_track, frame_width=width, frame_height=height)
    processed_frames = prepare_zoomed_frames(frames, decision)
    return processed_frames, decision


def remap_results_to_original_space(
    keypoints: Sequence[Sequence[Sequence[float]]],
    decision: AutoZoomDecision,
) -> list[list[list[float]]]:
    transform = build_coordinate_transform(
        decision.crop_rect_original,
        original_size=(1, 1),
        output_size=(1, 1),
    )
    if decision.transform:
        transform = build_coordinate_transform(
            decision.crop_rect_original,
            original_size=(1, 1),
            output_size=(1, 1),
        )
        transform = transform.__class__(
            scale_x=float(decision.transform.get('scale_x', 1.0)),
            scale_y=float(decision.transform.get('scale_y', 1.0)),
            offset_x=float(decision.transform.get('offset_x', 0.0)),
            offset_y=float(decision.transform.get('offset_y', 0.0)),
            applied=bool(decision.transform.get('applied', False)),
        )
    return map_points_to_original_space(keypoints, transform)


def build_progress_updates(decision: AutoZoomDecision) -> list[dict[str, Any]]:
    updates = [
        {'message': 'Sampling detection frames for auto-zoom candidate selection'},
        {'message': 'Computing safe crop window with motion-aware padding'},
    ]
    if decision.enabled:
        updates.append({'message': 'Auto-zoom applied for improved pose visibility'})
    else:
        updates.append({'message': f'Auto-zoom skipped: {decision.reason}'})
    return updates


def analyze_clip_with_existing_backends(
    request: AnalyzeRequest,
    frame_loader: Callable[[AnalyzeRequest], tuple[list[np.ndarray], float]],
    detector: Callable[[np.ndarray], Sequence[dict[str, Any]]],
    pose_runner: Callable[[Sequence[np.ndarray], AnalyzeRequest], tuple[list[list[list[float]]], list[list[float]]]],
) -> dict[str, Any]:
    frames, fps = frame_loader(request)
    if not frames:
        raise ValueError('Frame loader returned zero frames')

    zoomed_frames, decision = run_autozoom_pipeline(frames, detector) if request.auto_zoom_enabled else (list(frames), compute_auto_zoom_crop([], frames[0].shape[1], frames[0].shape[0]))
    zoomed_keypoints, zoomed_scores = pose_runner(zoomed_frames, request)
    original_space_keypoints = remap_results_to_original_space(zoomed_keypoints, decision)
    calibration_result = compute_confidence_weighted_body_calibration(original_space_keypoints, zoomed_scores).to_metadata()
    log_auto_zoom(decision, calibration_result)

    response = {
        'keypoints': original_space_keypoints,
        'scores': [list(frame_scores) for frame_scores in zoomed_scores],
        'frame_count': len(original_space_keypoints),
        'fps': fps,
        'progress_updates': build_progress_updates(decision),
    }
    return enrich_response_metadata(response, decision, calibration_result)


@app.post('/analyze', response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    raise RuntimeError(
        'Wire analyze() to the existing frame loader, rtmlib person detector, and pose runner in the live playcoach-rtmlib-service. '
        'The auto-zoom helpers in this file are ready to drop into that pipeline.'
    )