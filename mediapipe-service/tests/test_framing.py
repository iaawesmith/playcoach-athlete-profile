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


def test_zoom_gate_150px():
    assert f.athlete_height(*person(1000, 800, 151)) >= f.MIN_ATHLETE_HEIGHT_PX
    assert f.athlete_height(*person(1000, 800, 149)) < f.MIN_ATHLETE_HEIGHT_PX


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
