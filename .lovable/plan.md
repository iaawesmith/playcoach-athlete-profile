

## Deploy Edge Function: `analyze-athlete-video`

### What gets created
A new Deno edge function at `supabase/functions/analyze-athlete-video/index.ts` containing the full pipeline orchestrator from the AthleteLab Implementation Docs card (`admin_implementation_docs` row id `64e190d0…`, ~27K chars / ~600 lines of TypeScript). The DB webhook trigger `trigger_analysis_on_upload` already exists and points at `/functions/v1/analyze-athlete-video`, so deploying this function activates the pipeline automatically.

### Function structure (from the doc)
- `Deno.serve` entry point — receives webhook payload, runs 13-step pipeline, updates `athlete_uploads.status`
- Helpers: `fetchNodeConfig`, `runPreflight`, `selectDetFrequency`, `selectCalibration`, `applyTemporalSmoothing`, `lockTargetPerson`, `buildPhaseWindows`, `calculateAllMetrics` (+ `calculateAngle`, `calculateDistance`, `calculateVelocity`, `calculateAcceleration`, `calculateFrameDelta`, `scoreMetric`, `checkConfidence`, `resolveBilateral`), `calculateAggregateScore`, `detectErrors`, `callClaude`, `writeResults`, `updateUploadStatus`, plus Claude prompt formatters
- Uses `createClient` with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (already configured)

### Required secrets — action needed
Two secrets referenced by the function are **not yet configured**:
- `ANTHROPIC_API_KEY` — for the Claude API call (Step 11)
- `RTMLIB_URL` — Cloud Run pose-detection service URL (Step 4)

The function will deploy and the webhook will fire, but any upload analysis will fail at the Cloud Run / Claude step until these are added. I'll request both via the secrets flow right after deploying.

### Config
- `verify_jwt = false` will be added to `supabase/config.toml` since the function is invoked by the DB webhook with a service-role bearer token, not an end-user JWT. The function trusts the webhook payload directly.
- No CORS headers needed (server→server invocation only).

### What I will NOT change
- No DB schema changes
- No changes to the existing `trigger_analysis_on_upload` trigger
- No changes to other edge functions, components, or UI
- No README or test files

### Verification after deploy
1. Confirm function appears in the deployed-functions list
2. Tail `analyze-athlete-video` logs to confirm cold start succeeds
3. Note for the user: end-to-end pipeline test requires `ANTHROPIC_API_KEY` + `RTMLIB_URL` to be set first

### Files touched
- `supabase/functions/analyze-athlete-video/index.ts` (new)
- `supabase/config.toml` (append `[functions.analyze-athlete-video]` block)

