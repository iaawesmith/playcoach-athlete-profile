

## Plan: Update `RTMLIB_URL` secret to point at the live Cloud Run service

### What changes
A single Lovable Cloud (edge function) secret value is updated. No code, no config, no schema, no migrations.

| Secret | Current value | New value |
|---|---|---|
| `RTMLIB_URL` | `pending_phase_2` | `https://rtmlib-service-874407535869.us-central1.run.app` |

### How it gets applied
Once you approve, I switch to default mode and call the secret-update tool with the new value. The change is instant and applies to the next invocation of any edge function that reads `Deno.env.get("RTMLIB_URL")` — primarily `analyze-athlete-video`'s `callCloudRun` helper. No redeploy of the function is required; edge functions read env vars on each cold start, and Lovable rotates them in immediately.

### What I will NOT do
- No code changes anywhere (no edits to `analyze-athlete-video`, `admin-test-upload`, or any other function).
- No new secrets, no renamed secrets, no removed secrets.
- No edits to `supabase/config.toml`.
- No test runs of the pipeline — you've explicitly said you'll run the end-to-end test manually next.
- No changes to the `athlete-videos` bucket or any storage paths.

### Verification (passive only)
After the update I'll confirm via `fetch_secrets` that `RTMLIB_URL` is present in the secret list (values are hidden, so I can only confirm existence — that's the expected behavior). I will NOT invoke any edge function.

### Risks
None. This is a one-field configuration change. Worst case if the URL were wrong: the next pipeline run would fail with a network error from `callCloudRun` — easy to diagnose and revert. The URL you provided is the same one you just verified working via direct curl, so this is the intended target.

### Files touched
None. Secret-only change.

