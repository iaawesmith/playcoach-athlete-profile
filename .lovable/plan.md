
Apply the three requested fixes in `supabase/functions/analyze-athlete-video/index.ts`, redeploy the function, then rerun the same Slant Route end-to-end test with a 240-second operational wait window and inspect the resulting logs and database rows.

### Confirmed audit results

- `writeResults()` currently inserts:
  - `node_version: upload.node_version`
- `checkConfidence()` currently requires:
  - `(passedChecks / totalChecks) >= 0.6`
- `callClaude()` currently:
  - builds the prompt
  - sends it to Anthropic
  - returns `data.content?.[0]?.text || ''`
  - does not log prompt preview, raw response, or parse/JSON failure details
- `callCloudRun()` still has no manual fetch timeout or `AbortController`
- `supabase/config.toml` still has no explicit timeout override for `analyze-athlete-video`
- The 240-second wait is an operational rerun budget, not a frontend code constant found in the repo

### Code changes to make

#### Fix 1 — node_version write-path
In `writeResults()` change:
```ts
node_version: upload.node_version,
```
to:
```ts
node_version: nodeConfig.node_version,
```

Result:
- the results row records the version of the node that actually executed analysis

#### Fix 2 — lower confidence pass ratio
In `checkConfidence()` change:
```ts
return totalChecks === 0 || (passedChecks / totalChecks) >= 0.6
```
to:
```ts
return totalChecks === 0 || (passedChecks / totalChecks) >= 0.4
```

Result:
- metrics will pass confidence gating when at least 40% of keypoint checks meet threshold

#### Fix 3 — Claude diagnostic logging
Enhance `callClaude()` with structured logs for:
- prompt preview:
  - first 500 chars
  - prompt length
  - node name / upload id if available
- raw Claude HTTP outcome:
  - response status
  - response body text or parsed object
- parse handling:
  - explicit logging for invalid JSON / unexpected response structure
- empty feedback cases:
  - log when API succeeds but extracted text is empty

Planned logging events:
- `claude_request_prepared`
- `claude_response_received`
- `claude_response_parse_failed`
- `claude_response_empty`
- `claude_request_failed`

Important detail:
- keep logs structured and truncated so they are diagnostic without flooding excessively
- use preview/truncation for the prompt rather than dumping unlimited text

### Deployment and test execution plan

#### Step 1 — update and redeploy the edge function
After editing `supabase/functions/analyze-athlete-video/index.ts`:
- deploy `analyze-athlete-video`
- keep existing function config unless deployment/runtime inspection proves a backend timeout change is required

#### Step 2 — run the same end-to-end pipeline test
Use the same test flow as the last rerun:
- same live node
- same reference video
- same upload-triggered path
- same 240-second wait budget

#### Step 3 — collect the full execution evidence
After rerun, pull:
- full `analyze-athlete-video` logs for that run, including the new Claude diagnostic events
- final `athlete_uploads` row
- final `athlete_lab_results` row

### What to verify in the rerun

#### Pipeline progression
Confirm logs show:
- `pipeline_started`
- `cloud_run_response_received`
- `phase_windows_built`
- `metric_window_selected`
- `metric_scored`
- `claude_response_received` / equivalent diagnostic event
- `claude_feedback_received`
- `results_written`
- `pipeline_completed`

#### Database output
Confirm:
- `athlete_uploads.status = 'complete'`
- `athlete_lab_results.node_version = nodeConfig.node_version`
- `aggregate_score` is non-null
- `phase_scores` is populated
- `metric_results` contains materially more scored metrics than before
- `feedback` contains real coaching text, not empty string

### Expected outcome
After these three fixes and the rerun:
- at least 4–6 metrics should score successfully, depending on catch-related exclusions
- aggregate score should be non-null and plausibly land in the expected range
- phase scores should populate
- Claude logging should make prompt/response behavior diagnosable
- the stored results row should reflect the actual analyzed node version, not the upload-time version

### Technical notes
- No database migration is needed for these three fixes
- No frontend code change is required for the 240-second wait unless you specifically want that surfaced in the UI later
- If the rerun still produces empty Claude feedback after these logs are added, the next change should target Claude response extraction/format handling rather than blind prompt edits
