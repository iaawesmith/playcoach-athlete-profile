"""Video download (urllib) + cv2.VideoCapture decode at a fixed fps."""
from __future__ import annotations

import os
import tempfile
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from urllib.request import Request, urlopen

import cv2
import numpy as np

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


def decode_window(
    path: str,
    start_seconds: float,
    end_seconds: float,
    fps: int = TARGET_FPS,
) -> tuple[list[np.ndarray], int, int]:
    """Decode the [start, end] window via cv2.VideoCapture, resampled to target fps.

    Returns (frames, width, height).
    """
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        return [], 0, 0

    try:
        src_fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        if src_fps <= 0 or src_fps != src_fps:  # NaN guard
            src_fps = float(fps)

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        if width <= 0 or height <= 0:
            return [], width, height

        duration = max(0.0, end_seconds - start_seconds)
        if duration <= 0:
            return [], width, height

        target_count = int(round(duration * fps))
        if target_count <= 0:
            return [], width, height

        # Sample timestamps in the [start, end] window at the target fps.
        sample_ts = [start_seconds + (i / float(fps)) for i in range(target_count)]
        # Convert to source-frame indices.
        src_indices = [int(round(ts * src_fps)) for ts in sample_ts]

        frames: list[np.ndarray] = []
        last_idx = -1
        for idx in src_indices:
            if idx != last_idx + 1:
                cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ok, frame = cap.read()
            if not ok or frame is None:
                break
            frames.append(frame)
            last_idx = idx

        return frames, width, height
    finally:
        cap.release()
