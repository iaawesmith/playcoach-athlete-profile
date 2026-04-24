

## Recreate `mediapipe-service/` — clean slate

Wipe the existing folder and rebuild with exactly 8 files. Drop `motion.py`, include empty `__init__.py`, use `urllib` + `cv2.VideoCapture` only.

---

### Step 1 — Wipe

```bash
rm -rf mediapipe-service
```

### Step 2 — Recreate exactly these 8 files

| Path | Contents |
|---|---|
| `mediapipe-service/Dockerfile` | `python:3.11-slim`, installs `ffmpeg` + `libgl1` + `libglib2.0-0` + `curl`, pip installs `requirements.txt`, pre-bakes `pose_landmarker_lite.task` from Google CDN into `/app/models/`, runs `uvicorn app.main:app --host 0.0.0.0 --port 8080`. No rtmlib, no torch, no onnxruntime, no httpx, no ffmpeg-python. |
| `mediapipe-service/requirements.txt` | `fastapi==0.115.0`, `uvicorn[standard]==0.30.6`, `mediapipe==0.10.18`, `opencv-python-headless==4.10.0.84`, `numpy==1.26.4`. Nothing else. |
| `mediapipe-service/app/__init__.py` | Empty file. |
| `mediapipe-service/app/main.py` | FastAPI app. `GET /health` → `{ok:true, engine:"mediapipe", model:"pose_landmarker_lite"}`. `POST /analyze` orchestrates: validate → download → decode → auto-zoom → pose loop → reverse-map → calibration → assemble response. **Hard-codes `movement_direction="stationary"` and `movement_confidence=0.0`** in the response. |
| `mediapipe-service/app/schema.py` | Pydantic `AnalyzeRequest` + `AnalyzeResponse` matching the Edge Function `CloudRunResponse` contract exactly (keypoints, scores, calibration_*, auto_zoom_*, movement_*, progress_updates, etc.). |
| `mediapipe-service/app/video.py` | `urllib.request` stream download to `/tmp/<uuid>.mp4` (200 MB cap). `cv2.VideoCapture` to read frames, trimmed to `[start_seconds, end_seconds]` and resampled to 30 fps. Returns `(frames: list[np.ndarray], width: int, height: int)`. |
| `mediapipe-service/app/pose.py` | `PoseEngine` class wrapping MediaPipe `PoseLandmarker` (Lite, 33 landmarks) loaded from `/app/models/pose_landmarker_lite.task`. `run_with_skip(engine, frames, det_frequency)` runs detection every Nth frame, forward-fills skipped frames. Returns per-frame `keypoints[33]=[x,y]` (pixel coords) and `scores[33]=visibility`. |
| `mediapipe-service/app/auto_zoom.py` | 6-frame sample. Computes `bbox_area / frame_area`. Skip if ≥ 0.30. Otherwise crop centered on median hip, factor capped at **1.75x**, pads to original aspect. `reverse_map_landmarks` returns coords in original video space. Safety-backoff if mean confidence drops post-zoom. |
| `mediapipe-service/app/calibration.py` | Body-based `pixels_per_yard` from shoulder (11,12) + hip (23,24) widths. Median of frames where all four landmarks have visibility > 0.7. Anthropometric averages: shoulder ≈ 0.45 yd, hip ≈ 0.32 yd. Returns `(pixels_per_yard, confidence_label, details_dict)`. |

**Files NOT recreated** (per spec): `motion.py`, `README.md`, `.dockerignore`.

### Step 3 — Verify

```bash
ls -la mediapipe-service
ls -la mediapipe-service/app
cat mediapipe-service/Dockerfile | head -30
```

---

### Final tree

```text
mediapipe-service/
├── Dockerfile
├── requirements.txt
└── app/
    ├── __init__.py
    ├── main.py
    ├── schema.py
    ├── video.py
    ├── pose.py
    ├── auto_zoom.py
    └── calibration.py
```

---

### Response contract preserved

Edge Function still receives identical JSON shape. `movement_direction` always `"stationary"`, `movement_confidence` always `0.0` until motion logic is reintroduced (future phase).

### Untouched

- `supabase/functions/analyze-athlete-video/index.ts`
- `supabase/migrations/`
- All DB rows
- Frontend (`src/**`)
- Old RTMlib Cloud Run service (env-var rollback path intact)

