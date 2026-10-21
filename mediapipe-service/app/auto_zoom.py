"""Auto-zoom decision + landmark reverse-mapping.

Strategy:
  - Sample frames evenly across the clip, run pose on them (IMAGE mode).
  - If the median athlete height is >= MIN_ATHLETE_HEIGHT_FRAC (20%) of frame height, skip zoom.
  - Missed probes are retried on an athlete-sized crop around the position
    interpolated from detected probes; trailing gaps are extended to the last frame.
  - zoom = min(MAX_FACTOR, factor fitting the union of probe boxes + one body height).
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
    # Path crop from the probes, kept even when zoom is skipped (leading-frame recovery).
    probe_crop_rect: dict[str, int] | None = None
    # Probe record + path fit (diagnostics), probe-retry crop attempts.
    probes: list[dict[str, Any]] = field(default_factory=list)
    path: dict[str, Any] | None = None
    probe_attempts: list[dict[str, Any]] = field(default_factory=list)
    athlete_height: float | None = None
    # Earliest probed position (frame, hip) — anchor for leading-frame recovery.
    earliest_probe: tuple[int, tuple[float, float]] | None = None


def _sample_indices(n: int, k: int = SAMPLE_COUNT) -> list[int]:
    if n <= 0:
        return []
    if n <= k:
        return list(range(n))
    step = n / float(k)
    idx = {min(n - 1, int(round(i * step))) for i in range(k)}
    # Always sample the end of the route.
    idx.update({n - 1, max(0, n - 2)})
    return sorted(idx)


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

    def summary(pf: PoseFrame) -> tuple[Any, Any, Any]:
        if not pf.detected:
            return None, None, None
        return (
            framing.bbox(pf.keypoints, pf.scores),
            framing.hip_center(pf.keypoints, pf.scores),
            framing.athlete_height(pf.keypoints, pf.scores),
        )

    info = {i: summary(pf) for i, pf in zip(idxs, sample_results)}
    heights = [v[2] for v in info.values() if v[2] is not None]
    med_h = framing.median(heights)
    state.athlete_height = med_h

    # Retry missed probes on an athlete-sized crop around the interpolated position.
    retried: dict[int, dict[str, int]] = {}
    if med_h:
        from .pose import _detect_on_crop
        good = [(i, v[1]) for i, v in sorted(info.items()) if v[1] is not None]
        for i in idxs:
            if info[i][0] is not None and info[i][1] is not None:
                continue
            pred = framing.interpolate_hip(good, i)
            if pred is None:
                continue
            rect = framing.recovery_crop(pred, med_h, width, height, MAX_FACTOR)
            pf = _detect_on_crop(engine, frames[i], rect)
            got = summary(pf)
            ok = got[0] is not None and got[1] is not None and framing.accept_recovery(
                got[2], got[1], pred, med_h, max(1, min((abs(i - g[0]) for g in good), default=1))
            )
            retried[i] = rect
            state.probe_attempts.append({"frame": i, "kind": "probe_retry", "crop": rect, "recovered": ok})
            if ok:
                info[i] = got
        heights = [v[2] for v in info.values() if v[2] is not None]
        med_h = framing.median(heights)
        state.athlete_height = med_h

    for i in idxs:
        b, hip, h = info[i]
        state.probes.append({
            "frame": i,
            "detected": b is not None,
            "retried": i in retried,
            "retry_crop": retried.get(i),
            "box": [round(v, 1) for v in b] if b else None,
            "hip": [round(v, 1) for v in hip] if hip else None,
            "height_px": round(h, 1) if h else None,
        })
    first = next(((i, v[1]) for i, v in sorted(info.items()) if v[1] is not None), None)
    state.earliest_probe = first

    state.final_fill_ratio = round(med_h / float(height), 4) if med_h else 0.0
    if med_h is None:
        state.applied = False
        state.reason = "no reliable athlete box in probe frames"
        state.mean_conf_after = state.mean_conf_before
        return frames, state

    boxes = [v[0] for v in info.values() if v[0] is not None]
    # Trailing probes still missing: extend the path along the measured motion.
    hips_t = [(i, v[1]) for i, v in sorted(info.items()) if v[1] is not None]
    extended_to = None
    if hips_t and hips_t[-1][0] < n - 1:
        end = framing.predict_hip(hips_t, n - 1)
        if end is not None:
            ex = max(0.0, min(float(width), end[0]))
            ey = max(0.0, min(float(height), end[1]))
            boxes.append((ex - med_h * 0.3, ey - med_h * 0.55, ex + med_h * 0.3, ey + med_h * 0.45))
            extended_to = [round(ex, 1), round(ey, 1)]
    union = framing.union_box(boxes)
    fit = framing.fit_factor(union, med_h, width, height) if union else None
    crop = framing.path_crop(boxes, med_h, width, height, MAX_FACTOR)
    state.path = {
        "union_box": [round(v, 1) for v in union] if union else None,
        "extended_to_last_frame": extended_to,
        "margin_px": round(med_h, 1),
        "fit_factor": round(fit, 4) if fit else None,
        "cap": MAX_FACTOR,
        "chosen_factor": round(crop[1], 4) if crop else None,
    }
    if crop is not None:
        state.probe_crop_rect = crop[0]
    share = med_h / float(height)
    limit = framing.MIN_ATHLETE_HEIGHT_FRAC

    if not framing.needs_zoom(med_h, height):
        state.applied = False
        state.reason = f"athlete {share * 100:.1f}% of frame height >= {limit * 100:.0f}%"
        state.mean_conf_after = state.mean_conf_before
        return frames, state

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
        f"athlete {share * 100:.1f}% of frame height < {limit * 100:.0f}%; path crop {factor:.3f}x"
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
