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
# Recovery / probe-retry crop height = this many athlete heights (athlete fills ~1/mult).
RECOVERY_CROP_HEIGHT_MULT = _env_float("RECOVERY_CROP_HEIGHT_MULT", 5.0)
# Following crop stops after this many consecutive unrecovered frames.
MAX_FOLLOW_MISSES = 10
# Frames of recent good hips used to estimate velocity.
FOLLOW_VELOCITY_FRAMES = 5
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
    """Crop (frame aspect) containing every athlete box plus one body height of margin.

    zoom = min(max_factor, factor that fits the union box + margin). Returns
    (crop_rect, factor) or None when the path can't be covered at a useful zoom.
    """
    u = union_box(boxes)
    fit = fit_factor(u, body_height, width, height) if u is not None else None
    if u is None or fit is None:
        return None
    factor = min(max_factor, fit)
    if factor < MIN_USEFUL_FACTOR:
        return None
    rect = centered_rect(((u[0] + u[2]) / 2.0, (u[1] + u[3]) / 2.0),
                         int(round(width / factor)), int(round(height / factor)), width, height)
    return rect, factor


def fit_factor(u: Box, body_height: float, width: int, height: int) -> float | None:
    """Zoom factor at which the union box plus one body height per side just fits."""
    if width <= 0 or height <= 0:
        return None
    need_w = (u[2] - u[0]) + 2 * body_height
    need_h = (u[3] - u[1]) + 2 * body_height
    aspect = width / float(height)
    if need_w <= 0 or need_h <= 0:
        return None
    need_w = max(need_w, need_h * aspect)
    return width / need_w


def centered_rect(center: tuple[float, float], cw: int, ch: int, width: int, height: int) -> dict[str, int]:
    cw = max(1, min(width, cw))
    ch = max(1, min(height, ch))
    x0 = int(round(center[0] - cw / 2.0))
    y0 = int(round(center[1] - ch / 2.0))
    x0 = max(0, min(width - cw, x0))
    y0 = max(0, min(height - ch, y0))
    return {"x": x0, "y": y0, "w": cw, "h": ch}


def recovery_crop(
    center: tuple[float, float],
    athlete_h: float,
    width: int,
    height: int,
    max_factor: float,
    mult: float | None = None,
) -> dict[str, int]:
    """Athlete-sized crop: height = mult x athlete height, frame aspect, centred on
    `center`, clamped inside the frame, never larger than the max_factor crop."""
    m = RECOVERY_CROP_HEIGHT_MULT if mult is None else mult
    ch = min(m * athlete_h, height / max_factor)
    cw = ch * width / float(height)
    return centered_rect(center, int(round(cw)), int(round(ch)), width, height)


def predict_hip(
    good: Sequence[tuple[int, tuple[float, float]]],
    target: int,
    k: int = FOLLOW_VELOCITY_FRAMES,
) -> tuple[float, float] | None:
    """Extend from the latest good hips: mean velocity over the last k good frames
    (by frame index) carried forward to `target`. `good` is time-ordered."""
    if not good:
        return None
    recent = list(good[-k:])
    last_i, last = recent[-1]
    if len(recent) < 2 or recent[-1][0] == recent[0][0]:
        return last
    di = recent[-1][0] - recent[0][0]
    vx = (recent[-1][1][0] - recent[0][1][0]) / di
    vy = (recent[-1][1][1] - recent[0][1][1]) / di
    steps = target - last_i
    return last[0] + vx * steps, last[1] + vy * steps


def interpolate_hip(
    good: Sequence[tuple[int, tuple[float, float]]], target: int
) -> tuple[float, float] | None:
    """Predicted hip at `target` from detected samples on either side (probe retries):
    linear between neighbours, extrapolated past the ends."""
    if not good:
        return None
    before = [g for g in good if g[0] < target]
    after = [g for g in good if g[0] > target]
    if before and after:
        (i0, p0), (i1, p1) = before[-1], after[0]
        t = (target - i0) / float(i1 - i0)
        return p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t
    if before:
        return predict_hip(before, target)
    rev = [(-i, p) for i, p in reversed(after)]
    return predict_hip(rev, -target)


def accept_recovery(
    h: float | None,
    hip: tuple[float, float] | None,
    pred: tuple[float, float] | None,
    ref_h: float | None,
    steps: int,
) -> bool:
    """A recovered detection may anchor later predictions only if its height is
    within MAX_HEIGHT_CHANGE_FRAC of the recent median and its hip is within the
    per-frame hip-jump limit (scaled by frames since the last good hip) of the prediction."""
    if h is None or hip is None or not ref_h:
        return False
    if abs(h - ref_h) > MAX_HEIGHT_CHANGE_FRAC * ref_h:
        return False
    if pred is None:
        return True
    limit = MAX_HIP_JUMP_BODY_HEIGHTS * ref_h * max(1, steps)
    return ((hip[0] - pred[0]) ** 2 + (hip[1] - pred[1]) ** 2) ** 0.5 <= limit


def box_touches_rect(b: Box | None, rect: dict[str, int] | None, frac: float = EDGE_FRAC) -> bool:
    """True when a box (original coords) is within frac of the crop rect's edge."""
    if b is None or rect is None:
        return False
    mx = rect["w"] * frac
    my = rect["h"] * frac
    x0, y0 = rect["x"], rect["y"]
    x1, y1 = x0 + rect["w"], y0 + rect["h"]
    return b[0] <= x0 + mx or b[1] <= y0 + my or b[2] >= x1 - mx or b[3] >= y1 - my


def plan_follow(
    detected: Sequence[tuple[float, tuple[float, float]] | None],
    targets: Sequence[int],
    width: int,
    height: int,
    max_factor: float,
    try_detect,  # (frame, rect) -> (height, hip) | None
) -> list[dict]:
    """Following crop, in time order. `detected[i]` is (height, hip) for frames the
    main pass got right, else None. For each target after the first good frame,
    predict the hip from the last good hips, crop athlete-sized around it, and call
    try_detect. Accepted recoveries become anchors. Stops after MAX_FOLLOW_MISSES
    consecutive misses. Returns one attempt record per crop tried."""
    target_set = set(targets)
    good: list[tuple[int, tuple[float, float]]] = []
    heights: list[float] = []
    attempts: list[dict] = []
    misses = 0
    for i in range(len(detected)):
        if i not in target_set:
            d = detected[i]
            if d is not None:
                good.append((i, d[1]))
                heights.append(d[0])
                misses = 0
            continue
        if not good or misses >= MAX_FOLLOW_MISSES:
            continue
        ref_h = median(heights[-FOLLOW_VELOCITY_FRAMES * 2:])
        pred = predict_hip(good, i)
        if pred is None or not ref_h:
            continue
        rect = recovery_crop(pred, ref_h, width, height, max_factor)
        got = try_detect(i, rect)
        ok = got is not None and accept_recovery(got[0], got[1], pred, ref_h, i - good[-1][0])
        attempts.append({"frame": i, "kind": "follow", "crop": rect, "recovered": bool(ok)})
        if ok:
            good.append((i, got[1]))
            heights.append(got[0])
            misses = 0
        else:
            misses += 1
    return attempts


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
