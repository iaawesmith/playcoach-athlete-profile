"""Video download (urllib) + streaming cv2.VideoCapture decode at a fixed fps."""
from __future__ import annotations

import os
import tempfile
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from urllib.request import Request, urlopen

import cv2
import numpy as np

from .frame_source import MAX_DECODED_FRAMES, FrameSource, SamplePlan, sample_plan

TARGET_FPS = 30
DOWNLOAD_TIMEOUT_SEC = 120
MAX_VIDEO_BYTES = 200 * 1024 * 1024  # 200 MB hard cap
CHUNK = 1024 * 256


@contextmanager
def download_to_tmp(video_url: str) -> Iterator[str]:
    """Stream-download a video to /tmp and yield the local path. Cleans up on exit."""
    tmp_path = os.path.join(tempfile.gettempdir(), f"mp_{uuid.uuid4().hex}.mp4")
    try:
        req = Request(video_url, headers={"User-Agent": "mediapipe-service/1.0"})
        with urlopen(req, timeout=DOWNLOAD_TIMEOUT_SEC) as resp:
            written = 0
            with open(tmp_path, "wb") as f:
                while True:
                    chunk = resp.read(CHUNK)
                    if not chunk:
                        break
                    written += len(chunk)
                    if written > MAX_VIDEO_BYTES:
                        raise ValueError(
                            f"Video exceeds max size of {MAX_VIDEO_BYTES} bytes"
                        )
                    f.write(chunk)
        yield tmp_path
    finally:
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except OSError:
            pass


class _CvReader:
    def __init__(self, path: str) -> None:
        self._cap = cv2.VideoCapture(path)

    def seek(self, index: int) -> None:
        self._cap.set(cv2.CAP_PROP_POS_FRAMES, index)

    def read(self) -> tuple[bool, np.ndarray | None]:
        return self._cap.read()

    def release(self) -> None:
        self._cap.release()


@dataclass
class WindowInfo:
    width: int
    height: int
    src_fps: float
    clip_duration_s: float | None
    plan: SamplePlan


def open_window(
    path: str,
    start_seconds: float,
    end_seconds: float,
    fps: int = TARGET_FPS,
    frame_cap: int = MAX_DECODED_FRAMES,
) -> tuple[FrameSource | None, WindowInfo]:
    """Streaming replacement for the old eager decode_window: same fixed-fps
    sampling and seek/read sequence, full resolution, capped at frame_cap frames,
    with only a small frame cache held in memory (F-INFRA-1)."""
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        return None, WindowInfo(0, 0, float(fps), None, sample_plan(0, 0, fps, fps, frame_cap))
    try:
        src_fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        if src_fps <= 0 or src_fps != src_fps:  # NaN guard
            src_fps = float(fps)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        n_src = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0.0
        clip_duration = round(n_src / src_fps, 3) if n_src > 0 else None
    finally:
        cap.release()
    plan = sample_plan(start_seconds, end_seconds, src_fps, fps, frame_cap)
    info = WindowInfo(width, height, src_fps, clip_duration, plan)
    if width <= 0 or height <= 0 or not plan.src_indices:
        return None, info
    return FrameSource(lambda: _CvReader(path), plan.src_indices), info
