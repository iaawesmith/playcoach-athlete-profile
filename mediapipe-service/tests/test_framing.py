"""Run: python3 mediapipe-service/tests/test_framing.py (no MediaPipe needed)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app import framing as f  # noqa: E402

W, H = 3840, 2160


def person(cx, cy, h):
    kps = [[cx + (i % 3 - 1) * h * 0.1, cy - h / 2 + h * i / 32] for i in range(33)]
    kps[23] = [cx - 5, cy]
    kps[24] = [cx + 5, cy]
    return kps, [0.9] * 33


def test_zoom_gate_share_of_frame_height():
    assert f.needs_zoom(184, 2160)  # 8.5% -> zoom
    assert not f.needs_zoom(450, 2160)  # 20.8% -> no zoom
    assert f.needs_zoom(431, 2160) and not f.needs_zoom(432, 2160)


def test_leading_missed_run():
    det = [False] * 18 + [True, True, False, True]
    assert f.leading_missed_run(det) == list(range(18))
    assert f.leading_missed_run([True, False]) == []


def _run_series():
    import json
    path = os.path.join(os.path.dirname(__file__), "fixtures", "run_39702081_series.json")
    frames = json.load(open(path))["frames"]
    return [None if x is None else (x["h"], tuple(x["hip"]) if x["hip"] else None) for x in frames]


def test_run_39702081_frames_24_to_28_accepted():
    # 24-28 were rejected vs frame 21 under the old last-accepted rule.
    rej = f.robust_validate(_run_series())
    for i in range(24, 29):
        assert i not in rej, (i, rej)
    for i in range(29, 46):
        assert i not in rej, (i, rej)


def test_rejected_frame_never_becomes_reference():
    series = [(230.0, (1000.0 + 30 * i, 1250.0)) for i in range(12)]
    series[5] = (420.0, (1000.0 + 150, 1250.0))  # ghost
    series[6] = (430.0, (1000.0 + 180, 1250.0))  # second ghost next to it
    rej = f.robust_validate(series)
    assert set(rej) == {5, 6}, rej


def test_ghost_mid_track_rejected_genuine_motion_kept():
    series = [(230.0, (1000.0 + 30 * i, 1250.0)) for i in range(15)]
    series[7] = (230.0, (700.0, 850.0))  # far off the path
    rej = f.robust_validate(series)
    assert rej == {7: "hip_jump"}, rej


def test_crop_covers_full_path_plus_margin():
    boxes = [f.bbox(*person(x, 800, 100)) for x in (1000, 1500, 2000, 2900)]
    crop, _ = f.path_crop(boxes, 100, W, H, 1.75)
    for b in boxes:
        assert crop["x"] <= b[0] - 100 and crop["x"] + crop["w"] >= b[2] + 100


def test_frame_75_style_hallucination_rejected():
    prev = person(2910, 800, 203)
    bad = person(1951, 836, 421)
    assert f.validate_frame(*bad, W, H, f.hip_center(*prev), 203) == "height_jump"


def test_fast_genuine_movement_kept():
    prev = person(2910, 800, 200)
    nxt = person(2990, 800, 205)  # 80 px hip move < half a body height
    assert f.validate_frame(*nxt, W, H, f.hip_center(*prev), 200) is None


def test_cut_off_and_sparse_rejected():
    k, s = person(3830, 800, 200)
    assert f.validate_frame(k, s, W, H, None, None) == "clipped_at_edge"
    k, _ = person(1000, 800, 200)
    assert f.validate_frame(k, [0.9] * 15 + [0.1] * 18, W, H, None, None) == "too_few_visible_landmarks"




# --- Path crop + athlete-sized recovery crops (run a634fbec / 39702081) -------

def _full_series():
    import json
    path = os.path.join(os.path.dirname(__file__), "fixtures", "run_slant_full_hip_series.json")
    return [(x["h"], tuple(x["hip"])) for x in json.load(open(path))["frames"]]


def _box(h, hip):
    return (hip[0] - 0.3 * h, hip[1] - 0.55 * h, hip[0] + 0.3 * h, hip[1] + 0.45 * h)


PROBES = [0, 11, 22, 34, 45, 56, 68, 79, 88, 89]


def test_path_crop_contains_every_hip_plus_margin():
    s = _full_series()
    boxes = [_box(*s[i]) for i in PROBES]
    med_h = f.median([s[i][0] for i in PROBES])
    rect, factor = f.path_crop(boxes, med_h, W, H, 1.75)
    assert 1.2 < factor < 1.4, factor  # fits the path, not the 1.75x cap
    for h, (x, y) in s:
        assert rect["x"] + med_h <= x <= rect["x"] + rect["w"] - med_h
        assert rect["y"] + med_h <= y <= rect["y"] + rect["h"] - med_h


def test_path_crop_still_capped_for_short_path():
    boxes = [_box(230, (1800, 1200)), _box(230, (1900, 1200))]
    _, factor = f.path_crop(boxes, 230, W, H, 1.75)
    assert factor == 1.75


def test_trailing_probe_extension_reaches_route_end():
    s = _full_series()
    seen = [(i, s[i][1]) for i in (0, 11, 22, 34, 45, 56)]  # 68, 79, 88, 89 missed
    end = f.predict_hip(seen, 89)
    assert end[0] > s[56][1][0] + 800  # extended toward the end (under-reaches: athlete accelerates; retries cover the rest)


def test_recovery_crop_sized_from_athlete_not_path():
    # 1.27x path crop would be ~1700 px tall; recovery crop is 5 x 230 = 1150.
    s = _full_series()
    path_h = H / 1.27
    for i in list(range(0, 18)) + list(range(66, 90)):
        r = f.recovery_crop(s[i][1], 230, W, H, 1.75, mult=5)
        assert abs(r["h"] - 1150) <= 1, r
        assert r["h"] < path_h - 400
        assert abs(r["w"] / r["h"] - W / H) < 0.01


def test_recovery_crop_never_larger_than_cap_crop():
    r = f.recovery_crop((1900, 1200), 400, W, H, 1.75, mult=5)
    assert r["h"] == round(H / 1.75)


def _detector(series):
    def try_detect(i, rect):
        h, (x, y) = series[i]
        inside = rect["x"] <= x <= rect["x"] + rect["w"] and rect["y"] <= y <= rect["y"] + rect["h"]
        return (h, (x, y)) if inside else None
    return try_detect


def test_following_crop_recovers_frames_lost_at_crop_edge():
    s = _full_series()
    lost = [66] + list(range(69, 90))  # a634fbec missed frames
    detected = [None if i in lost else s[i] for i in range(90)]
    attempts = f.plan_follow(detected, lost, W, H, 1.75, _detector(s))
    assert [a["frame"] for a in attempts] == lost
    assert all(a["recovered"] for a in attempts)
    for a in attempts:
        x, y = s[a["frame"]][1]
        r = a["crop"]
        assert r["h"] <= 5 * 260  # athlete-sized
        assert r["x"] <= x <= r["x"] + r["w"]


def test_following_crop_stops_after_consecutive_misses():
    s = _full_series()
    lost = list(range(60, 90))
    detected = [None if i in lost else s[i] for i in range(90)]
    attempts = f.plan_follow(detected, lost, W, H, 1.75, lambda i, r: None)
    assert len(attempts) == f.MAX_FOLLOW_MISSES


def test_implausible_recovery_never_anchors():
    s = _full_series()
    lost = list(range(70, 76))
    detected = [None if i in lost else s[i] for i in range(90)]

    def det(i, rect):
        if i == 70:
            return (600.0, (rect["x"] + 5, rect["y"] + 5))  # ghost: wrong size and place
        return _detector(s)(i, rect)

    attempts = f.plan_follow(detected, lost, W, H, 1.75, det)
    assert attempts[0]["recovered"] is False
    assert all(a["recovered"] for a in attempts[1:])


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("pass", name)
