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


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("pass", name)
