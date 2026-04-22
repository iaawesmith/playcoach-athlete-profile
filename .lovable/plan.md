
## Plan: Update `RTMLIB_URL` and re-run the Phase 2 pipeline test

### Change to apply
Update the Lovable Cloud runtime secret:

| Secret | Current value | New value |
|---|---|---|
| `RTMLIB_URL` | `https://rtmlib-service-874407535869.us-central1.run.app` | `https://rtmlib-service-874407535869.us-central1.run.app/analyze` |

### Why this is the right fix
The `analyze-athlete-video` function reads `RTMLIB_URL` and POSTs to it exactly as provided:

```ts
const rtmlibUrl = Deno.env.get('RTMLIB_URL')
response = await fetch(rtmlibUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})
```

So the secret must include the full inference endpoint path. No code change is needed.

### Implementation scope
Configuration-only update, then rerun the same end-to-end pipeline test flow from the previously approved plan.

### Execution steps after approval
1. Update the `RTMLIB_URL` secret to the `/analyze` URL.
2. Passively confirm the secret still exists in the project secret list.
3. Re-run the Phase 2 pipeline test:
   - confirm one Live node exists
   - confirm `athlete-videos/test-clips/slant-route-reference-v1.mp4` still exists
   - generate a fresh 24-hour signed URL
   - capture `test_started_at`
   - insert a new `athlete_uploads` test row using that signed URL
   - wait 120 seconds for processing
   - pull `analyze-athlete-video` logs for the execution window
   - read final `athlete_uploads` state
   - read latest `athlete_lab_results` row for the inserted athlete
4. Return the same output package as before:
   - Step 5 `INSERT RETURNING` row
   - full edge function log output for this execution window
   - final `athlete_uploads` row state
   - `athlete_lab_results` row, if written
   - 10-step verdict table with pass/fail evidence

### Expected outcome
With `/analyze` appended, the Cloud Run call should stop failing with 404 and the pipeline should proceed through:
1. insert succeeds
2. webhook fires
3. edge function starts
4. node config fetched
5. preflight passes
6. Cloud Run returns pose data
7. metrics calculated
8. Claude feedback generated
9. results written
10. `athlete_uploads.status = 'complete'`

### What will not change
- No edits to `analyze-athlete-video`
- No edits to `admin-test-upload`
- No database schema, RLS, bucket, or config changes
- No retries or extra experiments beyond the single rerun
- No cleanup/delete of the inserted test row afterward

### Files touched
None. Secret update only.
