"""FastAPI entrypoint for the MediaPipe pose service."""
from __future__ import annotations

import logging
import time

from fastapi import FastAPI, HTTPException

from . import auto_zoom as az
from . import calibration, video
from .pose import LANDMARK_COUNT, PoseEngine, run_with_skip
from .schema import (
    AnalyzeRequest,
    AnalyzeResponse,
    CropRect,
    Padding,
    ProgressUpdate,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("mediapipe-service")

MAX_WINDOW_SECONDS = 30.0

app = FastAPI(title="mediapipe-service", version="1.0.0")


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "engine": "mediapipe",
        "model": "pose_landmarker_lite",
    }


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    t0 = time.time()

    if req.end_seconds <= req.start_seconds:
        raise HTTPException(status_code=400, detail="end_seconds must be > start_seconds")
    window = req.end_seconds - req.start_seconds
    if window > MAX_WINDOW_SECONDS:
        raise HTTPException(
            status_code=400,
            detail=f"clip window must be <= {MAX_WINDOW_SECONDS}s (got {window:.2f}s)",
        )

    log.info(
        "analyze start url=%s window=%.2fs det_frequency=%d perf_mode=%s tracking=%s",
        req.video_url[:80],
        window,
        req.det_frequency,
        req.performance_mode,
        req.tracking_enabled,
    )

    progress: list[ProgressUpdate] = []

    with video.download_to_tmp(req.video_url) as local_path:
        frames, width, height = video.decode_window(
            local_path, req.start_seconds, req.end_seconds, fps=video.TARGET_FPS
        )
        if not frames:
            raise HTTPException(status_code=422, detail="no frames decoded from window")

        total = len(frames)
        progress.append(
            ProgressUpdate(
                message="Decoded video",
                frame=total,
                total_frames=total,
                detection_every_n=req.det_frequency,
            )
        )

        with PoseEngine() as engine:
            # 1) Auto-zoom decision.
            processed_frames, zoom = az.decide_and_apply(engine, frames, width, height)

            progress.append(
                ProgressUpdate(
                    message=f"Auto-zoom: {'applied' if zoom.applied else 'skipped'}",
                    frame=total,
                    total_frames=total,
                    detection_every_n=req.det_frequency,
                )
            )

            # 2) Pose loop on processed frames.
            pose_results = run_with_skip(engine, processed_frames, req.det_frequency)

            progress.append(
                ProgressUpdate(
                    message="Detected pose",
                    frame=total,
                    total_frames=total,
                    detection_every_n=req.det_frequency,
                )
            )

        # 3) Reverse-map landmarks back to original video coords.
        original_space = az.reverse_map_landmarks(pose_results, zoom, width, height)

        # 4) Body-based calibration.
        ppy, calib_conf, calib_details = calibration.estimate(original_space)

    detected_frac = (
        sum(1 for pf in original_space if pf.detected) / max(1, len(original_space))
    )

    keypoints: list[list[list[list[float]]]] = []
    scores: list[list[list[float]]] = []
    for pf in original_space:
        keypoints.append([[pt[:] for pt in pf.keypoints]])
        scores.append([pf.scores[:]])

    response = AnalyzeResponse(
        keypoints=keypoints,
        scores=scores,
        frame_count=len(original_space),
        fps=float(video.TARGET_FPS),
        pixels_per_yard=ppy,
        calibration_source="body_based" if ppy is not None else "none",
        calibration_confidence=calib_conf,  # type: ignore[arg-type]
        calibration_details=calib_details,
        auto_zoom_applied=zoom.applied,
        auto_zoom_reason=zoom.reason,
        auto_zoom_factor=zoom.factor,
        auto_zoom_final_fill_ratio=zoom.final_fill_ratio,
        auto_zoom_crop_rect=CropRect(**zoom.crop_rect) if zoom.crop_rect else None,
        auto_zoom_padding=Padding(**zoom.padding) if zoom.padding else None,
        # Motion is hard-coded in v1 — motion.py removed.
        movement_direction="stationary",
        movement_confidence=0.0,
        person_detection_confidence=round(detected_frac, 3),
        safety_backoff_applied=zoom.safety_backoff,
        athlete_framing_message=(
            None
            if detected_frac > 0.5
            else "Athlete only partially detected — consider reframing the clip."
        ),
        mean_keypoint_confidence_before_auto_zoom=zoom.mean_conf_before,
        mean_keypoint_confidence_after_auto_zoom=zoom.mean_conf_after,
        progress_updates=progress,
    )

    log.info(
        "analyze done frames=%d zoom=%s ppy=%s elapsed=%.2fs landmarks=%d",
        len(original_space),
        zoom.applied,
        ppy,
        time.time() - t0,
        LANDMARK_COUNT,
    )
    return response
