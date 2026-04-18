

## Plan: Expand Phase 2 in PipelineSetupTab from 8 → 15 items

### Scope
Single file edit: `src/features/athlete-lab/components/PipelineSetupTab.tsx`, lines **28–40** only (the `CLOUD RUN RTMLIB SERVICE` phase block). Phases 1, 3, and 4 are not touched. No other files, no DB changes, no logic changes — only the `items` array contents change. The shared rendering, state, copy, and persistence logic is unchanged because every new item follows the existing `{ item_id, title, description }` shape and persists into the existing `pipeline_setup_checklist` table by `item_id`.

### ID strategy

**Reused IDs (8) — preserve existing per-user completion state:**

| New # | Reused `item_id` | Notes |
|---|---|---|
| 6 | `dockerfile_created` | description rewritten with python:3.11-slim + libgl1 detail |
| 7 | `fastapi_implemented` | description rewritten with full payload field list + response shape |
| 8 | `dynamic_calibration_implemented` | description rewritten — "basic" version, calls out 30–40% failure rate |
| 9 | `container_pushed` | description rewritten with full Artifact Registry path + first-build timing |
| 10 | `cloud_run_deployed` | description rewritten with gcloud command + 45–60s/clip expectation + GPU upgrade note |
| 11 | `rtmw_model_confirmed` | description rewritten with 30–60s download timing |
| 12 | `wholebody_tested` | description rewritten with specific landmark indices to spot check |
| 14 | `cloud_run_url_added` | description rewritten — explicitly replaces `pending_phase_2` with real URL |

**New IDs (7) — net-new checklist items:**

| New # | New `item_id` | Group |
|---|---|---|
| 1 | `gcp_account_billing` | Prerequisites |
| 2 | `gcp_project_created` | Prerequisites |
| 3 | `gcp_apis_enabled` | Prerequisites |
| 4 | `gcloud_cli_authenticated` | Prerequisites |
| 5 | `artifact_registry_created` | Prerequisites |
| 13 | `cloud_run_isolation_test` | Verification |
| 15 | `e2e_real_upload_test` | Integration |

### Important behavioral notes

- The 5 grouping headings (PREREQUISITES, CORE BUILD, DEPLOYMENT, VERIFICATION, INTEGRATION) you provided are **organizational guides for the spec only**. The existing PipelineSetupTab UI does not render sub-group headings within a phase — items render as a flat list. Adding sub-group rendering would be a UI change you've explicitly excluded ("No other changes."). I will list items in the exact 1→15 order so the visual grouping is preserved by adjacency, even without separator UI. If you want actual visual sub-headers later, that's a separate request.
- `TOTAL_ITEMS` is computed dynamically (`PHASES.reduce(...)`) so progress percentages and the readiness bar update automatically once Phase 2 grows from 8 → 15 items.
- The copy-to-clipboard generators (`generatePhaseCopy`, `generateAllPhasesCopy`) iterate items generically, so they work without modification.
- Existing user completion state for the 8 reused IDs is preserved (rows in `pipeline_setup_checklist` are keyed by `item_id`). Descriptions changing does not lose prior `completed` state. The 7 new IDs simply have no row yet → render as incomplete.

### The replacement block

The new lines 28–40 (the entire `CLOUD RUN RTMLIB SERVICE` phase object) become:

