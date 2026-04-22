
Update the Claude model alias in `supabase/functions/analyze-athlete-video/index.ts`, redeploy the function, then rerun the same Slant Route end-to-end pipeline and verify Claude feedback now completes successfully.

### Confirmed code audit results

- In `callClaude()` the request body currently sends:
  ```ts
  model: 'claude-sonnet-4-20250514'
  ```
- The Claude diagnostic logging added earlier is already present, including:
  - `claude_request_prepared`
  - `claude_response_received`
  - `claude_response_parse_failed`
  - `claude_request_failed`
  - `claude_response_empty`
- `supabase/config.toml` contains:
  ```toml
  [functions.analyze-athlete-video]
  verify_jwt = false
  ```
  and no repo-level timeout override.
- `TestingPanel.tsx` does not contain a hardcoded 120s/240s pipeline timeout; the longer wait is an operational rerun budget, not a UI constant.

### Exact code change

In `supabase/functions/analyze-athlete-video/index.ts`, inside `callClaude()`, change:

```ts
model: 'claude-sonnet-4-20250514'
```

to:

```ts
model: 'claude-sonnet-4-5'
```

Result:
- the function uses Anthropic’s current Sonnet 4.5 alias instead of the outdated date-stamped identifier that is returning 404

### Deployment and verification plan

#### Step 1 — apply the model ID fix
Update only the Claude model identifier in `callClaude()` and leave the existing request/diagnostic logging intact.

#### Step 2 — redeploy `analyze-athlete-video`
Redeploy the edge function so the alias change is live.

#### Step 3 — rerun the same end-to-end test flow
Run the same Slant Route pipeline flow as before:
- same live node
- same reference video
- same upload-triggered path
- same 240-second operational wait budget

#### Step 4 — inspect logs for Claude success
Pull the full `analyze-athlete-video` logs for that rerun and verify:
- `pipeline_started`
- `cloud_run_response_received`
- `phase_windows_built`
- `metric_scored`
- `claude_request_prepared`
- `claude_response_received`

Specific Claude checks:
- `claude_response_received.status = 200`
- raw response body contains real Claude content rather than 404 error JSON
- no `claude_request_failed` due to invalid model
- no empty-feedback path unless the response body itself is malformed

#### Step 5 — verify database rows
Read the final rows for the rerun and confirm:
- `athlete_uploads.status = 'complete'`
- `athlete_lab_results.aggregate_score` is non-null
- `athlete_lab_results.phase_scores` is populated
- `athlete_lab_results.metric_results` is populated
- `athlete_lab_results.feedback` contains actual coaching text
- `athlete_lab_results.node_version` still reflects the analyzed node version

### Expected outcome
After the alias update:
- Claude should stop returning 404 for the model
- `claude_response_received` should show HTTP 200
- feedback should contain real coaching text
- the final `athlete_lab_results` row should be complete with score, phase breakdown, metric results, and feedback

### Technical note
No database migration is needed for this fix. This is a single edge-function code update plus redeploy/rerun verification.
