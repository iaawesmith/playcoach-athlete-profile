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
    """Per-frame pose result in pixel coords of the (possibly cropped) input frame."""
    detected: bool = False
    keypoints: list[list[float]] = field(
        default_factory=lambda: [[0.0, 0.0] for _ in range(LANDMARK_COUNT)]
    )
    scores: list[float] = field(
        default_factory=lambda: [0.0 for _ in range(LANDMARK_COUNT)]
    )


class PoseEngine:
    """MediaPipe PoseLandmarker (VIDEO mode), constructed eagerly."""

    def __init__(self, model_path: str = MODEL_PATH) -> None:
        self.model_path = model_path
        base_options = mp_python.BaseOptions(model_asset_path=model_path)
        options = mp_vision.PoseLandmarkerOptions(
            base_options=base_options,
            running_mode=mp_vision.RunningMode.VIDEO,
            num_poses=1,
            min_pose_detection_confidence=0.5,
            min_pose_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self._landmarker = mp_vision.PoseLandmarker.create_from_options(options)
        # Monotonic timestamp counter for callers that don't supply one
        # (VIDEO mode requires non-decreasing timestamps across detect calls).
        self._next_ts_ms = 0
        self._ts_lock = threading.Lock()

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

        # Defensive padding/truncation to LANDMARK_COUNT
        while len(kps) < LANDMARK_COUNT:
            kps.append([0.0, 0.0])
            scs.append(0.0)
        return PoseFrame(detected=True, keypoints=kps[:LANDMARK_COUNT], scores=scs[:LANDMARK_COUNT])


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
