"""Every-frame detection loop, independent of MediaPipe for regression tests."""
from typing import Protocol, TypeVar

Frame = TypeVar("Frame")
Result = TypeVar("Result", covariant=True)


class FrameEngine(Protocol[Frame, Result]):
    def reserve_timestamp_range(self, n_frames: int, fps: float) -> int: ...
    def detect(self, frame: Frame, timestamp_ms: int) -> Result: ...


def run_every_frame(engine: FrameEngine[Frame, Result], frames: list[Frame], fps: float) -> list[Result]:
    """Keep the original clock and ordering; never skip or forward-fill frames."""
    if fps <= 0:
        fps = 1.0
    frame_interval_ms = max(1, int(round(1000 / fps)))
    base = engine.reserve_timestamp_range(len(frames), fps)
    return [engine.detect(frame, base + index * frame_interval_ms) for index, frame in enumerate(frames)]