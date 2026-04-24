"""FastAPI entrypoint for the MediaPipe pose service."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse

from . import auto_zoom as az
from . import calibration, video
from .pose import LANDMARK_COUNT, get_engine, run_with_skip
from .schema import (
    AnalyzeRequest,
    AnalyzeResponse,
    CropRect,
    Padding,
    ProgressUpdate,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("mediapipe-service")

MAX_WINDOW_SECONDS = 3.0
KEEPALIVE_INTERVAL_S = 10.0


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("warming pose engine")
    _ = get_engine()
    log.info("pose engine warm")
    yield


app = FastAPI(title="mediapipe-service", version="1.0.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "engine": "mediapipe",
        "model": "pose_landmarker_lite",
    }


async def _build_response(req: AnalyzeRequest) -> AnalyzeResponse:
    """Existing analyze body verbatim. Returns AnalyzeResponse or raises HTTPException."""
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

    # Per-stage timers (seconds). Logged in the final structured "analyze done" line.
    t_download = 0.0
    t_decode = 0.0
    t_autozoom = 0.0
    t_pose_loop = 0.0
    t_reverse_map = 0.0
    t_calibration = 0.0

    download_start = time.perf_counter()
    with video.download_to_tmp(req.video_url) as local_path:
        t_download = time.perf_counter() - download_start

        decode_start = time.perf_counter()
        frames, width, height = await asyncio.to_thread(
            video.decode_window,
            local_path,
            req.start_seconds,
            req.end_seconds,
            video.TARGET_FPS,
        )
        t_decode = time.perf_counter() - decode_start
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

        engine = get_engine()

        # 1) Auto-zoom decision.
        autozoom_start = time.perf_counter()
        processed_frames, zoom = await asyncio.to_thread(
            az.decide_and_apply, engine, frames, width, height
        )
        t_autozoom = time.perf_counter() - autozoom_start

        progress.append(
            ProgressUpdate(
                message=f"Auto-zoom: {'applied' if zoom.applied else 'skipped'}",
                frame=total,
                total_frames=total,
                detection_every_n=req.det_frequency,
            )
        )

        # 2) Pose loop on processed frames.
        pose_loop_start = time.perf_counter()
        pose_results = await asyncio.to_thread(
            run_with_skip, engine, processed_frames, req.det_frequency, video.TARGET_FPS
        )
        t_pose_loop = time.perf_counter() - pose_loop_start

        progress.append(
            ProgressUpdate(
                message="Detected pose",
                frame=total,
                total_frames=total,
                detection_every_n=req.det_frequency,
            )
        )

        # 3) Reverse-map landmarks back to original video coords.
        reverse_start = time.perf_counter()
        original_space = az.reverse_map_landmarks(pose_results, zoom, width, height)
        t_reverse_map = time.perf_counter() - reverse_start

        # 4) Body-based calibration.
        calibration_start = time.perf_counter()
        ppy, calib_conf, calib_details = calibration.estimate(original_space)
        t_calibration = time.perf_counter() - calibration_start

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

    total_s = time.time() - t0
    log.info(
        "analyze done frames=%d zoom=%s ppy=%s "
        "download_s=%.2f decode_s=%.2f autozoom_s=%.2f pose_loop_s=%.2f "
        "reverse_map_s=%.2f calibration_s=%.2f total_s=%.2f landmarks=%d",
        len(original_space),
        zoom.applied,
        ppy,
        t_download,
        t_decode,
        t_autozoom,
        t_pose_loop,
        t_reverse_map,
        t_calibration,
        total_s,
        LANDMARK_COUNT,
    )
    return response


@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    """NDJSON streaming wrapper around _build_response.

    Emits a `keepalive` line every KEEPALIVE_INTERVAL_S seconds while the
    pipeline runs, then a single `result` (or `error`) line. The keepalives
    keep the GFE socket alive past its ~30s idle-byte timeout.
    """
    queue: asyncio.Queue = asyncio.Queue()
    SENTINEL = object()

    async def keepalive_loop():
        try:
            while True:
                await asyncio.sleep(KEEPALIVE_INTERVAL_S)
                log.debug("keepalive yield")
                await queue.put({"type": "keepalive", "ts": time.time()})
        except asyncio.CancelledError:
            return

    async def run_pipeline():
        try:
            response = await _build_response(req)
            await queue.put({"type": "result", "data": response.model_dump(mode="json")})
        except HTTPException as e:
            await queue.put({"type": "error", "status": e.status_code, "detail": e.detail})
        except Exception as e:  # noqa: BLE001
            log.exception("analyze pipeline failed")
            await queue.put({"type": "error", "status": 500, "detail": str(e)})
        finally:
            log.info("stream complete")
            await queue.put(SENTINEL)

    async def stream():
        pipeline_task = asyncio.create_task(run_pipeline())
        keepalive_task = asyncio.create_task(keepalive_loop())
        try:
            while True:
                item = await queue.get()
                if item is SENTINEL:
                    break
                yield (json.dumps(item) + "\n").encode()
        finally:
            keepalive_task.cancel()
            if not pipeline_task.done():
                pipeline_task.cancel()
            try:
                await asyncio.gather(pipeline_task, keepalive_task, return_exceptions=True)
            except Exception:
                pass

    return StreamingResponse(stream(), media_type="application/x-ndjson")
