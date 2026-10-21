"""MediaPipe Pose Landmarker wrapper. 33 landmarks per frame.

Module-level singleton: one PoseLandmarker is constructed eagerly on first
`get_engine()` call (typically warmed at FastAPI startup) and reused for the
container's lifetime. Running mode is VIDEO for sequential-frame speed and
landmark stability; callers must pass monotonically non-decreasing
timestamps to `detect()`.

Model selection: defaults to Full (higher Yoga mAP for dynamic motion).
Set POSE_MODEL_PATH=/app/models/pose_landmarker_lite.task to revert without
a rebuild.
"""
from __future__ import annotations

import os
import threading
from dataclasses import dataclass, field

import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

MODEL_PATH = os.getenv("POSE_MODEL_PATH", "/app/models/pose_landmarker_full.task")
LANDMARK_COUNT = 33


@dataclass
class PoseFrame:
    """Per-frame pose result.

    `keypoints` / `scores` are in pixel coords of the (possibly cropped) input
    frame — the long-standing 2D pipeline contract.

    `world_keypoints` are BlazePose GHUM 3D landmarks in **meters**, with the
    **origin at the midpoint of the hips** (see
    `docs/investigations/world-landmark-feasibility-research.md` §2.1). They
    come from the same `PoseLandmarkerResult` as `keypoints` at zero extra
    inference cost. Captured here in PHASE-2A-SLICE-B1; not yet plumbed
    through `AnalyzeResponse` (B2) or consumed by any metric (B3).
    Defaults to a zero-filled 33×3 list when the frame had no detection so
    downstream consumers can assume shape stability.
    """
    detected: bool = False
    keypoints: list[list[float]] = field(
        default_factory=lambda: [[0.0, 0.0] for _ in range(LANDMARK_COUNT)]
    )
    scores: list[float] = field(
        default_factory=lambda: [0.0 for _ in range(LANDMARK_COUNT)]
    )
    world_keypoints: list[list[float]] = field(
        default_factory=lambda: [[0.0, 0.0, 0.0] for _ in range(LANDMARK_COUNT)]
    )


