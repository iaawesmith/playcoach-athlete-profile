# Pipeline Trace — One Upload, INSERT to Result Row

> **Purpose:** Walk a single upload from athlete-side INSERT to written result row, with file:line citations. The canonical "how does this actually work" reference for Phase 2 work.
>
> **Audience:** Phase 2a/2b/2c agents who need to reason about where calibration, metrics, scoring, or LLM behaviour is implemented; debugging agents tracing a failed run; new contributors reverse-engineering the pipeline.
>
> **Created:** 2026-04-30 (PHASE-1C3-PREP). Companion to [`system-overview.md`](system-overview.md). For the Athlete-Lab-scoped deeper dive see [`athlete-lab-end-state-architecture.md`](athlete-lab-end-state-architecture.md).

> **Maintenance contract:** Line numbers in this doc cite the state of the repo at 2026-04-30 (post-Phase-1c.3 close). When edits to `analyze-athlete-video/index.ts` or `mediapipe-service/app/main.py` shift line numbers materially, update the citations in the same change. The shape of the steps is durable; the line numbers are not.

---

## Step 0 — Athlete uploads a clip

Client uploads the video file to a Supabase Storage bucket. The upload form/component then INSERTs a row into `athlete_uploads` with `node_id`, `athlete_id`, `video_url`, `start_seconds`, `end_seconds`, `analysis_context` (camera angle, route direction, people in video, catch included), and `status='pending'`.

Edge functions that participate in upload prep:
- `supabase/functions/admin-create-athlete-upload/index.ts` — admin path
- `supabase/functions/admin-test-upload/index.ts` — admin smoke-test path

---

## Step 1 — DB webhook invokes the analyzer

A database webhook on `athlete_uploads` INSERT calls the `analyze-athlete-video` edge function with the inserted row in the request body.

- **File:** `supabase/functions/analyze-athlete-video/index.ts`
- **Entry point:** `Deno.serve(async (req) => { ... })` at line 607
- **Payload contract:** `{ record: { id, node_id, athlete_id, video_url, start_seconds, end_seconds, analysis_context, ... } }`
- **First DB write:** `updateUploadStatus(upload.id, 'processing', ...)` at line 633

---

## Step 2 — Fetch node config + preflight

The edge function loads the full node row from `athlete_lab_nodes` and runs preflight validation (clip duration, required fields, calibration availability for the camera angle).

- **Fetch:** `fetchNodeConfig(upload.node_id)` at line 638 (definition at line 908)
- **Preflight:** `runPreflight(upload, nodeConfig)` at line 651
- **Failure path:** `updateUploadStatus(upload.id, 'failed', preflightResult.reason)` at line 658 → 400 response

Preflight failures terminate the pipeline before any Cloud Run cost is incurred.

---

## Step 3 — Resolve detection-frequency scenario + select static calibration

Detection frequency is per-scenario (solo / defender / multiple) with optional break-override. Static calibration is selected by camera angle from the node's calibration table. Both decisions are logged for audit.

- **Detection frequency:** `resolveDetectionFrequency(nodeConfig, context)` at line 670
- **Static calibration selection:** `selectCalibration(nodeConfig, context.camera_angle || upload.camera_angle)` at line 671
- **Audit log:** `logInfo('analysis_context_selected', ...)` at line 672

The scenario decision is the locus of risk R-06 (`det_frequency_defender`/`_multiple` deletion) and was the subject of the 1c.2-Slice-B1 parity verification.

---

## Step 4 — POST to Cloud Run mediapipe-service

The edge function POSTs a 4-key payload (`video_url`, `start_seconds`, `end_seconds`, `det_frequency`) to the Cloud Run service over an NDJSON streaming connection. Keepalive lines prevent the GFE 30s idle-byte timeout from killing long pipelines.

### Edge-function side

- **Call:** `callCloudRun({...})` at line 695
- **Implementation:** `callCloudRun()` definition starts at line 3445; the actual `fetch(rtmlibUrl, ...)` is at line 3484
- **Timeout:** `CLOUD_RUN_FETCH_TIMEOUT_MS = 300_000` (5 min) at line 3443
- **NDJSON stream parsing:** lines 3540–3580 handle keepalive vs result vs error frames
- **Contract canary:** comment at line 3473 — "If the contract drifts, this is the canary"

### Cloud Run side

- **File:** `mediapipe-service/app/main.py`
- **Entry point:** `@app.post("/analyze")` at line 219; handler `analyze(req)` at line 220
- **NDJSON stream wrapper:** `stream()` async generator at line 252; emits `keepalive` every `KEEPALIVE_INTERVAL_S`, then a single `result` or `error` line
- **Pipeline build:** `_build_response(req)` at line 57 (calls into `pose.py`, `calibration.py`, `auto_zoom.py`)
- **Pose estimation:** `mediapipe-service/app/pose.py` (RTMlib invocation; 153 lines)
- **Dynamic calibration:** `mediapipe-service/app/calibration.py` (line-pair detection; 90 lines) — produces `body_based_ppy`, `good_line_pairs`, `pixels_per_yard` returned in response

Cloud Run returns: `keypoints` (per-frame, per-person), `scores` (confidence), `frame_count`, `fps`, `body_based_ppy`, calibration metadata.

---

## Step 5 — Temporal smoothing + target-person lock

Edge function applies smoothing to the keypoints, then locks onto the single target person (necessary when multiple people are in frame).

