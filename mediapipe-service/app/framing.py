"""Pure framing helpers for auto-zoom and per-frame validation.

No MediaPipe / OpenCV imports so these rules can be unit-tested in isolation.
All coordinates are pixels. `keypoints` is a list of 33 [x, y]; `scores` 33 floats.
"""
from __future__ import annotations

import os
from typing import Sequence

MIN_VIS = 0.5


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


# Zoom when the athlete's median height is under this share of frame height.
MIN_ATHLETE_HEIGHT_FRAC = _env_float("AUTOZOOM_MIN_HEIGHT_FRAC", 0.20)
# Crop margin around the union of all athlete positions, as a fraction of box size.
PATH_MARGIN_FRAC = 0.15
# Below this effective zoom factor the crop is not worth applying.
MIN_USEFUL_FACTOR = 1.1
# A detection box within this fraction of an edge counts as touching it.
EDGE_FRAC = 0.02
# Partial-detection rules.
MIN_VISIBLE_SHARE = 0.6  # >= 60% of the 33 landmarks visible
MAX_HIP_JUMP_BODY_HEIGHTS = 0.5  # hip moves more than half a body height between frames
MAX_HEIGHT_CHANGE_FRAC = 0.4  # body height changes by more than 40% of itself between frames

Box = tuple[float, float, float, float]  # x0, y0, x1, y1


def visible_points(keypoints: Sequence[Sequence[float]], scores: Sequence[float]) -> list[tuple[float, float]]:
    return [(float(p[0]), float(p[1])) for p, s in zip(keypoints, scores) if s >= MIN_VIS]


def bbox(keypoints: Sequence[Sequence[float]], scores: Sequence[float]) -> Box | None:
    pts = visible_points(keypoints, scores)
    if len(pts) < 4:
        return None
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def athlete_height(keypoints: Sequence[Sequence[float]], scores: Sequence[float]) -> float | None:
    b = bbox(keypoints, scores)
    return None if b is None else b[3] - b[1]


def hip_center(keypoints: Sequence[Sequence[float]], scores: Sequence[float]) -> tuple[float, float] | None:
    if len(scores) < 25 or scores[23] < MIN_VIS or scores[24] < MIN_VIS:
        return None
    return (
        (keypoints[23][0] + keypoints[24][0]) / 2.0,
        (keypoints[23][1] + keypoints[24][1]) / 2.0,
    )


def median(values: Sequence[float]) -> float | None:
    vals = sorted(values)
    if not vals:
        return None
    mid = len(vals) // 2
    return vals[mid] if len(vals) % 2 else (vals[mid - 1] + vals[mid]) / 2.0


def union_box(boxes: Sequence[Box]) -> Box | None:
    if not boxes:
        return None
    return (
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    )


def path_crop(
    boxes: Sequence[Box],
    body_height: float,
    width: int,
    height: int,
    max_factor: float,
) -> tuple[dict[str, int], float] | None:
    """Crop (same aspect as the frame) that contains every athlete box plus margin.

    Margin is max(15% of the union box, one body height) on every side. Returns
    (crop_rect, factor) or None when the path can't be covered at a useful zoom.
    """
    u = union_box(boxes)
    if u is None or width <= 0 or height <= 0:
        return None
    bw = u[2] - u[0]
    bh = u[3] - u[1]
    mx = max(bw * PATH_MARGIN_FRAC, body_height)
    my = max(bh * PATH_MARGIN_FRAC, body_height)
    need_w = bw + 2 * mx
    need_h = bh + 2 * my
    aspect = width / float(height)
    # Expand to frame aspect ratio.
    if need_w / need_h < aspect:
        need_w = need_h * aspect
    else:
        need_h = need_w / aspect
    factor = width / need_w
    factor = min(max_factor, factor)
    if factor < MIN_USEFUL_FACTOR:
        return None
    cw = int(round(width / factor))
    ch = int(round(height / factor))
    cx = (u[0] + u[2]) / 2.0
    cy = (u[1] + u[3]) / 2.0
    x0 = int(round(cx - cw / 2.0))
    y0 = int(round(cy - ch / 2.0))
    x0 = max(0, min(width - cw, x0))
    y0 = max(0, min(height - ch, y0))
    return {"x": x0, "y": y0, "w": cw, "h": ch}, factor


def touches_edge(b: Box | None, width: int, height: int, frac: float = EDGE_FRAC) -> bool:
    if b is None:
        return False
    mx = width * frac
    my = height * frac
    return b[0] <= mx or b[1] <= my or b[2] >= width - mx or b[3] >= height - my


