
## Plan: Force-refresh `RTMLIB_URL`, then rerun the Phase 2 pipeline test

### Change to apply
Delete and recreate the same runtime secret with the full endpoint path:

| Secret | Action | Value |
|---|---|---|
| `RTMLIB_URL` | delete, then recreate | `https://rtmlib-service-874407535869.us-central1.run.app/analyze` |

### Why this plan fits the failure
`analyze-athlete-video` reads `RTMLIB_URL` directly and includes the runtime value in its Cloud Run error text:

```ts
const rtmlibUrl = Deno.env.get('RTMLIB_URL')
response = await fetch(rtmlibUrl, ...)
throw new Error(`Cloud Run call failed: ... (RTMLIB_URL: ${rtmlibUrl}) ...`)
```

That means the next run’s logs are the authoritative proof of which secret value the function actually used at runtime.

### Execution order

1. **Read current secret if possible**
   - Use every available secret-inspection mechanism.
   - If the tooling exposes only names/metadata, report clearly that the value is hidden and cannot be read directly.
   - If available, capture whether metadata includes presence only or any timestamp.

2. **Delete `RTMLIB_URL`**
   - Remove the existing runtime secret entirely.
   - No other secrets touched.

3. **Recreate `RTMLIB_URL`**
   - Set it to:
     `https://rtmlib-service-874407535869.us-central1.run.app/analyze`

4. **Confirm presence**
   - Verify the secret now appears in the runtime secret list.
   - If values remain hidden, confirm presence only.

5. **Wait 30 seconds**
   - Allow backend secret propagation before invoking anything.

6. **Re-run the end-to-end pipeline test**
   - Confirm one live node exists:
     `select id, name, status from athlete_lab_nodes where status = 'live' limit 1;`
   - Confirm the reference video still exists in storage at:
     `athlete-videos / test-clips/slant-route-reference-v1.mp4`
   - Generate a fresh 24-hour signed URL for that object.
   - Capture:
     `select now() as test_started_at;`
   - Insert a new `athlete_uploads` test row with the signed URL.
   - Wait 120 seconds for the full pipeline.
   - Pull full `analyze-athlete-video` logs for the execution window.
   - Read the final `athlete_uploads` row.
   - Read the latest `athlete_lab_results` row for that athlete.

### Primary diagnostic to confirm propagation
The most important log line is the Cloud Run call line or error line containing:

```text
RTMLIB_URL: ...
```

Interpretation:
- If logs show `...run.app/analyze` → the new secret propagated to runtime.
- If logs still show `...run.app` without `/analyze` → the runtime is still using the old value and this should be escalated as a backend propagation issue.

### What I will report back
- Step 1 secret-read result:
  - actual value, if readable, or
  - presence-only confirmation if hidden
- Confirmation that delete + recreate completed
- Confirmation that the secret is present afterward
- Step 5 `INSERT RETURNING` row
- Full edge function log output for this execution window
- Final `athlete_uploads` row state
- The `athlete_lab_results` row, if written
- A 10-step verdict table covering:
  1. insert succeeds  
  2. webhook fires  
  3. edge function starts  
  4. node config fetched  
  5. preflight passes  
  6. Cloud Run called successfully  
  7. metrics calculated  
  8. Claude feedback generated  
  9. results written  
  10. upload status updated to `complete`

### Expected success signal
A successful rerun should show:
- runtime logs referencing `RTMLIB_URL: https://rtmlib-service-874407535869.us-central1.run.app/analyze`
- no 404 from Cloud Run
- a written `athlete_lab_results` row
- `athlete_uploads.status = 'complete'`

### Scope guardrails
- No code changes
- No schema or migration changes
- No bucket/config changes
- No extra experiments beyond the delete/recreate, wait, and single rerun
- No cleanup of the inserted test row afterward

### Files touched
None. Secret-only change plus runtime test execution.
