"""Light auto-zoom. Cap 1.75x. Never crops past the original frame edges.

Returns landmarks in **original** video coordinates so downstream consumers
see one consistent coordinate system regardless of whether zoom was applied.
"""
from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from .pose import LANDMARK_COUNT, PoseEngine, PoseFrame

MAX_ZOOM_FACTOR = 1.75
MIN_FILL_RATIO_TO_SKIP = 0.30
TARGET_FILL_RATIO = 0.50
SAMPLE_FRAMES = 6


@dataclass
class AutoZoomDecision:
    applied: bool
    reason: str | None
    factor: float
    final_fill_ratio: float
    crop_rect: dict[str, int] | None  # {x, y, w, h} in original coords
    padding: dict[str, int] | None    # {top, bottom, left, right}
    mean_conf_before: float
    mean_conf_after: float
    safety_backoff: bool


def _bbox_from_pose(pf: PoseFrame, w: int, h: int) -> tuple[float, float, float, float] | None:
    pts = [(x, y, s) for (x, y), s in zip(pf.keypoints, pf.scores) if s > 0.3]
    if len(pts) < 6:
        return None
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0, y0 = max(0.0, min(xs)), max(0.0, min(ys))
    x1, y1 = min(float(w), max(xs)), min(float(h), max(ys))
    if x1 <= x0 or y1 <= y0:
        return None
    return x0, y0, x1, y1


def _mean_conf(frames: list[PoseFrame]) -> float:
    vals: list[float] = []
    for pf in frames:
        if pf.detected:
            vals.extend(s for s in pf.scores if s > 0)
    return float(np.mean(vals)) if vals else 0.0