def validate_frame(
    keypoints: Sequence[Sequence[float]],
    scores: Sequence[float],
    width: int,
    height: int,
    prev_hip: tuple[float, float] | None,
    prev_height: float | None,
    edge_frac: float = 0.005,
) -> str | None:
    """Return a rejection reason, or None when the detection is usable.

    Limits are relative to body height so genuine fast movement is kept.
    """
    visible = sum(1 for s in scores if s >= MIN_VIS)
    if visible < MIN_VISIBLE_SHARE * len(scores):
        return "too_few_visible_landmarks"
    b = bbox(keypoints, scores)
    if b is None:
        return "no_box"
    if touches_edge(b, width, height, edge_frac):
        return "clipped_at_edge"
    h = b[3] - b[1]
    hip = hip_center(keypoints, scores)
    if prev_height is not None and prev_height > 0:
        if abs(h - prev_height) > MAX_HEIGHT_CHANGE_FRAC * prev_height:
            return "height_jump"
        if hip is not None and prev_hip is not None:
            dist = ((hip[0] - prev_hip[0]) ** 2 + (hip[1] - prev_hip[1]) ** 2) ** 0.5
            if dist > MAX_HIP_JUMP_BODY_HEIGHTS * prev_height:
                return "hip_jump"
    return None


def needs_zoom(median_height: float, frame_height: int, frac: float | None = None) -> bool:
    """True when the athlete occupies less than `frac` of the frame height."""
    limit = MIN_ATHLETE_HEIGHT_FRAC if frac is None else frac
    return frame_height > 0 and median_height < limit * frame_height


def leading_missed_run(detected: Sequence[bool]) -> list[int]:
    """Indices from frame 0 up to (not including) the first detected frame."""
    out: list[int] = []
    for i, d in enumerate(detected):
        if d:
            break
        out.append(i)
    return out


# Robust-reference plausibility check.
REF_NEIGHBORS = 5  # nearest candidates per side
MIN_REF_POINTS = 3


def robust_validate(
    series: Sequence[tuple[float, tuple[float, float] | None] | None],
) -> dict[int, str]:
    """Reject frames whose height / hip disagree with the median of nearby frames.

    `series[i]` is (height_px, hip) for candidate frames, None for frames that are
    already missing. Iterates until stable; a rejected frame is removed from the
    pool so it can never become a reference. Returns {index: reason}.
    """
    pool = {i: v for i, v in enumerate(series) if v is not None}
    rejected: dict[int, str] = {}
    changed = True
    while changed:
        changed = False
        idxs = sorted(pool)
        verdicts: dict[int, str] = {}
        for pos, i in enumerate(idxs):
            left = idxs[max(0, pos - REF_NEIGHBORS):pos]
            right = idxs[pos + 1:pos + 1 + REF_NEIGHBORS]
            neigh = left + right
            if len(neigh) < MIN_REF_POINTS:
                continue
            ref_h = median([pool[j][0] for j in neigh])
            if not ref_h:
                continue
            h, hip = pool[i]
            if abs(h - ref_h) > MAX_HEIGHT_CHANGE_FRAC * ref_h:
                verdicts[i] = "height_jump"
                continue
            hips = [pool[j][1] for j in neigh if pool[j][1] is not None]
            if hip is not None and len(hips) >= MIN_REF_POINTS:
                rx = median([p[0] for p in hips])
                ry = median([p[1] for p in hips])
                # Allow for genuine motion: scale by distance to the farthest neighbour used.
                span = max(abs(j - i) for j in neigh)
                limit = MAX_HIP_JUMP_BODY_HEIGHTS * ref_h * max(1.0, span / 2.0)
                if ((hip[0] - rx) ** 2 + (hip[1] - ry) ** 2) ** 0.5 > limit:
                    verdicts[i] = "hip_jump"
        if verdicts:
            # Remove only the single worst offender per pass so one ghost can't
            # drag good neighbours out with it.
            def dev(i: int) -> float:
                idxs_n = [j for j in sorted(pool) if j != i]
                near = sorted(idxs_n, key=lambda j: abs(j - i))[: 2 * REF_NEIGHBORS]
                ref = median([pool[j][0] for j in near]) or 1.0
                return abs(pool[i][0] - ref) / ref
            worst = max(verdicts, key=dev)
            rejected[worst] = verdicts[worst]
            del pool[worst]
            changed = True
    return rejected
