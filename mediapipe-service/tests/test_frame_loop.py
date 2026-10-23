"""No MediaPipe model required: verify every-frame calls including 3s at 60fps."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.frameLoop import run_every_frame


class Engine:
    def __init__(self):
        self.calls = []

    def reserve_timestamp_range(self, count, fps):
        self.reserved = (count, fps)
        return 0

    def detect(self, frame, timestamp_ms):
        self.calls.append((frame, timestamp_ms))
        return {"frame": frame}


class EveryFrameTests(unittest.TestCase):
    def test_three_seconds_at_sixty_fps_detects_all_180_frames(self):
        engine = Engine()
        result = run_every_frame(engine, list(range(180)), 60)
        self.assertEqual([frame for frame, _ in engine.calls], list(range(180)))
        self.assertEqual(len(result), 180)
        self.assertEqual(engine.calls[-1][1], 179 * 17)

    def test_ninety_frame_clock_matches_old_frequency_one(self):
        engine = Engine()
        result = run_every_frame(engine, list(range(90)), 30)
        self.assertEqual(engine.calls, [(frame, frame * 33) for frame in range(90)])
        self.assertEqual([item["frame"] for item in result], list(range(90)))


if __name__ == "__main__":
    unittest.main()