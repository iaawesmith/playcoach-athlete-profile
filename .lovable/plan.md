

## Phase 1 — Build `mediapipe-service` (Execution)

Building exactly as approved: `mediapipe-service/` at repo root, Pose Landmarker Lite, auto-zoom cap 1.75x, Cloud Run 2 vCPU / 2 GiB / concurrency 1. Zero changes to the Edge Function or DB in this phase.

---

### Files created

| Path | Purpose |
|---|---|
| `mediapipe-service/Dockerfile` | Python 3.11-slim, ffmpeg + libgl, pip install requirements, pre-bake `pose_landmarker_lite.task` from Google CDN, uvicorn entrypoint on port 8080 |
| `mediapipe-service/requirements.txt` | Pinned: fastapi 0.115.0, uvicorn[standard] 0.30.6, mediapipe 0.10.18, opencv-python-headless 4.10, numpy 1.26.4, ffmpeg-python 0.2.0, pydantic 2.9.2, httpx 0.27.2 |
| `mediapipe-service/.dockerignore` | Exclude `__pycache__`, `.venv`, `*.pyc`, `models/*.task` (re-downloaded in build) |
| `mediapipe-service/README.md` | Build, local-run, deploy, and curl test instructions; rollback steps |
| `mediapipe-service/app/__init__.py` | Empty package marker |
| `mediapipe-service/app/main.py` | FastAPI app, `GET /health`, `POST /analyze` orchestrating pipeline |
| `mediapipe-service/app/schema.py` | Pydantic `AnalyzeRequest` + `AnalyzeResponse` models matching Edge Function contract exactly |
| `mediapipe-service/app/video.py` | httpx stream download → `/tmp`, ffmpeg trim to `[start_seconds, end_seconds]` at 30 fps, BGR frame iterator |
| `mediapipe-service/app/pose.py` | `PoseEngine` class wrapping MediaPipe Pose Landmarker (Lite). Runs every `det_frequency`th frame, forward-fills skipped frames. Returns `keypoints[frame][0][33]` and `scores[frame][0][33]` |
| `mediapipe-service/app/auto_zoom.py` | 6-frame sample, `fill_ratio < 0.30` triggers crop centered on median hip, factor capped at **1.75**, reverse-maps landmarks to original coords, safety-backoff if confidence drops |
| `mediapipe-service/app/calibration.py` | Body-based `pixels_per_yard` from shoulder (11,12) + hip (23,24) widths, confidence-weighted median across most-reliable 30% of frames |
| `mediapipe-service/app/motion.py` | Hip x-trajectory → `movement_direction` + `movement_confidence` |

### Files NOT touched (verified)

- `supabase/functions/analyze-athlete-video/index.ts` — unchanged
- All other edge functions — unchanged
- `supabase/migrations/` — none added
- `athlete_lab_nodes`, `athlete_lab_results`, all DB rows — unchanged
- Frontend (`src/**`) — unchanged

---

### Response shape (must match `CloudRunResponse` in the Edge Function)

```text
keypoints           [frame][person][33] = [x, y]   (original video coords)
scores              [frame][person][33] = visibility 0..1
frame_count         int
fps                 float
pixels_per_yard     float | null
calibration_source  "body_based"
calibration_confidence  "high" | "medium" | "low"
calibration_details {...}
auto_zoom_applied   bool
auto_zoom_reason    str | null
auto_zoom_factor    float (≤ 1.75)
auto_zoom_final_fill_ratio  float
auto_zoom_crop_rect {x,y,w,h}
auto_zoom_padding   {top,bottom,left,right}
movement_direction  "left_to_right" | "right_to_left" | "stationary"
movement_confidence float
person_detection_confidence  float
safety_backoff_applied  bool
athlete_framing_message  str | null
mean_keypoint_confidence_before_auto_zoom  float
mean_keypoint_confidence_after_auto_zoom   float
progress_updates    [{message, frame, total_frames, detection_every_n}]
```

Single-person video → outer person array length 1. Coordinates always in original frame space.

---

### Pipeline order inside `POST /analyze`

1. Validate request (reject if `end_seconds <= start_seconds` or window > 30s)
2. Stream-download video to `/tmp/<uuid>.mp4` via httpx
3. ffmpeg trim + decode to 30 fps BGR frames
4. Auto-zoom decision on 6-frame sample (cap 1.75x, skip if fill ≥ 30%)
5. Run MediaPipe Pose every `det_frequency` frames; forward-fill in between
6. Reverse-map landmarks to original coords
7. Body-based calibration → `pixels_per_yard`
8. Motion estimation → direction + confidence
9. Assemble + return JSON
10. Cleanup `/tmp` artifact

---

### Cloud Run config (documented in README, applied at deploy time)

- Region: `us-central1`
- CPU: **2 vCPU**, Memory: **2 GiB**
- Concurrency: **1**, Min instances: 0, Max: 4
- Request timeout: 300s
- Image base: `python:3.11-slim`, model pre-baked → no cold-download

---

### Edge Function integration (zero code change in Phase 1)

The Edge Function already reads `RTMLIB_URL` from env. Cutover plan (post-build, manual):

1. Deploy `mediapipe-service` to Cloud Run → get URL
2. Add new secret `MEDIAPIPE_URL` (for reference / Phase 1.5 rename)
3. Side-by-side curl test against backyard slant signed URL
4. Flip `RTMLIB_URL` secret value to MediaPipe URL — instant cutover
5. Old RTMlib Cloud Run instance stays running for instant rollback (revert env var)

No Deno code edits, no edge-function redeploy.

---

### Acceptance criteria (verified before cutover)

1. `docker build` succeeds, image < 1.5 GB
2. `/health` returns `{ok:true, engine:"mediapipe", model:"pose_landmarker_lite"}`
3. `/analyze` on backyard slant returns 33 keypoints/frame, all visibility scores populated
4. Response JSON validates against `CloudRunResponse` shape (no missing required fields)
5. `pixels_per_yard` populated when ≥ 6 frames have shoulder+hip visibility > 0.7
6. Auto-zoom does NOT trigger for backyard slant (athlete already fills frame)
7. Warm `/analyze` on 4s clip completes < 12s end-to-end
8. Old RTMlib service remains live and recoverable via env-var flip

---

### Out of scope for this phase (explicit)

- Renaming `RTMLIB_URL` → `POSE_SERVICE_URL` (Phase 1.5)
- Renaming `logData.rtmlib` → `logData.pose_engine` in Edge Function (Phase 1.5)
- Remapping Slant node `keypoint_indices` from RTMlib (133) to MediaPipe (33) (Phase 1.5)
- Any DB migration
- Any frontend change

