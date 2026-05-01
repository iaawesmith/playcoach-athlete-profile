# PHASE-2-SMOKE — Halt and Surface

## Pre-execution finding (halt condition triggered at Step 1)

The most recent `slant-route-reference-v1.mp4` upload **failed**, and no post-Phase-1c.3 successful run exists in the database. The smoke-test deliverable cannot be written against current data without misrepresenting the pipeline state.

### Most recent upload row

| Field | Value |
|---|---|
| `upload_id` | `0ef2c877-1632-4090-865a-1e2cb6cde235` |
| `created_at` | **2026-04-29 01:14:02 UTC** |
| `node_id` | `75ed4b18-8a22-440e-9a23-b86204956056` (Slant) |
| `node_version` | 6 |
| `status` | **`failed`** |
| `error_message` | `Node not found or not live: 75ed4b18-8a22-440e-9a23-b86204956056` |
| `progress_message` | `Analysis failed.` |
| `experiment` (context) | `1c-slice-d-d5-post-strip-verify` (note: 1c.2 era tag, not a fresh post-1c.3 trigger) |

### Why it failed

`fetchNodeConfig` (`analyze-athlete-video/index.ts:928-932`) hard-filters on `status='live'`. At 2026-04-29 01:14, the Slant node was almost certainly **not** in `live` status — Phase 1c.3 transformation slices were actively rewriting node fields, and the node would have been moved to `draft` during edit cycles. The node is currently `live` (last `updated_at`: 2026-04-30 22:10), set live during/after PHASE-1C3-PREP/POLISH close.

### Most recent **complete** run is pre-1c.3

| Field | Value |
|---|---|
| `upload_id` | `23936560-1284-4d13-bb68-9894afd2865c` |
| `created_at` | **2026-04-26 03:00:51 UTC** |
| `experiment` | `1c-slice-e-e36-post-migration` |
| `status` | `complete` |

This pre-dates 1c.3-A through 1c.3-F, PHASE-1C3-PREP, and PHASE-1C3-POLISH. Auditing it as a "post-1c.3 smoke test" would be category-incorrect.

## What I'm halting on

The slice prompt's success criterion is "confirm the pipeline produces a clean `result_data` row with the expected shape after all the cleanup work." There is **no such row**. Two paths forward, both require the user's call:

### Option A — User triggers a fresh upload, then I run the audit

Recommended. The Slant node is `live` right now; a fresh upload through the Athlete Lab admin UI should succeed. Once the new `complete` row exists, I execute Steps 2-10 of the original slice prompt and write `docs/audits/phase-2-smoke-test-2026-05-01.md`.

### Option B — I write a halt-outcome doc instead

I write `docs/audits/phase-2-smoke-test-2026-05-01.md` as a halt record: documents the failed 04-29 attempt, the root cause (node `status='live'` filter vs in-flight node edits during 1c.3), and a recommendation to either (a) re-trigger the smoke test, or (b) loosen the analyzer's node-status filter for admin-test paths so dogfood runs survive node draft cycles. No pipeline shape verification is performed.

## Bonus surface — possible Phase 2 input

The `Node not found or not live` failure mode is itself worth noting regardless of which option you pick. During any future phase that edits node config, **every concurrent admin test upload will fail with a misleading error** until the node is re-published. Candidates:

- Document as a known operational gotcha in `docs/agents/workflows.md`
- Open as a new finding in the risk register (severity probably Sev-3, similar to F-OPS-1 zombie pattern — operational hygiene, doesn't break the system, but creates confusing failures)
- Consider an analyzer-side change: admin-test uploads (athlete_id = `FIXED_TEST_ATHLETE_ID`) could bypass the `status='live'` filter so dogfooding works on draft nodes. Out of scope for this slice; flag for Phase 2 backlog.

## Decision needed

Pick **A** (trigger a fresh upload, then I run the full audit) or **B** (I write a halt-outcome doc against the failed 04-29 run only). Standing by.
