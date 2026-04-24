

## Verify and finalize `mediapipe-service/` (read-only audit + fix plan)

Currently in plan mode, so I'll lay out exactly what needs to happen, then execute on approval. The folder already exists in the repo from the previous build — this plan confirms the contents are correct and lists any fixes needed.

---

### Audit (from current repo state shown in `<current-code>`)

The repo already contains:

```text
mediapipe-service/
├── Dockerfile               ✅ correct (MediaPipe-only, pre-bakes pose_landmarker_lite.task)
├── requirements.txt         ✅ correct (5 deps, no rtmlib/torch/httpx/ffmpeg-python)
└── app/
    ├── __init__.py          ✅ empty marker
    ├── main.py              ✅ /health + /analyze, hard-codes movement_direction="stationary"
    ├── schema.py            ✅ AnalyzeRequest + AnalyzeResponse
    ├── video.py             ✅ urllib + cv2.VideoCapture only
    ├── pose.py              ⚠️ visible in repo, but `run_with_skip` + `LANDMARK_COUNT` are imported by main.py — need to confirm they exist
    ├── auto_zoom.py         ⚠️ visible in repo, need to confirm `decide_and_apply` + `reverse_map_landmarks` signatures match main.py
    └── calibration.py       ✅ correct (body-based shoulder/hip)
```

**Files NOT present (correct per spec):** `motion.py`, `README.md`, `.dockerignore`, `models/` (model is downloaded at Docker build time).

So the structure is already exactly the 8 files you asked for. The remaining risk is whether `pose.py` and `auto_zoom.py` exactly match the imports in `main.py`. I'll read both before doing anything.

---

### Step 1 — Verify `pose.py` and `auto_zoom.py` (read-only)

Open both files and confirm:
- `pose.py` exports: `LANDMARK_COUNT`, `PoseEngine` (context manager), `PoseFrame` (dataclass with `detected: bool`, `keypoints: list[list[float]]`, `scores: list[float]`), `run_with_skip(engine, frames, det_frequency) -> list[PoseFrame]`
- `auto_zoom.py` exports: `decide_and_apply(engine, frames, width, height) -> tuple[list[np.ndarray], ZoomInfo]`, `reverse_map_landmarks(pose_results, zoom, width, height) -> list[PoseFrame]`, and a `ZoomInfo` object with fields `applied`, `reason`, `factor`, `final_fill_ratio`, `crop_rect`, `padding`, `safety_backoff`, `mean_conf_before`, `mean_conf_after`

If anything is missing or signatures don't match, rewrite the affected file(s) so `main.py` imports cleanly.

### Step 2 — Verify (run shell on approval)

```bash
cd mediapipe-service && ls -la
cd mediapipe-service && ls -la app
cd mediapipe-service && head -25 Dockerfile
```

Show output for confirmation.

### Step 3 — Touch nothing else

- No edits to `supabase/functions/**`
- No DB migrations
- No frontend changes
- No new files beyond the 8 already listed

---

### What I'll change (only if Step 1 reveals a mismatch)

| File | Possible fix |
|---|---|
| `mediapipe-service/app/pose.py` | Rewrite to expose `LANDMARK_COUNT=33`, `PoseEngine`, `PoseFrame`, `run_with_skip` matching `main.py` usage |
| `mediapipe-service/app/auto_zoom.py` | Rewrite to expose `decide_and_apply` + `reverse_map_landmarks` + `ZoomInfo` dataclass matching `main.py` usage |

If both files already match, no edits — just run the verification commands.

---

### Approval request

Approve and I will:
1. Read `pose.py` and `auto_zoom.py`
2. Patch only the file(s) where signatures don't match `main.py`
3. Run the three verification shell commands and paste the output

