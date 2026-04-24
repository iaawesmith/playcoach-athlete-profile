

## Add-on: globally monotonic timestamps via `reserve_timestamp_range`

VIDEO mode requires timestamps to be non-decreasing across the landmarker's entire lifetime, not just within one request. Today `run_with_skip` starts at frame index 0 every call, so the second `/analyze` on a warm container will throw `RuntimeError: Input timestamp must be monotonically increasing` and surface as a 503.

### Change — `mediapipe-service/app/pose.py` only

**1. Add public helper on `PoseEngine`:**

```python
def reserve_timestamp_range(self, n_frames: int, fps: float) -> int:
    frame_interval_ms = max(1, int(round(1000 / fps)))
    with self._ts_lock:
        base = self._next_ts_ms
        self._next_ts_ms = base + n_frames * frame_interval_ms
    return base
```

**2. Update `run_with_skip` to use the helper:**

```python
def run_with_skip(engine, frames, det_frequency, fps):
    if det_frequency < 1:
        det_frequency = 1
    if fps <= 0:
        fps = 1.0

    frame_interval_ms = max(1, int(round(1000 / fps)))
    base = engine.reserve_timestamp_range(len(frames), fps)

    results = []
    last = PoseFrame(detected=False)
    for i, frame in enumerate(frames):
        if i % det_frequency == 0:
            timestamp_ms = base + i * frame_interval_ms
            last = engine.detect(frame, timestamp_ms)
        results.append(last)
    return results
```

### Why this works

- `reserve_timestamp_range` reads and advances `_next_ts_ms` atomically under `_ts_lock`, returning a base above all prior activity.
- The full range is reserved up-front, so even if `auto_zoom`'s untimestamped `detect()` calls have advanced the counter (existing fallback bumps by 1ms per call), the next `run_with_skip` anchors safely above them.
- No private attribute access from outside the class — clean public contract.
- Cloud Run concurrency=1 means no real contention, but the lock keeps it correct under any future config.

### Out of scope

- `main.py`, `auto_zoom.py`, `video.py`, `calibration.py`, `schema.py` — untouched
- Response schema — unchanged
- No new logging
- `detect()` signature and auto-counter fallback — unchanged

### Files modified

- `mediapipe-service/app/pose.py` (one new method, one updated function)

### Smoke test plan (after redeploy)

Hit `/analyze` against the test clip **twice in a row** on the warm container. Both should return 200 in 5–15s. Classify per the prior matrix:

- **GOOD** — both calls 200, real keypoints, Slant scoring fails cleanly with index-out-of-bounds on hand landmarks (indices 99, 120). Validates singleton + VIDEO mode + cross-request monotonicity.
- **PARTIAL** — both calls 200 but mean keypoint scores ≈ 0. Fix works; clip quality is a separate triage.
- **BAD** — second call 503s with monotonicity error in logs. `auto_zoom`'s untimestamped `detect()` path needs explicit timestamps too; next ticket.

Report includes: response duration for each call, `frame_count`, `fps`, keypoints/scores dimensions, mean keypoint confidence, calibration block, auto-zoom block, end-to-end status (`pipeline_result` written? `status='complete'`?), and any scoring-node errors.

