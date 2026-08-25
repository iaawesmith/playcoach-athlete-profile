# Pipeline Health Check — live green-checkmark panel

## Why

`PipelineSetupTab` today is a manual checklist: an admin ticks boxes by hand. It records what
*was* set up, not what is *currently working*. When Cloud Run cold-starts wrong, a secret gets
rotated, the DB webhook stops firing, or a storage bucket policy changes, nothing surfaces it —
the first symptom is an upload stuck at `pending` or `failed`.

This adds one button ("RUN HEALTH CHECK") that actively probes every component required for a
video pose analysis, and renders a green check / red X / amber warning per component with the
failure reason inline.

## The components that must be live for a pose analysis

Derived from the actual pipeline path (`athlete_uploads` INSERT → trigger → edge function →
Cloud Run → results row). Each becomes one checkpoint row:

Ingest
1. `athlete-videos` storage bucket reachable
2. Upload can be written + signed-URL issued (the signed URL is what Cloud Run downloads)
3. `athlete_uploads` table readable/insertable by the service role

Trigger
4. `trigger_analysis_on_upload` function exists
5. `on_athlete_upload_insert` trigger attached to `athlete_uploads`
6. `pg_net` extension available (the trigger's `net.http_post` dependency)

Edge function
7. `analyze-athlete-video` deployed and responding
8. Required secrets present and non-empty: `MEDIAPIPE_SERVICE_URL` (or `RTMLIB_URL`),
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `LOVABLE_API_KEY` / `ANTHROPIC_API_KEY`
   (reported as present/absent only — never the value)

Cloud Run pose service
9. `/health` returns `ok: true` — service up
10. Model actually loaded, and which one (`model` / `model_path` from `/health`)
11. Cold-start latency measured on that probe (amber if > 15s)
12. `/analyze` contract probe: tiny known-good window against the reference clip, assert the
    response carries `keypoints`, `scores`, `world_keypoints`, `fps`, `frame_count`
    (this is the check that catches a silently-broken deploy)

Scoring + write path
13. At least one node in `published` status with `key_metrics` non-empty (uploads against a
    draft node fail silently — F-OPS-5)
14. LLM gateway reachable (cheap 1-token ping)
15. `athlete_lab_results` writable by service role

Freshness signals (informational, not pass/fail)
16. Most recent upload's status + age; count of uploads stuck `processing` > 15 min (F-OPS-1
    zombie signal)

## How it works

A new edge function `pipeline-health` runs the probes server-side (it is the only place that can
see secrets and use the service role) and returns a JSON array of
`{ id, group, label, status: 'pass' | 'fail' | 'warn' | 'skip', detail, latency_ms }`.

Probes are grouped and run in parallel per group, with a per-probe timeout so one dead dependency
can't hang the whole report. Cheap probes (tables, secrets, `/health`) always run. The two
expensive probes — the `/analyze` contract probe and the LLM ping — run only when the caller passes
`deep: true`, so the default click is fast and free.

The UI adds a **PIPELINE HEALTH** panel at the top of the existing Pipeline Setup tab: one button,
then grouped rows with a Material Symbols `check_circle` (primary-container green), `cancel`
(error-dim), or `warning` (amber) per row, the probe detail text beneath any non-passing row, the
measured latency on the Cloud Run rows, and an overall banner ("ALL SYSTEMS OPERATIONAL" /
"N CHECKS FAILING"). A "DEEP CHECK" toggle enables the two expensive probes. Last-run timestamp
is kept in local UI state; the manual checklist below stays untouched.

## Design notes

Existing dark/kinetic system only — `bg-surface-container-high` rows, ghost borders,
`animate-pulse` skeletons while probing, uppercase `tracking-[0.4em]` group labels, no spinners,
no new icon library.

## Technical notes

- New function `supabase/functions/pipeline-health/index.ts`, `verify_jwt = false` in
  `config.toml` to match the sibling admin functions (it returns no secret values — only
  present/absent booleans and probe outcomes).
- Secret checks report presence only. No secret value is ever returned, logged, or rendered.
- Schema/trigger/extension probes go through `information_schema` / `pg_trigger` / `pg_extension`
  via a read-only service-role query.
- The `/analyze` deep probe reuses the existing reference clip already used by the verification
  scripts, with a sub-1s window so Cloud Run cost stays negligible.
- New service wrapper `runPipelineHealthCheck()` in `src/services/athleteLab.ts`; the component
  makes no direct `fetch` call.
- No change to `analyze-athlete-video`, `pose.py`, or any calibration code. This is observability
  only — it does not touch the F-POSE-1 fix or Phase 2a slices.

## Out of scope

- Auto-remediation of any failing check
- Scheduled/cron health runs and alerting (natural follow-up once the probe set is proven)
- Replacing the manual setup checklist
