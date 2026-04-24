"""Body-based pixels_per_yard estimator using MediaPipe landmarks only.

Uses anthropometric averages:
  - shoulder width  (lm 11 ↔ 12) ≈ 0.45 yd
  - hip      width  (lm 23 ↔ 24) ≈ 0.32 yd
"""
from __future__ import annotations

import math
from typing import Any

from .pose import PoseFrame

SHOULDER_YARDS = 0.45
HIP_YARDS = 0.32
MIN_VISIBILITY = 0.7
MIN_FRAMES_FOR_CONFIDENCE = 6


def _dist(a: list[float], b: list[float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    k = max(0, min(len(s) - 1, int(round(pct * (len(s) - 1)))))
    return s[k]


def estimate(pose_frames: list[PoseFrame]) -> tuple[float | None, str, dict[str, Any]]:
    """Return (pixels_per_yard, confidence_label, details_dict)."""
    shoulder_pxs: list[float] = []
    hip_pxs: list[float] = []

    for pf in pose_frames:
        if not pf.detected:
            continue
        if pf.scores[11] >= MIN_VISIBILITY and pf.scores[12] >= MIN_VISIBILITY:
            shoulder_pxs.append(_dist(pf.keypoints[11], pf.keypoints[12]))
        if pf.scores[23] >= MIN_VISIBILITY and pf.scores[24] >= MIN_VISIBILITY:
            hip_pxs.append(_dist(pf.keypoints[23], pf.keypoints[24]))

    frames_used = max(len(shoulder_pxs), len(hip_pxs))
    if frames_used == 0:
        return None, "none", {
            "method": "body_based",
            "frames_used": 0,
            "reason": "no frames met visibility threshold",
        }

    shoulder_med = _percentile(shoulder_pxs, 0.5) if shoulder_pxs else 0.0
    hip_med = _percentile(hip_pxs, 0.5) if hip_pxs else 0.0

    estimates: list[tuple[float, float]] = []  # (ppy, weight)
    if shoulder_med > 0:
        estimates.append((shoulder_med / SHOULDER_YARDS, len(shoulder_pxs) * 1.0))
    if hip_med > 0:
        estimates.append((hip_med / HIP_YARDS, len(hip_pxs) * 0.8))

    if not estimates:
        return None, "none", {
            "method": "body_based",
            "frames_used": frames_used,
            "reason": "could not derive any estimate",
        }

    total_w = sum(w for _, w in estimates)
    ppy = sum(v * w for v, w in estimates) / total_w

    if frames_used >= 20:
        confidence = "high"
    elif frames_used >= MIN_FRAMES_FOR_CONFIDENCE:
        confidence = "medium"
    else:
        confidence = "low"

    details: dict[str, Any] = {
        "method": "body_based",
        "frames_used": frames_used,
        "shoulder_frames": len(shoulder_pxs),
        "hip_frames": len(hip_pxs),
        "shoulder_median_px": round(shoulder_med, 2),
        "hip_median_px": round(hip_med, 2),
        "shoulder_yards_assumed": SHOULDER_YARDS,
        "hip_yards_assumed": HIP_YARDS,
    }

    return round(ppy, 3), confidence, details