def decide_and_apply(
    engine: PoseEngine,
    frames: list[np.ndarray],
    width: int,
    height: int,
) -> tuple[list[np.ndarray], AutoZoomDecision]:
    """Sample a few frames, decide whether to zoom, optionally produce zoomed frames.

    Output frames always have the SAME (width, height) as the originals — the
    crop is upscaled and (if needed) letterboxed with black padding so that
    a simple linear reverse-map recovers original pixel coords.
    """
    if not frames:
        return frames, AutoZoomDecision(
            applied=False, reason="no frames", factor=1.0, final_fill_ratio=0.0,
            crop_rect=None, padding=None, mean_conf_before=0.0, mean_conf_after=0.0,
            safety_backoff=False,
        )

    n = len(frames)
    sample_idx = np.linspace(0, n - 1, num=min(SAMPLE_FRAMES, n)).astype(int).tolist()
    sample_results = [engine.detect(frames[i]) for i in sample_idx]
    mean_conf_before = _mean_conf(sample_results)

    bboxes = [b for b in (_bbox_from_pose(pf, width, height) for pf in sample_results) if b]
    if not bboxes:
        return frames, AutoZoomDecision(
            applied=False, reason="no athlete detected in sample", factor=1.0,
            final_fill_ratio=0.0, crop_rect=None, padding=None,
            mean_conf_before=mean_conf_before, mean_conf_after=mean_conf_before,
            safety_backoff=False,
        )

    frame_area = float(width * height)
    fills = [((x1 - x0) * (y1 - y0)) / frame_area for x0, y0, x1, y1 in bboxes]
    avg_fill = float(np.mean(fills))

    if avg_fill >= MIN_FILL_RATIO_TO_SKIP:
        return frames, AutoZoomDecision(
            applied=False,
            reason=f"athlete already fills {avg_fill:.0%} of frame",
            factor=1.0,
            final_fill_ratio=avg_fill,
            crop_rect=None,
            padding=None,
            mean_conf_before=mean_conf_before,
            mean_conf_after=mean_conf_before,
            safety_backoff=False,
        )

    # Median hip center for crop center.
    hip_centers = []
    for pf in sample_results:
        if not pf.detected:
            continue
        l_hip = pf.keypoints[23]
        r_hip = pf.keypoints[24]
        if pf.scores[23] > 0.3 and pf.scores[24] > 0.3:
            hip_centers.append(((l_hip[0] + r_hip[0]) / 2, (l_hip[1] + r_hip[1]) / 2))
    if not hip_centers:
        cx, cy = width / 2.0, height / 2.0
    else:
        cx = float(np.median([p[0] for p in hip_centers]))
        cy = float(np.median([p[1] for p in hip_centers]))

    # Required factor to reach target fill — capped.
    needed = float(np.sqrt(TARGET_FILL_RATIO / max(avg_fill, 1e-6)))
    factor = min(MAX_ZOOM_FACTOR, max(1.0, needed))

    crop_w = int(round(width / factor))
    crop_h = int(round(height / factor))
    x = int(round(cx - crop_w / 2))
    y = int(round(cy - crop_h / 2))
    x = max(0, min(width - crop_w, x))
    y = max(0, min(height - crop_h, y))

    cropped = [f[y : y + crop_h, x : x + crop_w] for f in frames]
    # Resize crop back to original (width, height). No letterbox needed because
    # crop_w/crop_h preserve the original aspect ratio (both divided by factor).
    zoomed = [cv2.resize(c, (width, height), interpolation=cv2.INTER_LINEAR) for c in cropped]

    # Re-run sample on zoomed frames to compute confidence-after.
    after_results = [engine.detect(zoomed[i]) for i in sample_idx]
    mean_conf_after = _mean_conf(after_results)

    # Safety backoff: if confidence dropped meaningfully, revert to originals.
    if mean_conf_after + 0.05 < mean_conf_before:
        return frames, AutoZoomDecision(
            applied=False,
            reason="confidence dropped after zoom — reverted",
            factor=1.0,
            final_fill_ratio=avg_fill,
            crop_rect=None,
            padding=None,
            mean_conf_before=mean_conf_before,
            mean_conf_after=mean_conf_after,
            safety_backoff=True,
        )

    # Recompute fill ratio in zoomed frames.
    after_bboxes = [b for b in (_bbox_from_pose(pf, width, height) for pf in after_results) if b]
    if after_bboxes:
        after_fills = [((x1 - x0) * (y1 - y0)) / frame_area for x0, y0, x1, y1 in after_bboxes]
        final_fill = float(np.mean(after_fills))
    else:
        final_fill = avg_fill * (factor ** 2)

    return zoomed, AutoZoomDecision(
        applied=True,
        reason=f"athlete <{int(MIN_FILL_RATIO_TO_SKIP * 100)}% of frame",
        factor=round(factor, 3),
        final_fill_ratio=round(final_fill, 3),
        crop_rect={"x": x, "y": y, "w": crop_w, "h": crop_h},
        padding={"top": 0, "bottom": 0, "left": 0, "right": 0},
        mean_conf_before=round(mean_conf_before, 3),
        mean_conf_after=round(mean_conf_after, 3),
        safety_backoff=False,
    )


def reverse_map_landmarks(
    pose_results: list[PoseFrame],
    decision: AutoZoomDecision,
    orig_w: int,
    orig_h: int,
) -> list[PoseFrame]:
    """Map landmarks computed on zoomed frames back to original video coords.

    Pose was run on frames that were upscaled crops of the original. The mapping
    from zoomed-frame pixels (px, py) back to original is:
        x_orig = crop.x + px * (crop.w / orig_w)
        y_orig = crop.y + py * (crop.h / orig_h)
    """
    if not decision.applied or decision.crop_rect is None:
        return pose_results
    cx, cy = decision.crop_rect["x"], decision.crop_rect["y"]
    cw, ch = decision.crop_rect["w"], decision.crop_rect["h"]
    sx = cw / float(orig_w)
    sy = ch / float(orig_h)
    mapped: list[PoseFrame] = []
    for pf in pose_results:
        new_kpts = []
        for x, y in pf.keypoints:
            new_kpts.append([cx + x * sx, cy + y * sy])
        mapped.append(PoseFrame(keypoints=new_kpts, scores=pf.scores[:], detected=pf.detected))
    # Silence unused-name warning for symmetry with LANDMARK_COUNT import elsewhere.
    _ = LANDMARK_COUNT
    return mapped
