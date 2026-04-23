
Fix the missing Analysis Log by wiring `log_data` through the production pipeline end-to-end. Right now the UI is behaving correctly: the data simply is not being persisted or returned.

### Why it is not populating

The production Run Analysis flow currently drops the log payload in multiple places:

1. `AnalysisLog` expects `result?.log_data`
   - `TestingPanel.tsx` passes `result?.log_data` into `AnalysisLog`
   - `AnalysisLog.tsx` shows the empty-state warning when that field is missing

2. The frontend result normalizer never maps `log_data`
   - `src/services/athleteLab.ts`
   - `normalizePipelineResult()` returns score/metrics/errors/feedback, but no `log_data`

3. The result-fetching Edge Function never selects or returns it
   - `supabase/functions/admin-get-pipeline-result/index.ts`
   - `selectClause` excludes both `log_data` and `result_data`
   - response payload returns no `log_data`

4. The production analysis Edge Function never persists it
   - `supabase/functions/analyze-athlete-video/index.ts`
   - `writeResults()` inserts aggregate score, metrics, flags, errors, and feedback
   - it does not insert any structured pipeline log into `athlete_lab_results`

So the immediate root cause is: the pipeline log is neither saved nor returned.

### What to build

Implement a structured `log_data` object in the production analysis flow and return it with each completed result so the Analysis Log panel can render the full debugging view.

### Implementation steps

1. Build a structured pipeline log inside `analyze-athlete-video`
   - Add a `logData` accumulator matching the frontend `AnalysisLogData` shape:
     - `timestamp`
     - `preflight`
     - `rtmlib`
     - `metrics`
     - `aggregate`
     - `error_detection`
     - `claude_api`
   - Populate it from values already available in the function:
     - preflight checks from `runPreflight()`
     - Cloud Run metadata (`frame_count`, `fps`, calibration/progress context)
     - phase windows from `buildPhaseWindows()`
     - metric evaluation details from `metricResults`
     - aggregate score summary from `scoreResult`
     - detected errors from `errorResults`
     - Claude prompt/response metadata already being logged server-side

2. Persist the log with the result row
   - Reuse the existing `athlete_lab_results.result_data` JSON column for backward-compatible storage
   - Save a structured payload such as:
     ```text
     {
       log_data: { ...full structured pipeline log... }
     }
     ```
   - This avoids requiring a schema change unless a dedicated `log_data` column is preferred later

3. Return the log from `admin-get-pipeline-result`
   - Expand `selectClause` to include `result_data`
   - Extract `log_data` from `result_data`
   - Return it in the function response as:
     - `result.log_data`
   - Keep all current fields unchanged

4. Map the log in the frontend service layer
   - Update `normalizePipelineResult()` in `src/services/athleteLab.ts`
   - Read `row.log_data` if returned directly
   - Fallback to `row.result_data?.log_data` for compatibility
   - Assign it to `PipelineAnalysisResult.log_data`

5. Keep the UI unchanged, but make it start working
   - `TestingPanel.tsx` already passes `result?.log_data`
   - `AnalysisLog.tsx` already renders the structured sections
   - No UX redesign needed; once data flows through, the panel should populate automatically

### Files to update

- `supabase/functions/analyze-athlete-video/index.ts`
- `supabase/functions/admin-get-pipeline-result/index.ts`
- `src/services/athleteLab.ts`

### Data mapping details

Use the existing frontend type as the contract:

- `AnalysisLogData` in `src/features/athlete-lab/types.ts`

Recommended field mapping:

- `preflight.checks`
  - from `runPreflight()` output
- `preflight.pipeline_stopped`, `stop_reason`
  - when preflight fails
- `rtmlib.solution_class`
  - from node config / request payload
- `rtmlib.total_frames`, `source_fps`
  - from Cloud Run response
- `rtmlib.phase_windows`
  - from `buildPhaseWindows()`
- `metrics[]`
  - derived from each metric result, including status, value, deviation, scoring, skip/flag reason
- `aggregate`
  - from aggregate score computation
- `error_detection[]`
  - from `detectErrors()`
- `claude_api`
  - from existing prompt/response/token metadata already being logged during Claude generation

### Backward compatibility

- No change to completed/failed/cancelled behavior
- No need to alter the Run Analysis UI flow
- Existing rows without `result_data.log_data` will still show the current empty-state message
- New runs will populate the full Analysis Log

### Validation

1. Run a fresh analysis in Athlete Lab
2. Confirm `athlete_lab_results.result_data` contains `log_data`
3. Confirm `admin-get-pipeline-result` response includes `result.log_data`
4. Confirm `Analysis Log` renders sections instead of “Log data not available”
5. Confirm flagged/skipped metrics appear in the log so missing-metric debugging becomes possible
6. Confirm failed/cancelled runs still do not falsely show completed log output

### Expected outcome

After this change, the Analysis Log section will stop showing the placeholder warning for new completed runs and will expose the full pipeline diagnostics needed to understand:
- why a metric was scored, flagged, or skipped
- whether preflight or confidence thresholds suppressed output
- how phase windows were built
- what Claude received and returned
