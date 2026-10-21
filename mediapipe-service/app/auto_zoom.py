"""Auto-zoom decision + landmark reverse-mapping.

Strategy:
  - Sample frames evenly across the clip, run pose on them (IMAGE mode).
  - If the median athlete height is >= MIN_ATHLETE_HEIGHT_PX (150 px), skip zoom.
  - Else build a crop that contains the union of every sampled athlete box plus
    margin (so the whole path stays in frame), capped at MAX_FACTOR (1.75x).
    Resize cropped region back to original (W, H).
  - fill ratio is reported as athlete height / frame height (area against a
    4K frame was ~0.001 for any normal sideline clip).
  - Track padding/crop so landmarks can be reverse-mapped to original coords.
  - Safety-backoff: if mean confidence drops post-zoom vs pre-zoom, undo.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any

import cv2
import numpy as np

from . import framing
from .pose import LANDMARK_COUNT, PoseEngine, PoseFrame


def _resolve_sample_count() -> int:
    """AUTOZOOM_SAMPLE_COUNT env override, clamped to [3, 12]. Default 8."""
    raw = os.environ.get("AUTOZOOM_SAMPLE_COUNT", "8")
    try:
        val = int(raw)
    except (TypeError, ValueError):
        val = 8
    return max(3, min(12, val))


SAMPLE_COUNT = _resolve_sample_count()
MAX_FACTOR = 1.75
# Below this zoom factor, the visual change is small enough that re-probing
# for safety backoff isn't worth the detect cost.
POST_PROBE_MIN_FACTOR = 1.15


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


def _mean_conf(frames: list[PoseFrame]) -> float:
    vals: list[float] = []
    for pf in frames:
        if pf.detected:
            vals.extend(pf.scores)
    if not vals:
        return 0.0
    return float(sum(vals) / len(vals))


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
    # F-POSE-1: probes run on a stateless IMAGE-mode engine so they never seed
    # the main VIDEO pass with a stale tracking ROI. `engine` is unused here.
    with PoseEngine(image_mode=True) as probe:
        return _decide_with_probe(probe, frames, width, height, idxs, state)


def _decide_with_probe(
    engine: PoseEngine,
    frames: list[np.ndarray],
    width: int,
    height: int,
    idxs: list[int],
    state: ZoomState,
) -> tuple[list[np.ndarray], ZoomState]:
    n = len(frames)
    sample_results = [engine.detect(frames[i]) for i in idxs]
    state.mean_conf_before = _mean_conf(sample_results)

    heights = [
        h for h in (framing.athlete_height(pf.keypoints, pf.scores) for pf in sample_results if pf.detected)
        if h is not None
    ]
    med_h = framing.median(heights)
    state.final_fill_ratio = round(med_h / float(height), 4) if med_h else 0.0

    if med_h is None:
        state.applied = False
        state.reason = "no reliable athlete box in probe frames"
        state.mean_conf_after = state.mean_conf_before
        return frames, state

    if med_h >= framing.MIN_ATHLETE_HEIGHT_PX:
        state.applied = False
        state.reason = f"athlete height {med_h:.0f}px >= {framing.MIN_ATHLETE_HEIGHT_PX:.0f}px"
        state.mean_conf_after = state.mean_conf_before
        return frames, state

    boxes = [b for b in (framing.bbox(pf.keypoints, pf.scores) for pf in sample_results if pf.detected) if b]
    crop = framing.path_crop(boxes, med_h, width, height, MAX_FACTOR)
    if crop is None:
        state.applied = False
        state.reason = "athlete path too wide to crop usefully"
        state.mean_conf_after = state.mean_conf_before
        return frames, state

    crop_rect, factor = crop
    x0, y0, cw, ch = crop_rect["x"], crop_rect["y"], crop_rect["w"], crop_rect["h"]
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

    # Skip the post-zoom probe entirely when the visual change is marginal.
    if factor < POST_PROBE_MIN_FACTOR:
        state.mean_conf_after = state.mean_conf_before
    else:
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
    state.reason = (
        f"athlete height {med_h:.0f}px < {framing.MIN_ATHLETE_HEIGHT_PX:.0f}px; path crop {factor:.3f}x"
    )
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
