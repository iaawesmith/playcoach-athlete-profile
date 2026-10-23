"""Streaming frame source: same frames as an eager decode, bounded memory, frame cap."""
from app.frame_source import MAX_DECODED_FRAMES, FrameSource, MappedFrames, achieved_fps, sample_plan


class FakeReader:
    """Mimics cv2.VideoCapture: frame value = source index; seek moves the cursor."""

    def __init__(self, n_src: int, log: list) -> None:
        self.pos, self.n, self.log = 0, n_src, log

    def seek(self, index: int) -> None:
        self.log.append(("seek", index))
        self.pos = index

    def read(self):
        if self.pos >= self.n:
            return False, None
        f = self.pos
        self.pos += 1
        return True, f

    def release(self) -> None:
        pass


def eager(plan, n_src):
    """The pre-streaming decode_window loop, verbatim logic."""
    r, out, last = FakeReader(n_src, []), [], -1
    for idx in plan:
        if idx != last + 1:
            r.seek(idx)
        ok, f = r.read()
        if not ok:
            break
        out.append(f)
        last = idx
    return out


def test_cap_is_300_frames_and_reported():
    p = sample_plan(0, 12.0, 30, 30)
    assert MAX_DECODED_FRAMES == 300
    assert len(p.src_indices) == 300 and p.requested_frames == 360 and p.frame_cap_reached
    q = sample_plan(0, 8.0, 30, 30)
    assert len(q.src_indices) == 240 and not q.frame_cap_reached


def test_streaming_matches_eager_in_any_access_order():
    for src_fps, n_src in ((30, 240), (60, 480), (29.97, 239)):
        plan = sample_plan(0, 8.0, src_fps, 30).src_indices
        want = eager(plan, n_src)
        fs = FrameSource(lambda: FakeReader(n_src, []), plan, cache_frames=3)
        assert len(fs) == len(want)
        assert list(fs) == want
        order = [5, 0, 200, 3, len(want) - 1, 1]
        assert [fs[i] for i in order] == [want[i] for i in order]
        assert len(fs._cache) <= 3


def test_short_file_stops_like_eager():
    plan = sample_plan(0, 8.0, 30, 30).src_indices
    fs = FrameSource(lambda: FakeReader(100, []), plan)
    assert len(fs) == 100 == len(eager(plan, 100))


def test_mapped_frames_transform_lazily():
    plan = sample_plan(0, 1.0, 30, 30).src_indices
    m = MappedFrames(FrameSource(lambda: FakeReader(30, []), plan), lambda f: f * 10)
    assert len(m) == 30 and m[4] == 40 and list(m)[-1] == 290


def test_achieved_fps():
    assert achieved_fps(sample_plan(0, 2, 30, 30).src_indices, 30) == 30.0
    assert achieved_fps(sample_plan(0, 2, 15, 30).src_indices, 30) == 15.0
