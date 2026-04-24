

## Turn 1 of 3: Flip Slant node to live for smoke test

Single migration to enable the Slant node so the Edge Function will accept the upload in Turn 2.

### Change

Migration file containing:
```sql
UPDATE public.athlete_lab_nodes
SET status = 'live'
WHERE id = '75ed4b18-8a22-440e-9a23-b86204956056';
```

### What happens after this turn

- Slant node status: `live` (enables Edge Function path)
- Upload `66ea5e98-ff65-4d20-9e9e-232753d198aa` status: unchanged from current state (will reset to `pending` as part of Turn 2)
- Mediapipe service revision: `mediapipe-service-00010-gdp` (no service changes)

### Three-turn queue (confirmed)

1. **This turn** — flip Slant to `live`. End-of-turn migration apply.
2. **User pings** — execute Call 1: reset upload to `pending`, invoke `analyze-athlete-video`, capture full Cloud Run log + `analyze done` timing line + Edge Function logs + DB state, write upload-reset migration for Call 2 prep.
3. **User pings** — execute Call 2: invoke again, capture timings, classify GOOD/PARTIAL/BAD, validate decode_s extrapolation prediction (~22s), write final migration that resets upload to `pending` AND reverts Slant to `draft`. End state matches pre-test exactly.

### Files modified this turn

- `supabase/migrations/<timestamp>_slant_live_for_smoke.sql` (1 statement)

No application code. No service redeploy.