- **Smoothing:** `applyTemporalSmoothing(rtmlibResult.keypoints, rtmlibResult.scores, nodeConfig)` at line 733
- **Person lock:** `lockTargetPerson(smoothedKeypoints, context.people_in_video)` at line 740
- **Frame isolation:** `isolateTrackedPersonFrames(...)` at line 749

---

## Step 6 — Calibration resolution → `calibration_audit`

`resolveCalibration()` produces both the final `pixelsPerYard` used by metrics AND the `calibration_audit` record that lands in `result_data`. This is the ADR-0014 contract: the audit always carries both dynamic and body-based candidate ppy values for cross-clip ground-truth comparison, even when only one source is selected.

- **Call site:** lines 747–755 (passes `rtmlibResult`, tracked-person frames, athlete height, node config, camera angle)
- **Definition:** `function resolveCalibration(...)` at line 1471
- **Selection priority:** `dynamic → body_based → static → none` (lines 1517+)
- **Body-based shadow computation:** lines 1499–1505 (unconditional, even when not selected — Slice C.5 behaviour)
- **Audit assembly:** lines 1607–1648 — explicit key order to keep `result_data.calibration_audit` deterministic; `body_based_ppy` lands at line 1638
- **Audit log line:** `logInfo('calibration_audit', audit)` at line 1648

The ~0.78% non-deterministic drift observed across identical-input runs (F-SLICE-E-2) is attributed to upstream pose-estimation variance feeding into this resolver, not to the resolver itself.

---

## Step 7 — Metrics + scoring + error detection

Metric formulas execute against the smoothed/locked keypoints with the resolved ppy. Scoring rules aggregate metric results into per-phase + aggregate scores. Error definitions check for known failure patterns.

- **Metric resolution:** `metricResults` array; produced by metric runner (search for `runMetrics` / metric registry in the same file)
- **Scoring:** `scoreResult` with `phase_scores` and `aggregate_score`
- **Errors:** `errorResults.detected[]`

(Specific line numbers omitted here — these are large blocks in the 3700-line edge function; locate by symbol search.)

---

## Step 8 — Build Claude prompt + call Lovable AI Gateway

Prompt assembly substitutes node config variables (`{{phase_context}}`, etc.) into the template, then POSTs to Anthropic via Lovable AI Gateway.

- **Skip path (low confidence):** lines 833–840 — `claude_skipped_low_confidence` log; no API call
- **Call:** `callClaude(nodeConfig, scoreResult, metricResults, errorResults, upload, context)` at line 850
- **Implementation:** `callClaude()` definition; the actual `fetch('https://api.anthropic.com/v1/messages', ...)` at line 3350
- **Model pin:** `'claude-sonnet-4-5'` at lines 835 and 3358
- **Request log:** `logInfo('claude_request_prepared', ...)` at line 3340
- **Response log:** `logInfo('claude_response_received', ...)` at line 3375
- **Token accounting:** lines 3413–3415

Returns: `feedback` paragraph + `claudeLog` for the audit record.

---

## Step 9 — Write `athlete_lab_results`

Edge function INSERTs the result row with all collected data, then marks the upload complete.

- **Write call:** `writeResults(upload, nodeConfig, scoreResult, metricResults, errorResults, feedback, logData, cloudRunMetadata, calibrationAudit)` at line 862
- **Definition:** `writeResults()` at line 3595
- **Insert target:** `from('athlete_lab_results').insert({ ... })` at line 3607
- **`result_data` shape:** lines 3617–3621 — spreads `cloudRunMetadata`, then attaches `log_data` and `calibration_audit`
- **Confidence flags:** lines 3623–3625 — derived from metric statuses
- **Detected errors:** line 3626

---

## Step 10 — Mark upload complete

- **Status update:** `updateUploadStatus(upload.id, 'complete', undefined, 'Analysis complete')` at line 870
- **Final log:** `logInfo('pipeline_completed', ...)` at line 871
- **Definition of `updateUploadStatus`:** line 3649

### Failure path

The outer `catch` at line 875+ marks the upload `failed` with the error message (line 891) unless the error is the explicit `UPLOAD_CANCELLED` cancellation code (line 880), in which case status is set to `cancelled` separately.

---

## Cross-references

- [`system-overview.md`](system-overview.md) — system-level mental model (this doc is the next layer down)
- [`athlete-lab-end-state-architecture.md`](athlete-lab-end-state-architecture.md) — Athlete-Lab-scoped deeper dive
- [ADR-0014](../adr/0014-c5-unified-edge-function-body-based-path.md) — `calibration_audit` contract
- [ADR-0009](../adr/0009-mediapipe-on-cloud-run.md) — Cloud Run deployment
- [ADR-0003](../adr/0003-lovable-ai-gateway-default-llm.md) — LLM gateway choice
- [ADR-0005](../adr/0005-determinism-tolerance-1pct.md) — ±1% multi-run tolerance applied to the metrics this pipeline produces
- [`../risk-register/F-SLICE-E-2-pipeline-calibration-audit-shows-0-78-non-deterministic-drift-on-identical.md`](../risk-register/F-SLICE-E-2-pipeline-calibration-audit-shows-0-78-non-deterministic-drift-on-identical.md) — current determinism finding tied to step 6
- [`../investigations/calibration-source-trace.md`](../investigations/calibration-source-trace.md) — historical investigation feeding the ADR-0014 design
