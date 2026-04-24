"""Video download + ffmpeg trim/decode to BGR frames at a fixed fps."""
from __future__ import annotations

import os
import tempfile
import uuid
from collections.abc import Iterator
from contextlib import contextmanager

import ffmpeg
import httpx
import numpy as np

TARGET_FPS = 30
DOWNLOAD_TIMEOUT_SEC = 120
MAX_VIDEO_BYTES = 200 * 1024 * 1024  # 200 MB hard cap


@contextmanager
def download_to_tmp(video_url: str) -> Iterator[str]:
    """Stream-download a video to /tmp and yield the local path. Cleans up on exit."""
    tmp_path = os.path.join(tempfile.gettempdir(), f"mp_{uuid.uuid4().hex}.mp4")
    try:
        with httpx.stream("GET", video_url, timeout=DOWNLOAD_TIMEOUT_SEC, follow_redirects=True) as r:
            r.raise_for_status()
            written = 0
            with open(tmp_path, "wb") as f:
                for chunk in r.iter_bytes(chunk_size=1024 * 256):
                    if not chunk:
                        continue
                    written += len(chunk)
                    if written > MAX_VIDEO_BYTES:
                        raise ValueError(f"Video exceeds max size of {MAX_VIDEO_BYTES} bytes")
                    f.write(chunk)
        yield tmp_path
    finally:
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except OSError:
            pass


def probe_dimensions(path: str) -> tuple[int, int]:
    """Return (width, height) of the first video stream."""
    info = ffmpeg.probe(path)
    for stream in info.get("streams", []):
        if stream.get("codec_type") == "video":
            return int(stream["width"]), int(stream["height"])
    raise ValueError("No video stream found")


def decode_window(
    path: str,
    start_seconds: float,
    end_seconds: float,
    fps: int = TARGET_FPS,
) -> tuple[list[np.ndarray], int, int]:
    """Decode the [start, end] window to a list of BGR frames at the target fps.

    Returns (frames, width, height).
    """
    width, height = probe_dimensions(path)
    duration = max(0.0, end_seconds - start_seconds)
    if duration <= 0:
        return [], width, height

    out, _ = (
        ffmpeg.input(path, ss=start_seconds, t=duration)
        .filter("fps", fps=fps)
        .output("pipe:", format="rawvideo", pix_fmt="bgr24")
        .run(capture_stdout=True, capture_stderr=True, quiet=True)
    )

    frame_size = width * height * 3
    if frame_size <= 0 or len(out) < frame_size:
        return [], width, height

    n_frames = len(out) // frame_size
    arr = np.frombuffer(out[: n_frames * frame_size], dtype=np.uint8).reshape(
        n_frames, height, width, 3
    )
    # Copy each frame so downstream code can mutate without surprises.
    frames = [arr[i].copy() for i in range(n_frames)]
    return frames, width, height
