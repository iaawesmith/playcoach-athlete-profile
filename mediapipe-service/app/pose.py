"""MediaPipe Pose Landmarker (Lite) wrapper. 33 landmarks per frame."""
from __future__ import annotations

from dataclasses import dataclass, field

import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

MODEL_PATH = "/app/models/pose_landmarker_lite.task"
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
    """Context-managed MediaPipe PoseLandmarker (image mode)."""

    def __init__(self, model_path: str = MODEL_PATH) -> None:
        self.model_path = model_path
        self._landmarker: mp_vision.PoseLandmarker | None = None

    def __enter__(self) -> "PoseEngine":
        base_options = mp_python.BaseOptions(model_asset_path=self.model_path)
        options = mp_vision.PoseLandmarkerOptions(
            base_options=base_options,
            running_mode=mp_vision.RunningMode.IMAGE,
            num_poses=1,
            min_pose_detection_confidence=0.5,
            min_pose_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self._landmarker = mp_vision.PoseLandmarker.create_from_options(options)
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if self._landmarker is not None:
            self._landmarker.close()
            self._landmarker = None

    def detect(self, frame_bgr: np.ndarray) -> PoseFrame:
        if self._landmarker is None:
            raise RuntimeError("PoseEngine used outside of context manager")

        h, w = frame_bgr.shape[:2]
        rgb = np.ascontiguousarray(frame_bgr[:, :, ::-1])
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = self._landmarker.detect(mp_image)

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


def run_with_skip(
    engine: PoseEngine, frames: list[np.ndarray], det_frequency: int
) -> list[PoseFrame]:
    """Run pose detection every det_frequency-th frame; forward-fill in between."""
    if det_frequency < 1:
        det_frequency = 1

    results: list[PoseFrame] = []
    last: PoseFrame = PoseFrame(detected=False)
    for i, frame in enumerate(frames):
        if i % det_frequency == 0:
            last = engine.detect(frame)
        results.append(last)
    return results
