
Implement backend-read helpers for the admin Run Analysis flow so status polling and final result fetches no longer rely on client-side table reads blocked by RLS.

### What will change

1. Add a backend helper for upload status
   - Create `supabase/functions/admin-get-upload-status/index.ts`
   - Accept a JSON body with `uploadId`
   - Validate input with Zod
   - Use service-role credentials
   - Read the matching `athlete_uploads` row
   - Return:
     - the upload snapshot when found
     - `upload: null` when not found
   - Use a non-throwing single-row pattern so “0 rows” becomes a clean null response instead of a coercion error

2. Add a backend helper for final pipeline results
   - Create `supabase/functions/admin-get-pipeline-result/index.ts`
   - Accept `uploadId`, `nodeId`, and fixed test athlete context as needed for the existing fallback behavior
   - Use service-role credentials
   - Read:
     - the linked `athlete_lab_results` row by `upload_id`
     - or the same fallback query the client currently uses for the fixed test athlete + node
   - Return:
     - `result: null` when no result exists yet
     - parsed row data when available
   - Keep this focused on reads only; do not modify pipeline behavior

3. Register the new helpers consistently
   - Update `supabase/config.toml` with function entries for the new admin helpers so they match the existing helper pattern

4. Rewire the service layer to use helpers instead of direct table queries
   - Update `src/services/athleteLab.ts`
   - Replace direct `supabase.from("athlete_uploads")...single()` in `fetchUploadStatus()` with `supabase.functions.invoke("admin-get-upload-status")`
   - Replace direct `athlete_lab_results` queries in `fetchPipelineResult()` with `supabase.functions.invoke("admin-get-pipeline-result")`
   - Preserve existing return shapes (`PipelineUploadSnapshot`, `PipelineAnalysisResult | null`) so the UI contract stays stable
   - Handle `null` responses gracefully instead of throwing when data is not yet available

5. Update polling behavior to use helper-backed reads end-to-end
   - Keep `submitRunAnalysisJob()` reading back the created upload via the new status helper
   - Keep `pollRunAnalysisResult()` polling via the new status helper and fetching completion data via the results helper
   - Preserve current stage transitions:
     - uploading
     - queued
     - processing
     - fetching_results
     - complete / failed / timed_out

### Files to update

- `supabase/functions/admin-get-upload-status/index.ts` — new helper
- `supabase/functions/admin-get-pipeline-result/index.ts` — new helper
- `supabase/config.toml` — add function config entries
- `src/services/athleteLab.ts` — rewire status and result reads through helpers

### Implementation details

- Keep all existing RLS policies unchanged
- Keep `admin-test-upload` and `admin-create-athlete-upload` unchanged
- Keep the fixed admin athlete safeguard in the new helpers so they only serve the intended admin test flow
- Prefer explicit `null` results over `.single()`-style failures when rows are absent or results are still pending
- Return only the fields already needed by the UI to avoid unnecessary backend surface area

### Validation after implementation

1. Starting Run Analysis no longer triggers client-side reads against `athlete_uploads` or `athlete_lab_results`
2. The initial post-create upload read succeeds through `admin-get-upload-status`
3. Polling continues without `Cannot coerce the result to a single JSON object`
4. A pending/processing upload returns a valid upload snapshot even before results exist
5. When the pipeline completes, the final result is fetched through `admin-get-pipeline-result`
6. Failed runs still surface `error_message`
7. No RLS policies are loosened and no pipeline logic is changed