class PoseEngine:
    """MediaPipe PoseLandmarker (VIDEO mode), constructed eagerly."""

    def __init__(
        self,
        model_path: str = MODEL_PATH,
        image_mode: bool = False,
        min_detection_confidence: float = 0.5,
    ) -> None:
        # F-POSE-1: one engine per request (VIDEO) so tracking state and the
        # timestamp clock never leak between requests or from auto-zoom probes.
        # image_mode=True builds a stateless IMAGE-mode landmarker (probes /
        # frame recovery) whose detect() ignores timestamps.
        self.model_path = model_path
        self.image_mode = image_mode
        base_options = mp_python.BaseOptions(model_asset_path=model_path)
        options = mp_vision.PoseLandmarkerOptions(
            base_options=base_options,
            running_mode=mp_vision.RunningMode.IMAGE if image_mode else mp_vision.RunningMode.VIDEO,
            num_poses=1,
            min_pose_detection_confidence=min_detection_confidence,
            min_pose_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self._landmarker = mp_vision.PoseLandmarker.create_from_options(options)
        # Monotonic timestamp counter for callers that don't supply one
        # (VIDEO mode requires non-decreasing timestamps across detect calls).
        self._next_ts_ms = 0
        self._ts_lock = threading.Lock()

    def close(self) -> None:
        landmarker = getattr(self, "_landmarker", None)
        if landmarker is not None:
            landmarker.close()
            self._landmarker = None

    def __enter__(self) -> "PoseEngine":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def reserve_timestamp_range(self, n_frames: int, fps: float) -> int:
        """Atomically reserve a contiguous timestamp range for a batch of frames.

        Returns the base timestamp (ms). Callers should compute per-frame
        timestamps as `base + i * frame_interval_ms`. This guarantees global
        monotonicity across requests on the same landmarker instance, which
        VIDEO mode requires for the entire lifetime of the PoseLandmarker.
        """
        if fps <= 0:
            fps = 1.0
        frame_interval_ms = max(1, int(round(1000 / fps)))
        with self._ts_lock:
            base = self._next_ts_ms
            self._next_ts_ms = base + max(0, n_frames) * frame_interval_ms
        return base

    def detect(self, frame_bgr: np.ndarray, timestamp_ms: int | None = None) -> PoseFrame:
        if timestamp_ms is None:
            with self._ts_lock:
                timestamp_ms = self._next_ts_ms
                self._next_ts_ms += 1
        else:
            # Keep the auto-counter ahead of any externally-supplied timestamp
            # so subsequent default-timestamp calls remain monotonic.
            with self._ts_lock:
                if timestamp_ms >= self._next_ts_ms:
                    self._next_ts_ms = timestamp_ms + 1

        h, w = frame_bgr.shape[:2]
        rgb = np.ascontiguousarray(frame_bgr[:, :, ::-1])
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        if self.image_mode:
            result = self._landmarker.detect(mp_image)
        else:
            result = self._landmarker.detect_for_video(mp_image, timestamp_ms)

        pose_landmarks = result.pose_landmarks
        if not pose_landmarks:
            return PoseFrame(detected=False)

        landmarks = pose_landmarks[0]
        kps: list[list[float]] = []
        scs: list[float] = []
        for lm in landmarks:
            kps.append([float(lm.x) * w, float(lm.y) * h])
            scs.append(float(getattr(lm, "visibility", 0.0)))

        # World landmarks (PHASE-2A-SLICE-B1): meters, hip-centered, from the
        # same PoseLandmarkerResult. Defensive against older mediapipe builds
        # that may omit the attribute or return an empty list.
        wkps: list[list[float]] = []
        world_landmarks_all = getattr(result, "pose_world_landmarks", None) or []
        if world_landmarks_all:
            for lm in world_landmarks_all[0]:
                wkps.append([float(lm.x), float(lm.y), float(lm.z)])

        # Defensive padding/truncation to LANDMARK_COUNT
        while len(kps) < LANDMARK_COUNT:
            kps.append([0.0, 0.0])
            scs.append(0.0)
        while len(wkps) < LANDMARK_COUNT:
            wkps.append([0.0, 0.0, 0.0])
        return PoseFrame(
            detected=True,
            keypoints=kps[:LANDMARK_COUNT],
            scores=scs[:LANDMARK_COUNT],
            world_keypoints=wkps[:LANDMARK_COUNT],
        )


# --- Module-level singleton ---------------------------------------------------

_ENGINE: PoseEngine | None = None
_ENGINE_LOCK = threading.Lock()


def get_engine() -> PoseEngine:
    """Lazily construct and return the process-wide PoseEngine singleton."""
    global _ENGINE
    if _ENGINE is None:
        with _ENGINE_LOCK:
            if _ENGINE is None:
                _ENGINE = PoseEngine()
    return _ENGINE


def run_with_skip(
    engine: PoseEngine,
    frames: list[np.ndarray],
    det_frequency: int,
    fps: float,
) -> list[PoseFrame]:
    """Run pose detection every det_frequency-th frame; forward-fill in between.

    Timestamps passed to MediaPipe are derived from frame index and fps and are
    monotonically non-decreasing across detect calls (required by VIDEO mode).
    """
    if det_frequency < 1:
        det_frequency = 1
    if fps <= 0:
        fps = 1.0

    frame_interval_ms = max(1, int(round(1000 / fps)))
    base = engine.reserve_timestamp_range(len(frames), fps)

    results: list[PoseFrame] = []
    last: PoseFrame = PoseFrame(detected=False)
    for i, frame in enumerate(frames):
        if i % det_frequency == 0:
            timestamp_ms = base + i * frame_interval_ms
            last = engine.detect(frame, timestamp_ms)
        results.append(last)
    return results


RECOVERY_MIN_DETECTION_CONFIDENCE = 0.3


def _detect_on_crop(probe: "PoseEngine", frame: np.ndarray, crop: dict[str, int] | None) -> PoseFrame:
    """Detect on a crop (upscaled to frame size) and map landmarks back to frame coords."""
    if not crop:
        return probe.detect(frame)
    import cv2

    h, w = frame.shape[:2]
    x0, y0, cw, ch = crop["x"], crop["y"], crop["w"], crop["h"]
    resized = cv2.resize(frame[y0:y0 + ch, x0:x0 + cw], (w, h), interpolation=cv2.INTER_LINEAR)
    pf = probe.detect(resized)
    if not pf.detected:
        return pf
    sx, sy = cw / float(w), ch / float(h)
    return PoseFrame(
        detected=True,
        keypoints=[[x * sx + x0, y * sy + y0] for x, y in pf.keypoints],
        scores=pf.scores[:],
        world_keypoints=[row[:] for row in pf.world_keypoints],  # metres, not pixel space
    )


def recover_leading_frames(
    frames: list[np.ndarray],
    results: list[PoseFrame],
    crop: dict[str, int] | None = None,
) -> list[int]:
    """Re-detect the whole leading run of missed frames (frame 0 up to the first
    detection) with a stateless IMAGE-mode landmarker, on the athlete-path crop
    when one is given. `frames`/`results` must be in the same coordinate space;
    recovered landmarks are mapped back to that space. Mutates `results` in place
    and returns the recovered indices."""
    from . import framing

    missing = framing.leading_missed_run([r.detected for r in results])
    if not missing:
        return []
    recovered: list[int] = []
    with PoseEngine(image_mode=True, min_detection_confidence=RECOVERY_MIN_DETECTION_CONFIDENCE) as probe:
        for i in missing:
            pf = _detect_on_crop(probe, frames[i], crop)
            if pf.detected:
                results[i] = pf
                recovered.append(i)
    return recovered


FALLBACK_MIN_DETECTION_CONFIDENCE = 0.3


def fallback_full_frame(
    original_frames: list[np.ndarray],
    processed_results: list[PoseFrame],
    mapped_results: list[PoseFrame],
    width: int,
    height: int,
) -> list[int]:
    """When zoomed, re-detect on the full frame any frame where the athlete is
    lost or touches the crop edge. Uses its own stateless IMAGE-mode engine so
    the main VIDEO tracker's timeline is never disturbed. Mutates
    `mapped_results` (original coords) in place; returns replaced indices."""
    from . import framing

    targets = [
        i for i, pf in enumerate(processed_results)
        if not pf.detected or framing.touches_edge(framing.bbox(pf.keypoints, pf.scores), width, height)
    ]
    if not targets:
        return []
    replaced: list[int] = []
    with PoseEngine(image_mode=True, min_detection_confidence=FALLBACK_MIN_DETECTION_CONFIDENCE) as probe:
        for i in targets:
            pf = probe.detect(original_frames[i])
            if pf.detected:
                mapped_results[i] = pf
                replaced.append(i)
    return replaced


def reject_partial_detections(
    results: list[PoseFrame], width: int, height: int
) -> tuple[dict[int, str], dict[int, dict[str, float | None]]]:
    """Mark cut-off / implausible detections as not detected (zeroed).

    Pass 1: per-frame checks (edge clipping, too few landmarks). Pass 2: height
    and hip vs the median of nearby accepted frames on both sides, iterated so a
    rejected frame never serves as a reference. Returns ({index: reason},
    {index: pre-rejection {height_px, hip_x, hip_y}})."""
    from . import framing

    rejected: dict[int, str] = {}
    details: dict[int, dict[str, float | None]] = {}
    series: list[tuple[float, tuple[float, float] | None] | None] = []

    def snapshot(pf: PoseFrame) -> dict[str, float | None]:
        hip = framing.hip_center(pf.keypoints, pf.scores)
        h = framing.athlete_height(pf.keypoints, pf.scores)
        return {
            "height_px": round(h, 2) if h is not None else None,
            "hip_x": round(hip[0], 2) if hip else None,
            "hip_y": round(hip[1], 2) if hip else None,
        }

    for i, pf in enumerate(results):
        if not pf.detected:
            series.append(None)
            continue
        reason = framing.validate_frame(pf.keypoints, pf.scores, width, height, None, None)
        if reason is not None:
            rejected[i] = reason
            series.append(None)
            continue
        h = framing.athlete_height(pf.keypoints, pf.scores)
        series.append((h, framing.hip_center(pf.keypoints, pf.scores)) if h else None)

    rejected.update(framing.robust_validate(series))
    for i in rejected:
        details[i] = snapshot(results[i])
        results[i] = PoseFrame(detected=False)
    return rejected, details
