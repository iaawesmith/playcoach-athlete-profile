"""MediaPipe Pose Landmarker wrapper. Runs every Nth frame, forward-fills the rest."""
from __future__ import annotations

import os
from dataclasses import dataclass

import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

LANDMARK_COUNT = 33
MODEL_PATH = os.environ.get("POSE_MODEL_PATH", "/app/models/pose_landmarker_lite.task")


@dataclass
class PoseFrame:
    """Per-frame pose result. Single-person assumption for v1."""

    keypoints: list[list[float]]  # [33][2] = [x_px, y_px]
    scores: list[float]            # [33]
    detected: bool


def _empty_frame() -> PoseFrame:
    return PoseFrame(
        keypoints=[[0.0, 0.0] for _ in range(LANDMARK_COUNT)],
        scores=[0.0] * LANDMARK_COUNT,
        detected=False,
    )


class PoseEngine:
    """Thin wrapper around MediaPipe Pose Landmarker (Lite)."""

    def __init__(self, model_path: str = MODEL_PATH) -> None:
        base_options = mp_python.BaseOptions(model_asset_path=model_path)
        options = mp_vision.PoseLandmarkerOptions(
            base_options=base_options,
            running_mode=mp_vision.RunningMode.IMAGE,
            num_poses=1,
            min_pose_detection_confidence=0.5,
            min_pose_presence_confidence=0.5,
            min_tracking_confidence=0.5,
            output_segmentation_masks=False,
        )
        self._landmarker = mp_vision.PoseLandmarker.create_from_options(options)

    def close(self) -> None:
        try:
            self._landmarker.close()
        except Exception:
            pass

    def __enter__(self) -> "PoseEngine":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    def detect(self, frame_bgr: np.ndarray) -> PoseFrame:
        """Run pose on a single BGR frame. Returns landmarks in pixel coords."""
        h, w = frame_bgr.shape[:2]
        rgb = frame_bgr[:, :, ::-1].copy()
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = self._landmarker.detect(mp_image)

        if not result.pose_landmarks:
            return _empty_frame()

        landmarks = result.pose_landmarks[0]
        if len(landmarks) < LANDMARK_COUNT:
            return _empty_frame()

        keypoints: list[list[float]] = []
        scores: list[float] = []
        for lm in landmarks[:LANDMARK_COUNT]:
            keypoints.append([float(lm.x) * w, float(lm.y) * h])
            # `visibility` is the canonical confidence-like score for Pose Landmarker.
            scores.append(float(getattr(lm, "visibility", 0.0)))
        return PoseFrame(keypoints=keypoints, scores=scores, detected=True)


def run_with_skip(
    engine: PoseEngine,
    frames: list[np.ndarray],
    det_frequency: int,
) -> list[PoseFrame]:
    """Run pose every Nth frame; forward-fill skipped frames with the last result."""
    if not frames:
        return []
    det_frequency = max(1, det_frequency)
    results: list[PoseFrame] = []
    last: PoseFrame | None = None
    for i, frame in enumerate(frames):
        if i % det_frequency == 0 or last is None:
            last = engine.detect(frame)
            results.append(last)
        else:
            # Forward-fill: copy last detected pose for skipped frames.
            results.append(
                PoseFrame(
                    keypoints=[pt[:] for pt in last.keypoints],
                    scores=last.scores[:],
                    detected=last.detected,
                )
            )
    return results
