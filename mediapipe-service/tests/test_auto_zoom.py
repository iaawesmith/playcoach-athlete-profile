"""Model-free integration checks for per-frame inverse mapping and safety backoff."""
import importlib.util
import os
import sys
import types
from dataclasses import dataclass, field
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app import framing


@dataclass
class PoseFrame:
    detected: bool = False
    keypoints: list = field(default_factory=list)
    scores: list = field(default_factory=list)
    world_keypoints: list = field(default_factory=list)


def load_zoom():
    # Isolate fake optional dependencies to this module import only.
    pose = types.ModuleType('app.pose')
    pose.LANDMARK_COUNT = 33
    pose.PoseFrame = PoseFrame
    pose.PoseEngine = object
    cv = types.ModuleType('cv2')
    cv.INTER_LINEAR = 1
    cv.resize = lambda image, size, interpolation: image
    original = {k: sys.modules.get(k) for k in ['app.pose', 'cv2']}
    sys.modules.update({'app.pose': pose, 'cv2': cv})
    try:
        spec = importlib.util.spec_from_file_location('app.zoom_test', os.path.join(os.path.dirname(__file__), '../app/auto_zoom.py'))
        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module
        spec.loader.exec_module(module)
        return module
    finally:
        for k, value in original.items():
            if value is None:
                sys.modules.pop(k, None)
            else:
                sys.modules[k] = value


az = load_zoom()


def test_each_frame_reverse_maps_with_its_own_crop_and_keeps_world_data():
    rects = [{'x': x, 'y': 100, 'w': 200, 'h': 100} for x in [0, 400]]
    world = [[1, 2, 3]]
    frames = [PoseFrame(True, [[500, 250], [0, 0]], [0.9, 0], world) for _ in rects]
    state = az.ZoomState(applied=True, crop_rect=rects[0], crop_rects=rects)
    out = az.reverse_map_landmarks(frames, state, 1000, 500)
    assert out[0].keypoints == [[100, 150], [0, 0]]
    assert out[1].keypoints == [[500, 150], [0, 0]]
    assert out[1].world_keypoints == world
    assert frames[1].keypoints[0] == [500, 250]


def test_confidence_drop_reverts_following_zoom():
    class Engine:
        calls = 0
        def detect(self, frame):
            self.calls += 1
            score = 0.9 if self.calls <= 3 else 0.1
            points = [[100 + (i % 3) * 2, 200 + i * 2] for i in range(33)]
            return PoseFrame(True, points, [score] * 33, [])
    frames = [np.zeros((500, 1000, 3), dtype=np.uint8) for _ in range(3)]
    fake = types.ModuleType('app.pose')
    fake._detect_on_crop = lambda *args: PoseFrame()
    original = sys.modules.get('app.pose')
    sys.modules['app.pose'] = fake
    try:
        processed, state = az._decide_with_probe(Engine(), frames, 1000, 500, [0, 1, 2], az.ZoomState())
    finally:
        if original is None:
            sys.modules.pop('app.pose', None)
        else:
            sys.modules['app.pose'] = original
    assert processed is frames
    assert state.safety_backoff and not state.applied
    assert state.factor == 1 and state.crop_rect is None


if __name__ == '__main__':
    for name, fn in list(globals().items()):
        if name.startswith('test_'):
            fn()
            print('pass', name)