from __future__ import annotations

from typing import Any, Callable, Sequence

import importlib
import inspect
import logging
import os

import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel, Field

from calibration import compute_confidence_weighted_body_calibration
from preprocessing import (
    AutoZoomDecision,
    BoundingBox,
    CoordinateTransform,
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


FRAME_LOADER_ENV = 'PLAYCOACH_FRAME_LOADER'
PERSON_DETECTOR_ENV = 'PLAYCOACH_PERSON_DETECTOR'
POSE_RUNNER_ENV = 'PLAYCOACH_POSE_RUNNER'
FRAME_LOADER_CANDIDATES = (
    ('service', ('load_frames', 'load_video_frames', 'frame_loader', 'load_frames_for_request')),
    ('pipeline', ('load_frames', 'load_video_frames', 'frame_loader')),
    ('runtime', ('load_frames', 'load_video_frames', 'frame_loader')),
    ('video', ('load_frames', 'load_video_frames')),
)
PERSON_DETECTOR_CANDIDATES = (
    ('service', ('person_detector', 'detect_people', 'detect_persons')),
    ('pipeline', ('person_detector', 'detect_people')),
    ('runtime', ('person_detector', 'detect_people')),
    ('detector', ('person_detector', 'detect_people')),
)
POSE_RUNNER_CANDIDATES = (
    ('service', ('pose_runner', 'run_pose', 'run_pose_inference')),
    ('pipeline', ('pose_runner', 'run_pose', 'run_pose_inference')),
    ('runtime', ('pose_runner', 'run_pose', 'run_pose_inference')),
    ('pose', ('pose_runner', 'run_pose')),
)


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
    transform = CoordinateTransform(
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


def _import_callable(reference: str) -> Callable[..., Any]:
    module_name, _, attr_name = reference.partition(':')
    if not module_name or not attr_name:
        raise ValueError(f'Invalid backend reference: {reference}')
    module = importlib.import_module(module_name)
    candidate = getattr(module, attr_name, None)
    if not callable(candidate):
        raise ValueError(f'Backend reference is not callable: {reference}')
    return candidate


def _resolve_backend_callable(
    label: str,
    env_var: str,
    candidates: Sequence[tuple[str, Sequence[str]]],
) -> Callable[..., Any]:
    reference = os.getenv(env_var)
    if reference:
        return _import_callable(reference)

    for module_name, attr_names in candidates:
        try:
            module = importlib.import_module(module_name)
        except ModuleNotFoundError:
            continue
        for attr_name in attr_names:
            candidate = getattr(module, attr_name, None)
            if callable(candidate):
                return candidate

    raise RuntimeError(
        f'Could not resolve the live {label}. '
        f'Set {env_var}=module:function or expose one of the expected runtime callables.'
    )


def _invoke_with_request_context(func: Callable[..., Any], **context: Any) -> Any:
    signature = inspect.signature(func)
    positional_args: list[Any] = []
    keyword_args: dict[str, Any] = {}

    for parameter in signature.parameters.values():
        if parameter.kind in (inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD):
            continue
        if parameter.name in context:
            if parameter.kind in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD):
                positional_args.append(context[parameter.name])
            else:
                keyword_args[parameter.name] = context[parameter.name]
            continue
        if parameter.default is inspect._empty:
            raise TypeError(f'Missing required argument {parameter.name} for {func.__name__}')

    return func(*positional_args, **keyword_args)


def _to_float_matrix(values: Any) -> list[list[float]]:
    array = np.asarray(values, dtype=float)
    if array.ndim == 0:
        return [[float(array.item())]]
    if array.ndim == 1:
        return [[float(value) for value in array.tolist()]]
    return [[float(value) for value in row] for row in array.tolist()]


def _to_float_tensor(values: Any) -> list[list[list[float]]]:
    array = np.asarray(values, dtype=float)
    if array.ndim == 1:
        return [[[float(value) for value in array.tolist()]]]
    if array.ndim == 2:
        return [[[float(value) for value in row] for row in array.tolist()]]
    return [
        [[float(value) for value in point] for point in frame]
        for frame in array.tolist()
    ]


def _normalize_frame_loader_result(result: Any) -> tuple[list[np.ndarray], float]:
    if isinstance(result, dict):
        frames = result.get('frames')
        fps = result.get('fps')
    elif isinstance(result, tuple) and len(result) >= 2:
        frames, fps = result[0], result[1]
    else:
        raise TypeError('Frame loader must return either (frames, fps) or a dict with frames/fps')

    normalized_frames = [np.asarray(frame) for frame in frames or []]
    return normalized_frames, float(fps or 0.0)


def _normalize_detector_output(result: Any) -> list[dict[str, Any]]:
    if result is None:
        return []
    detections = result if isinstance(result, Sequence) and not isinstance(result, (bytes, str, dict)) else [result]
    normalized: list[dict[str, Any]] = []
    for detection in detections:
        if isinstance(detection, dict):
            candidate = dict(detection)
        elif hasattr(detection, '__dict__'):
            candidate = vars(detection)
        elif isinstance(detection, Sequence) and len(detection) >= 4:
            candidate = {'bbox': list(detection[:4]), 'confidence': float(detection[4]) if len(detection) > 4 else 1.0, 'label': 'person'}
        else:
            continue

        box = candidate.get('bbox') or candidate.get('box') or candidate.get('xyxy')
        if box is None and {'x1', 'y1', 'x2', 'y2'}.issubset(candidate):
            box = [candidate['x1'], candidate['y1'], candidate['x2'], candidate['y2']]
            candidate['bbox'] = box
        candidate.setdefault('confidence', candidate.get('score', 0.0))
        candidate.setdefault('label', candidate.get('class', 'person'))
        normalized.append(candidate)
    return normalized


def _normalize_pose_output(result: Any) -> tuple[list[list[list[float]]], list[list[float]]]:
    keypoints: Any = None
    scores: Any = None

    if isinstance(result, tuple) and len(result) >= 2:
        keypoints, scores = result[0], result[1]
    elif isinstance(result, dict):
        keypoints = result.get('keypoints') or result.get('poses') or result.get('points')
        scores = result.get('scores') or result.get('confidences') or result.get('pose_scores')
    else:
        keypoints = getattr(result, 'keypoints', None)
        scores = getattr(result, 'scores', None)

    if keypoints is None:
        raise TypeError('Pose runner did not return keypoints')

    normalized_keypoints = _to_float_tensor(keypoints)
    if scores is not None:
        normalized_scores = _to_float_matrix(scores)
        return normalized_keypoints, normalized_scores

    derived_scores: list[list[float]] = []
    for frame in normalized_keypoints:
        derived_scores.append([float(point[2]) if len(point) > 2 else 0.0 for point in frame])
    return normalized_keypoints, derived_scores


def _build_frame_loader_adapter(frame_loader_impl: Callable[..., Any]) -> Callable[[AnalyzeRequest], tuple[list[np.ndarray], float]]:
    def frame_loader(request: AnalyzeRequest) -> tuple[list[np.ndarray], float]:
        result = _invoke_with_request_context(
            frame_loader_impl,
            request=request,
            video_url=request.video_url,
            start_seconds=request.start_seconds,
            end_seconds=request.end_seconds,
        )
        return _normalize_frame_loader_result(result)

    return frame_loader


def _build_detector_adapter(detector_impl: Callable[..., Any]) -> Callable[[np.ndarray], Sequence[dict[str, Any]]]:
    def detector(frame: np.ndarray) -> Sequence[dict[str, Any]]:
        result = _invoke_with_request_context(detector_impl, frame=frame, image=frame)
        return _normalize_detector_output(result)

    return detector


def _build_pose_runner_adapter(
    pose_runner_impl: Callable[..., Any],
) -> Callable[[Sequence[np.ndarray], AnalyzeRequest], tuple[list[list[list[float]]], list[list[float]]]]:
    def pose_runner(
        frames: Sequence[np.ndarray],
        request: AnalyzeRequest,
    ) -> tuple[list[list[list[float]]], list[list[float]]]:
        result = _invoke_with_request_context(
            pose_runner_impl,
            frames=list(frames),
            request=request,
            solution_class=request.solution_class,
            performance_mode=request.performance_mode,
            det_frequency=request.det_frequency,
            tracking_enabled=request.tracking_enabled,
            start_seconds=request.start_seconds,
            end_seconds=request.end_seconds,
        )
        return _normalize_pose_output(result)

    return pose_runner


def resolve_live_backends() -> tuple[
    Callable[[AnalyzeRequest], tuple[list[np.ndarray], float]],
    Callable[[np.ndarray], Sequence[dict[str, Any]]],
    Callable[[Sequence[np.ndarray], AnalyzeRequest], tuple[list[list[list[float]]], list[list[float]]]],
]:
    frame_loader_impl = _resolve_backend_callable('frame loader', FRAME_LOADER_ENV, FRAME_LOADER_CANDIDATES)
    detector_impl = _resolve_backend_callable('person detector', PERSON_DETECTOR_ENV, PERSON_DETECTOR_CANDIDATES)
    pose_runner_impl = _resolve_backend_callable('pose runner', POSE_RUNNER_ENV, POSE_RUNNER_CANDIDATES)
    return (
        _build_frame_loader_adapter(frame_loader_impl),
        _build_detector_adapter(detector_impl),
        _build_pose_runner_adapter(pose_runner_impl),
    )


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
    frame_loader, detector, pose_runner = resolve_live_backends()
    result = analyze_clip_with_existing_backends(request, frame_loader, detector, pose_runner)
    return AnalyzeResponse(**result)