```ts
{
  name: "CLOUD RUN RTMLIB SERVICE",
  items: [
    // PREREQUISITES (Google Cloud Setup)
    { item_id: "gcp_account_billing", title: "Google Cloud account and billing enabled", description: "Create Google Cloud account (or use existing). Enable billing on the account with a credit card. Set a monthly budget alert at $50 to avoid surprise charges during development. Required before any deployment work begins." },
    { item_id: "gcp_project_created", title: "Google Cloud project created", description: "Create a new Google Cloud project named 'playcoach-pipeline' (or similar). Note the project ID — required for all gcloud commands. Consider using region us-central1 as the default location for resources." },
    { item_id: "gcp_apis_enabled", title: "Required Google Cloud APIs enabled", description: "Enable three APIs from the GCP Console or via gcloud command: Cloud Run API, Artifact Registry API, and Cloud Build API. Each is a single click or a single command. Required before attempting any deployment." },
    { item_id: "gcloud_cli_authenticated", title: "gcloud CLI installed and authenticated", description: "Install Google Cloud SDK on local machine. Run 'gcloud auth login' to authenticate. Run 'gcloud config set project [project-id]' to lock in the project. Also install Docker Desktop if not already installed — required for building the container image locally." },
    { item_id: "artifact_registry_created", title: "Artifact Registry repository created", description: "Create Docker repository in Artifact Registry to store the container image. Command: gcloud artifacts repositories create playcoach-rtmlib --repository-format=docker --location=us-central1 --description=\"RTMW pose estimation service for PlayCoach\"" },

    // CORE BUILD (Application Code)
    { item_id: "dockerfile_created", title: "Dockerfile created", description: "Container with rtmlib, onnxruntime-gpu, numpy, opencv-python-headless, fastapi, uvicorn, yt-dlp, ffmpeg. Full spec in Implementation Docs → Cloud Run card. Based on python:3.11-slim. Install system dependencies for yt-dlp and OpenCV (libgl1, libglib2.0-0)." },
    { item_id: "fastapi_implemented", title: "FastAPI service implemented", description: "POST /analyze endpoint accepts video_url, start_seconds, end_seconds, solution_class, performance_mode, det_frequency, and tracking_enabled in JSON body. Downloads the clip via yt-dlp, runs rtmlib PoseTracker, returns keypoints (3D array), scores (3D array), frame_count, and fps in JSON response." },
    { item_id: "dynamic_calibration_implemented", title: "Dynamic field line calibration implemented (basic)", description: "Ship the basic version first, iterate after real athlete data. Use cv2.Canny edge detection on first 10 frames → HoughLinesP to detect horizontal line segments → filter for lines spanning frame width → measure pixel distance between consecutive detected lines → divide by 5 (yard spacing) → return pixels_per_yard. Fall back to node's static reference_calibrations value if detection fails. Expect 30-40% detection failure rate in first iteration — tune thresholds after first 20 analyses." },

    // DEPLOYMENT (Push to Production)
    { item_id: "container_pushed", title: "Container built and pushed to Artifact Registry", description: "Docker build local image with version tag. Push to Artifact Registry: us-central1-docker.pkg.dev/[project-id]/playcoach-rtmlib/rtmlib-service:v1. First build takes 10-15 minutes due to onnxruntime and opencv dependencies. Subsequent builds benefit from layer caching." },
    { item_id: "cloud_run_deployed", title: "Cloud Run service deployed (CPU)", description: "Start with CPU deployment to validate pipeline end-to-end before optimizing for speed. Command: gcloud run deploy rtmlib-service --image=[image-url] --memory=8Gi --cpu=4 --timeout=300 --region=us-central1 --allow-unauthenticated. Expected performance: 45-60 seconds per 10-second clip. Note the service URL from deploy output — required for step 14. Upgrade to GPU (L4) after first 50 real analyses if faster processing is needed for UX." },

    // VERIFICATION (Test Before Wiring)
    { item_id: "rtmw_model_confirmed", title: "RTMW model download confirmed on first request", description: "First request to Cloud Run triggers auto-download of RTMW ONNX weights from model zoo. Confirm via Cloud Run logs that model loads without error. Expected download time: 30-60 seconds on first request. Subsequent requests use cached model." },
    { item_id: "wholebody_tested", title: "Wholebody solution class tested with sample frame", description: "Test with a known good video frame. Confirm response includes keypoints[person][index] returning [x, y] coordinates for all 133 indices (0-132). Verify scores array returns confidence values in 0-1 range. Spot check specific landmarks: left hip (11), right hip (12), left heel (19), nose (0), left index fingertip (99)." },
    { item_id: "cloud_run_isolation_test", title: "Cloud Run endpoint tested in isolation", description: "Before wiring to Edge Function, test Cloud Run independently via curl with the Slant Route reference video. Confirms service is functional in isolation. Prevents scenario where bad Cloud Run breaks the live pipeline with no easy rollback. Expected response includes keypoints, scores, frame_count, and fps. Curl command in Implementation Docs." },

    // INTEGRATION (Go Live)
    { item_id: "cloud_run_url_added", title: "Cloud Run URL added to Edge Function config", description: "Update the RTMLIB_URL secret in Supabase Edge Function secrets. Replace current placeholder value 'pending_phase_2' with the real Cloud Run service URL from step 10. This is the moment the pipeline goes live end-to-end." },
    { item_id: "e2e_real_upload_test", title: "End-to-end pipeline test with real upload", description: "Run the same test INSERT as Phase 1 verification. Expect status to reach 'complete' (not 'failed') with: rtmlib returning keypoints, metrics calculated, Claude feedback generated, and athlete_lab_results row written. If any step fails, debug individually. This test is the official signal that Phase 2 is complete and the full pipeline is operational." },
  ],
},
```

### What I will NOT do
- No edits to Phase 1 (`SUPABASE INFRASTRUCTURE`), Phase 3 (`EDGE FUNCTION LOGIC`), or Phase 4 (`END-TO-END TESTING`).
- No DB migrations. No changes to `pipeline_setup_checklist` schema.
- No changes to UI rendering, group separators, copy-generator logic, or styling.
- No edits to the Implementation Docs tab (mentioned in some descriptions but already has its own card).

### Files touched
- `src/features/athlete-lab/components/PipelineSetupTab.tsx` (lines 28–40 only)

### Risks
- Minimal. Pure data change. Existing checklist completion state for the 8 reused IDs is preserved automatically because rows are keyed by `item_id`. The dynamic `TOTAL_ITEMS` calculation absorbs the count change without UI math edits.

