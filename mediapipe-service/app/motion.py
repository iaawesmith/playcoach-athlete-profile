"""Movement direction + confidence from hip x-trajectory."""
from __future__ import annotations

from typing import Literal

from .pose import PoseFrame

Direction = Literal["left_to_right", "right_to_left", "stationary"]


def estimate(pose_frames: list[PoseFrame], frame_width: int) -> tuple[Direction, float]:
    """Linear-fit hip-center x over time. Returns (direction, confidence 0..1)."""
    xs: list[float] = []
    ts: list[float] = []
    for i, pf in enumerate(pose_frames):
        if not pf.detected:
            continue
        if pf.scores[23] < 0.3 or pf.scores[24] < 0.3:
            continue
        cx = (pf.keypoints[23][0] + pf.keypoints[24][0]) / 2.0
        xs.append(cx)
        ts.append(float(i))

    if len(xs) < 4 or frame_width <= 0:
        return "stationary", 0.0

    n = len(xs)
    mean_t = sum(ts) / n
    mean_x = sum(xs) / n
    num = sum((ts[i] - mean_t) * (xs[i] - mean_x) for i in range(n))
    den = sum((ts[i] - mean_t) ** 2 for i in range(n))
    if den == 0:
        return "stationary", 0.0
    slope_px_per_frame = num / den

    total_dx = slope_px_per_frame * (ts[-1] - ts[0])
    fraction = abs(total_dx) / float(frame_width)

    # Stationary if horizontal travel is < 8% of the frame width.
    if fraction < 0.08:
        return "stationary", round(min(1.0, fraction / 0.08) * 0.5, 3)

    direction: Direction = "left_to_right" if slope_px_per_frame > 0 else "right_to_left"
    confidence = round(min(1.0, fraction / 0.5), 3)
    return direction, confidence
