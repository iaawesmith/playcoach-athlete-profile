

## Surgical fix: warm singleton + VIDEO mode + non-blocking inference

Root cause: `PoseLandmarker` is created inside the per-request `with PoseEngine()` block. The ~17s init blocks uvicorn's event loop and Cloud Run kills the container at ~30s. Fix is a singleton warmed at startup, VIDEO mode for the loop, and `asyncio.to_thread` to keep the event loop free.

### Change 1 — `mediapipe-service/app/pose.py`

- Remove `__enter__` / `__exit__`. `PoseEngine` becomes a plain class that owns one `PoseLandmarker`.
- Constructor builds the landmarker eagerly with `RunningMode.VIDEO`. Same options otherwise (num_poses=1, confidences=0.5, Lite model).
- Add module-level `_ENGINE: PoseEngine | None = None` + `threading.Lock` + `get_engine()` lazy singleton accessor.
- `detect(frame_bgr, timestamp_ms: int) -> PoseFrame` calls `self._landmarker.detect_for_video(mp_image, timestamp_ms)`. Same RGB conversion, pixel-coord mapping, defensive padding to `LANDMARK_COUNT`.
- `run_with_skip(engine, frames, det_frequency, fps)` — compute `timestamp_ms = int(i * 1000 / fps)` per detect call. Forward-fill on skip frames. Timestamps stay monotonic across detect calls (required by VIDEO mode).
- Drop `close()` — singleton lives for container lifetime.

### Change 2 — `mediapipe-service/app/main.py`

- Add `from contextlib import asynccontextmanager` and `import asyncio`.
- Swap import: `from .pose import LANDMARK_COUNT, get_engine, run_with_skip`.
- Define lifespan that calls `get_engine()` to warm the singleton at startup, log before/after.
- Construct `app = FastAPI(title=..., version=..., lifespan=lifespan)`.
- Convert handler to `async def analyze(req)`. Replace `with PoseEngine() as engine:` with `engine = get_engine()`.
- Wrap CPU-bound calls in `await asyncio.to_thread(...)`:
  - `video.decode_window(local_path, req.start_seconds, req.end_seconds, video.TARGET_FPS)`
  - `az.decide_and_apply(engine, frames, width, height)`
  - `run_with_skip(engine, processed_frames, req.det_frequency, video.TARGET_FPS)`
- Keep `with video.download_to_tmp(...)` synchronous (short I/O, context manager).
- `az.reverse_map_landmarks(...)` and `calibration.estimate(...)` stay synchronous (fast pure-Python).
- `/health` unchanged. Response schema unchanged.

### Why this works

- Cold-start init moves to container boot — Cloud Run startup probe absorbs the 17s, not the 30s request budget.
- Subsequent `/analyze` calls skip init entirely — wall time is pure inference.
- VIDEO mode is 2–3× faster than IMAGE mode on sequential frames with more stable landmarks.
- `asyncio.to_thread` keeps uvicorn's event loop free during inference, so health probes don't starve. Cloud Run concurrency=1 means no lock needed around `detect_for_video`.

### Out of scope

- `schema.py`, `calibration.py`, `auto_zoom.py`, `video.py` untouched.
- Response shape unchanged.
- Model stays Lite.
- No new instrumentation logging.
- No Edge Function or DB changes.

### Files modified

- `mediapipe-service/app/pose.py`
- `mediapipe-service/app/main.py`

### Reporting on file completion (before user redeploys)

Immediately after the edits land, post a diff summary covering:
- `pose.py`: lines removed (context manager, IMAGE-mode `detect`), lines added (singleton, lock, `get_engine`, VIDEO-mode `detect_for_video`), updated `run_with_skip` signature.
- `main.py`: lines added (asyncio + lifespan imports, lifespan function, `get_engine` import), lines changed (FastAPI constructor, handler signature → async, `with PoseEngine` → `engine = get_engine()`, three `await asyncio.to_thread` wrappings).

Do not wait for redeploy approval before reporting.

### Smoke test outcomes (after user redeploys)

Re-trigger Edge Function for upload `66ea5e98-ff65-4d20-9e9e-232753d198aa`. Classify result as one of:

- **GOOD** — `/analyze` returns 200 in 5–15s with real keypoints; Slant scoring fails cleanly with index-out-of-bounds on hand landmarks (indices 99, 120). Fix validated; next ticket is the RTMlib→MediaPipe index migration.
- **PARTIAL** — `/analyze` returns 200 but mean keypoint scores ≈ 0 (pose detection silently failed on this clip). Fix works; video quality is a separate issue to triage.
- **BAD** — `/analyze` still 503s. Second bug exists. Capture fresh Cloud Run logs for the new revision and report stage-level failure point.

Report includes: response duration, `frame_count`, `fps`, keypoints/scores dimensions, mean keypoint confidence, calibration block, auto-zoom block, end-to-end status (`pipeline_result` written? `status='complete'`?), and any scoring-node errors.

