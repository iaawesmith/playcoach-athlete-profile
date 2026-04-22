
Increase the pipeline rerun wait window to 240 seconds, confirm the Edge Function is not imposing a shorter timeout, then rerun the same Slant Route end-to-end test and verify the full pipeline completes.

### Confirmed audit results

#### 1) Current Edge Function fetch timeout
In `supabase/functions/analyze-athlete-video/index.ts`, `callCloudRun()` currently does:

```ts
response = await fetch(rtmlibUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})
```

Confirmed:
- there is no `AbortController`
- there is no custom fetch timeout
- there is no shorter in-code timeout than 240 seconds

Conclusion:
- the function code itself is not cutting the Cloud Run call off early

#### 2) Current function config
In `supabase/config.toml`, the `analyze-athlete-video` block currently has only:

```toml
[functions.analyze-athlete-video]
verify_jwt = false
```

Confirmed:
- there is no explicit function timeout configured in the repo today
- if the deployed backend has a runtime timeout under 240 seconds, it is coming from platform/runtime settings rather than this checked-in config

#### 3) Where the previous “120-second hang” came from
I did not find a 120-second timeout constant in the codebase for the AthleteLab pipeline flow.

Conclusion:
- the 120-second limit appears to be from the operational test/polling workflow used during reruns, not from the checked-in frontend or Edge Function source
- increasing the rerun wait window is still necessary, but that change is in the execution/test procedure rather than the React codebase

### Execution plan

#### Step 1 — Confirm backend timeout ceiling before rerun
Before running the test:
- inspect the deployed `analyze-athlete-video` function settings/log behavior using backend tooling
- verify the backend runtime allows at least 240 seconds for this execution
- if the deployed function timeout is below 240 seconds, raise it to at least 240 seconds before testing

Target:
- effective runtime budget must exceed the observed Cloud Run duration of ~121 seconds with safe buffer

#### Step 2 — Keep `callCloudRun()` timeout-free unless audit proves otherwise
Because the current code has no manual abort logic:
- no fetch-timeout code change is expected unless a hidden runtime/platform issue is discovered
- if a code-level timeout guard exists elsewhere at deploy/runtime level, align it to at least 240 seconds

#### Step 3 — Increase the pipeline test wait window to 240 seconds
Update the rerun procedure so the test harness waits up to 240 seconds for completion instead of 120.

Scope of this step:
- use the same operational test flow as before
- do not change the node config, video, or metric logic
- only extend the polling/wait budget so the run is not marked failed while Cloud Run is still processing

#### Step 4 — Re-run the same end-to-end pipeline flow
Run the same Slant Route test flow as before:
- same node
- same reference/test video
- same analysis context / test setup
- same upload-triggered pipeline path

#### Step 5 — Verify logs for successful progression
Inspect the full execution for:
- `pipeline_started`
- `cloud_run_response_received`
- `phase_windows_built`
- `metric_window_selected`
- `metric_scored`
- `claude_feedback_received`
- `results_written`
- `pipeline_completed`

Specific checks:
- Cloud Run response arrives successfully after the longer wait
- `phase_windows_built` contains real numeric frame ranges
- all six metrics reach `metric_scored` with real values rather than skip/fail states
- Claude feedback is generated
- results write succeeds

#### Step 6 — Verify database outcome
Confirm the new run writes:
- `athlete_lab_results.aggregate_score`
- `athlete_lab_results.phase_scores`
- `athlete_lab_results.metric_results`
- `athlete_lab_results.feedback`
- `athlete_lab_results.detected_errors`
- `athlete_lab_results.confidence_flags`
- `athlete_lab_results.analyzed_at`

Also confirm:
- `athlete_uploads.status = 'complete'`

### Expected outcome
After the longer wait window and timeout verification:
- the test will no longer be declared stalled at ~120 seconds
- Cloud Run will have enough time to return normally
- normalized phase data should allow valid phase windows
- all 6 metrics should compute with real values
- Claude should return actual coaching feedback
- the upload should finish as `complete`
