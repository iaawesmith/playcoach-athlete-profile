

## MediaPipe Service Cutover — Minimal Edge Function Update

Wire the deployed Cloud Run MediaPipe service into the existing Edge Function with zero refactor. Three precise changes, then a live smoke test.

---

### Step 1 — Secrets

1. Add new runtime secret `MEDIAPIPE_SERVICE_URL` = `https://mediapipe-service-874407535869.us-central1.run.app`
2. Update existing `RTMLIB_URL` to the same value (so the current code path works instantly even before the dual-read deploys)

Both done via the secrets tool. No code in the repo references the secret value directly — only the names.

---

### Step 2 — Edge Function dual-read

**File:** `supabase/functions/analyze-athlete-video/index.ts`

In `callCloudRun()`, change the single env read to a prioritized chain:

```ts
const base = Deno.env.get('MEDIAPIPE_SERVICE_URL')?.trim()
  || Deno.env.get('RTMLIB_URL')?.trim()
  || RTMLIB_FALLBACK;
```

Nothing else in the function changes:
- Variable names (`base`, `RTMLIB_FALLBACK`, function name `callCloudRun`) stay as-is — full rename comes later.
- Request body, headers, timeout, response parsing untouched.
- No auth header added (service is public on Cloud Run for this cutover; lockdown is a separate task).

---

### Step 3 — Verify no stray `RTMLIB_URL` reads

Grep the whole repo for `RTMLIB_URL`. Expectation: exactly one match — the fallback read inside `callCloudRun()`. If anything else turns up (other edge functions, frontend, scripts), flag it before deploying. Do NOT rename it.

Edge Function auto-deploys on save.

---

### Step 4 — Live smoke test

1. Query the database for the most recent `athlete_uploads` row tagged as the backyard slant clip (filter on `drill_type` / `node_id` / filename).
2. Invoke `analyze-athlete-video` against that upload via the edge function curl tool, OR re-trigger by hitting the function directly with the existing upload ID.
3. Tail `edge_function_logs` for `analyze-athlete-video` during the run.
4. Report back:
   - **MediaPipe response shape**: `frame_count`, `fps`, `keypoints` dimensions (frames × people × 33 × 2), presence of `scores`, calibration block, auto-zoom block, any `warnings` array
   - **End-to-end status**: did the Edge Function write `pipeline_result`, update `status` to `complete`, and feed the Slant scoring node without index-out-of-bounds errors
   - **Errors**: any 4xx/5xx from Cloud Run, any thrown exceptions in edge logs, any landmark-index errors from the (still-RTMlib-indexed) Slant node config

Note on Step 4 outcome: the Slant node's keypoint indices are still on the 133-point COCO-WholeBody schema (audited previously). Smoke test will likely surface index-out-of-bounds on indices ≥ 33. That is expected and informational only — fixing it is the next ticket, not this one.

---

### Out of scope (explicitly not touched)

- `mediapipe-service/app/pose.py`, `schema.py`, `main.py`, `video.py`, `auto_zoom.py`, `calibration.py`
- Slant node `keypoint_indices` in `athlete_lab_nodes`
- Cloud Run IAM / ID token auth
- Variable rename from `RTMLIB_*` → `MEDIAPIPE_*`
- Adding `presence` / world coords to the response schema

---

### Technical details

| Action | Tool |
|---|---|
| Add `MEDIAPIPE_SERVICE_URL` | secrets add_secret |
| Update `RTMLIB_URL` value | secrets update_secret |
| Patch `callCloudRun()` | code--line_replace on `supabase/functions/analyze-athlete-video/index.ts` |
| Verify single reference | code--search_files on `RTMLIB_URL` |
| Find slant upload row | supabase--read_query on `athlete_uploads` |
| Invoke function | supabase--curl_edge_functions to `/analyze-athlete-video` |
| Tail logs | supabase--edge_function_logs for `analyze-athlete-video` |

Approve and I'll execute in that order in one pass.

