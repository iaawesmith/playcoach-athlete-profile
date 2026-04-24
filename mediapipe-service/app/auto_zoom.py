"""Auto-zoom decision + landmark reverse-mapping.

Strategy:
  - Sample 6 frames evenly across the clip, run pose on them.
  - Compute athlete bbox fill ratio (bbox_area / frame_area).
  - If avg fill >= 0.30, skip zoom.
  - Else crop a region centered on the median hip, sized to bring fill ~ 0.45,
    capped at MAX_FACTOR (1.75x). Resize cropped region back to original (W, H).
  - Track padding/crop so landmarks can be reverse-mapped to original coords.
  - Safety-backoff: if mean confidence drops post-zoom vs pre-zoom, undo.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import cv2
import numpy as np

from .pose import LANDMARK_COUNT, PoseEngine, PoseFrame

SAMPLE_COUNT = 6
FILL_THRESHOLD = 0.30
TARGET_FILL = 0.45
MAX_FACTOR = 1.75
MIN_VIS = 0.5
HIP_LEFT = 23
HIP_RIGHT = 24


@dataclass
class ZoomState:
    applied: bool = False
    reason: str | None = None
    factor: float = 1.0
    final_fill_ratio: float = 0.0
    crop_rect: dict[str, int] | None = None  # {x, y, w, h} in original coords
    padding: dict[str, int] | None = None  # {top, bottom, left, right}
    safety_backoff: bool = False
    mean_conf_before: float = 0.0
    mean_conf_after: float = 0.0
    sample_indices: list[int] = field(default_factory=list)


def _sample_indices(n: int, k: int = SAMPLE_COUNT) -> list[int]:
    if n <= 0:
        return []
    if n <= k:
        return list(range(n))
    step = n / float(k)
    return [min(n - 1, int(round(i * step))) for i in range(k)]


def _bbox_fill(pf: PoseFrame, w: int, h: int) -> float:
    if not pf.detected or w <= 0 or h <= 0:
        return 0.0
    xs: list[float] = []
    ys: list[float] = []
    for (x, y), s in zip(pf.keypoints, pf.scores):
        if s >= MIN_VIS:
            xs.append(x)
            ys.append(y)
    if len(xs) < 4:
        return 0.0
    bw = max(0.0, max(xs) - min(xs))
    bh = max(0.0, max(ys) - min(ys))
    return (bw * bh) / float(w * h)


def _mean_conf(frames: list[PoseFrame]) -> float:
    vals: list[float] = []
    for pf in frames:
        if pf.detected:
            vals.extend(pf.scores)
    if not vals:
        return 0.0
    return float(sum(vals) / len(vals))


def _median_hip(frames: list[PoseFrame]) -> tuple[float, float] | None:
    xs: list[float] = []
    ys: list[float] = []
    for pf in frames:
        if not pf.detected:
            continue
        if pf.scores[HIP_LEFT] >= MIN_VIS and pf.scores[HIP_RIGHT] >= MIN_VIS:
            xs.append((pf.keypoints[HIP_LEFT][0] + pf.keypoints[HIP_RIGHT][0]) / 2.0)
            ys.append((pf.keypoints[HIP_LEFT][1] + pf.keypoints[HIP_RIGHT][1]) / 2.0)
    if not xs:
        return None
    xs.sort()
    ys.sort()
    return xs[len(xs) // 2], ys[len(ys) // 2]


def decide_and_apply(
    engine: PoseEngine, frames: list[np.ndarray], width: int, height: int
) -> tuple[list[np.ndarray], ZoomState]:
    """Decide whether to crop+resize each frame. Returns (processed_frames, ZoomState)."""
    state = ZoomState()
    n = len(frames)
    if n == 0 or width <= 0 or height <= 0:
        state.reason = "empty input"
        return frames, state

    idxs = _sample_indices(n, SAMPLE_COUNT)
    state.sample_indices = idxs
    sample_results = [engine.detect(frames[i]) for i in idxs]
    state.mean_conf_before = _mean_conf(sample_results)

    fills = [_bbox_fill(pf, width, height) for pf in sample_results]
    avg_fill = float(sum(fills) / len(fills)) if fills else 0.0
    state.final_fill_ratio = round(avg_fill, 4)

    if avg_fill >= FILL_THRESHOLD:
        state.applied = False
        state.reason = f"fill_ratio {avg_fill:.2f} >= {FILL_THRESHOLD}"
        state.mean_conf_after = state.mean_conf_before
        return frames, state

    hip = _median_hip(sample_results)
    if hip is None:
        state.applied = False
        state.reason = "no reliable hip landmarks for centering"
        state.mean_conf_after = state.mean_conf_before
        return frames, state

    # Compute factor needed to reach TARGET_FILL, capped at MAX_FACTOR.
    if avg_fill <= 0.0:
        factor = MAX_FACTOR
    else:
        factor = min(MAX_FACTOR, (TARGET_FILL / avg_fill) ** 0.5)
    factor = max(1.0, factor)
    if factor <= 1.0:
        state.applied = False
        state.reason = "no zoom needed"
        state.mean_conf_after = state.mean_conf_before
        return frames, state

    # Crop window (in original coords) sized 1/factor of (W, H), centered on hip.
    cw = max(1, int(round(width / factor)))
    ch = max(1, int(round(height / factor)))
    cx, cy = hip
    x0 = int(round(cx - cw / 2.0))
    y0 = int(round(cy - ch / 2.0))
    # Clamp so the crop sits inside the frame.
    x0 = max(0, min(width - cw, x0))
    y0 = max(0, min(height - ch, y0))

    crop_rect = {"x": x0, "y": y0, "w": cw, "h": ch}
    # Padding tells how much was trimmed off each edge of the original frame.
    padding = {
        "top": y0,
        "bottom": height - (y0 + ch),
        "left": x0,
        "right": width - (x0 + cw),
    }

    # Apply crop + resize back to (W, H) so downstream sees same resolution.
    processed: list[np.ndarray] = []
    for f in frames:
        cropped = f[y0 : y0 + ch, x0 : x0 + cw]
        resized = cv2.resize(cropped, (width, height), interpolation=cv2.INTER_LINEAR)
        processed.append(resized)

    # Re-evaluate mean confidence on the same sample indices, post-zoom.
    post_results = [engine.detect(processed[i]) for i in idxs]
    state.mean_conf_after = _mean_conf(post_results)

    # Safety backoff: if confidence drops materially, revert.
    if state.mean_conf_before > 0 and state.mean_conf_after < state.mean_conf_before * 0.85:
        state.applied = False
        state.safety_backoff = True
        state.reason = (
            f"safety backoff: conf {state.mean_conf_before:.2f} -> {state.mean_conf_after:.2f}"
        )
        state.factor = 1.0
        state.crop_rect = None
        state.padding = None
        return frames, state

    state.applied = True
    state.factor = round(factor, 4)
    state.crop_rect = crop_rect
    state.padding = padding
    state.reason = f"fill_ratio {avg_fill:.2f} < {FILL_THRESHOLD}"
    return processed, state


def reverse_map_landmarks(
    pose_results: list[PoseFrame],
    state: ZoomState,
    width: int,
    height: int,
) -> list[PoseFrame]:
    """Map landmark coords from processed (resized-crop) space back to original coords."""
    if not state.applied or state.crop_rect is None:
        return pose_results

    cr = state.crop_rect
    sx = cr["w"] / float(width)
    sy = cr["h"] / float(height)
    ox = cr["x"]
    oy = cr["y"]

    mapped: list[PoseFrame] = []
    for pf in pose_results:
        if not pf.detected:
            mapped.append(pf)
            continue
        new_kps: list[list[float]] = []
        for x, y in pf.keypoints:
            new_kps.append([x * sx + ox, y * sy + oy])
        mapped.append(
            PoseFrame(detected=True, keypoints=new_kps, scores=pf.scores[:])
        )
    return mapped


def to_dict(state: ZoomState) -> dict[str, Any]:
    return {
        "applied": state.applied,
        "reason": state.reason,
        "factor": state.factor,
        "final_fill_ratio": state.final_fill_ratio,
        "crop_rect": state.crop_rect,
        "padding": state.padding,
        "safety_backoff": state.safety_backoff,
        "mean_conf_before": state.mean_conf_before,
        "mean_conf_after": state.mean_conf_after,
    }


__all__ = [
    "LANDMARK_COUNT",
    "MAX_FACTOR",
    "ZoomState",
    "decide_and_apply",
    "reverse_map_landmarks",
    "to_dict",
]
