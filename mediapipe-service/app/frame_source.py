"""Streaming, re-readable frame source with a frame-count cap.

Holds only a small cache of decoded frames instead of the whole clip
(F-INFRA-1). Every access replays exactly the same seek/read sequence the old
eager decoder used from a freshly opened capture, so the pixels handed to the
model are identical to an eager decode (full resolution, same frames).
No cv2 import here so tests can drive it with a fake reader.
"""
from __future__ import annotations

from collections import OrderedDict
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from typing import Any, Protocol

MAX_DECODED_FRAMES = 300  # 10 s at 30 fps; bounds cost by frames, not seconds
DEFAULT_CACHE_FRAMES = 14  # >= auto-zoom probe count (12 max + 2 tail)


class Reader(Protocol):
    def seek(self, index: int) -> None: ...
    def read(self) -> tuple[bool, Any]: ...
    def release(self) -> None: ...


@dataclass(frozen=True)
class SamplePlan:
    src_indices: list[int]
    requested_frames: int
    frame_cap: int
    frame_cap_reached: bool


def sample_plan(
    start_seconds: float,
    end_seconds: float,
    src_fps: float,
    fps: int,
    frame_cap: int = MAX_DECODED_FRAMES,
) -> SamplePlan:
    """Fixed fps clock from start_seconds, truncated at frame_cap frames."""
    duration = max(0.0, end_seconds - start_seconds)
    requested = int(round(duration * fps)) if duration > 0 else 0
    count = min(requested, frame_cap)
    idx = [int(round((start_seconds + i / float(fps)) * src_fps)) for i in range(count)]
    return SamplePlan(idx, requested, frame_cap, requested > frame_cap)


def achieved_fps(src_indices: list[int], fps: int) -> float:
    """Distinct source frames per second of sampled clip time."""
    if not src_indices:
        return 0.0
    return round(len(set(src_indices)) / (len(src_indices) / float(fps)), 3)


class FrameSource:
    """Sequence-like access to sampled frames. len() is the decoded count."""

    def __init__(
        self,
        open_reader: Callable[[], Reader],
        src_indices: list[int],
        cache_frames: int = DEFAULT_CACHE_FRAMES,
    ) -> None:
        self._open = open_reader
        self._plan = src_indices
        self._cache: OrderedDict[int, Any] = OrderedDict()
        self._cache_max = max(1, cache_frames)
        self._reader: Reader | None = None
        self._cursor = 0  # next plan position the open reader will produce
        self._last_idx = -1
        self.reopens = 0
        self._length = self._count()

    # -- decoding ----------------------------------------------------------
    def _reset(self) -> None:
        if self._reader is not None:
            self._reader.release()
        self._reader = self._open()
        self._cursor = 0
        self._last_idx = -1

    def _step(self) -> Any | None:
        """Replay the eager decoder's operation for plan position _cursor."""
        assert self._reader is not None
        idx = self._plan[self._cursor]
        if idx != self._last_idx + 1:
            self._reader.seek(idx)
        ok, frame = self._reader.read()
        self._cursor += 1
        self._last_idx = idx
        return frame if ok and frame is not None else None

    def _count(self) -> int:
        self._reset()
        n = 0
        while self._cursor < len(self._plan):
            if self._step() is None:
                break
            n += 1
        self.close()
        return n

    def __len__(self) -> int:
        return self._length

    def __getitem__(self, i: int) -> Any:
        if i < 0:
            i += self._length
        if i < 0 or i >= self._length:
            raise IndexError(i)
        if i in self._cache:
            self._cache.move_to_end(i)
            return self._cache[i]
        if self._reader is None or i < self._cursor:
            if self._reader is not None:
                self.reopens += 1
            self._reset()
        frame = None
        while self._cursor <= i:
            frame = self._step()
        self._cache[i] = frame
        if len(self._cache) > self._cache_max:
            self._cache.popitem(last=False)
        return frame

    def __iter__(self) -> Iterator[Any]:
        for i in range(self._length):
            yield self[i]

    def close(self) -> None:
        if self._reader is not None:
            self._reader.release()
            self._reader = None
        self._cache.clear()


class MappedFrames:
    """Lazy per-frame transform (e.g. auto-zoom crop+resize); nothing retained."""

    def __init__(self, base: FrameSource | "MappedFrames", fn: Callable[[Any], Any]) -> None:
        self._base = base
        self._fn = fn

    def __len__(self) -> int:
        return len(self._base)

    def __getitem__(self, i: int) -> Any:
        return self._fn(self._base[i])

    def __iter__(self) -> Iterator[Any]:
        for i in range(len(self)):
            yield self[i]
