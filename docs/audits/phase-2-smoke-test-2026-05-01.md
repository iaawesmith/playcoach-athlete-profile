# Phase 2 Smoke Test — Halt Outcome (2026-05-01)

> **Status:** **HALT — no successful post-1c.3 run to audit.**
> **Verdict:** N/A (smoke test could not execute end-to-end inspection).
> **Type:** Halt-outcome record (not a passing audit).

## Context

PHASE-2-SMOKE was scoped as a read-only inspection slice to confirm the pipeline produces a clean `result_data` row after Phase 1c.3 consolidation (1c.3-A through 1c.3-F + PHASE-1C3-PREP + PHASE-1C3-POLISH). Dogfooding, not a Phase 2a step. The success criterion was *existence* of a clean post-1c.3 result row, not calibration accuracy.

Step 1 of the slice — locate the most recent `slant-route-reference-v1.mp4` upload — surfaced a halt condition. No post-1c.3 successful run exists. This doc records what was found, the root cause, and the recommended path forward.

## Test inputs (intended)

- **Clip:** `athlete-videos/test-clips/slant-route-reference-v1.mp4`
- **Target node:** `75ed4b18-8a22-440e-9a23-b86204956056` (Slant)
- **Athlete:** `8f42b1c3-5d9e-4a7b-b2e1-9c3f4d5a6e7b` (`FIXED_TEST_ATHLETE_ID`)

## Most recent upload row — FAILED

| Field | Value |
|---|---|
| `upload_id` | `0ef2c877-1632-4090-865a-1e2cb6cde235` |
| `created_at` | **2026-04-29 01:14:02 UTC** |
| `node_id` | `75ed4b18-8a22-440e-9a23-b86204956056` (Slant) |
| `node_version` | 6 |
| `status` | **`failed`** |
| `error_message` | `Node not found or not live: 75ed4b18-8a22-440e-9a23-b86204956056` |
| `progress_message` | `Analysis failed.` |
| `camera_angle` | `sideline` |
| `start_seconds`, `end_seconds` | 0, 3 |
| `analysis_context.experiment` | `1c-slice-d-d5-post-strip-verify` |

Note: the `experiment` tag on `analysis_context` is a 1c.2-era label, not a fresh post-1c.3 trigger. The upload appears to be a re-run from an existing admin-test fixture rather than a hand-triggered "first post-1c.3 dogfood."

## Root cause

`fetchNodeConfig` in [`supabase/functions/analyze-athlete-video/index.ts:928-932`](../../supabase/functions/analyze-athlete-video/index.ts) hard-filters the node lookup on `status = 'live'`:

```ts
.eq('id', nodeId)
.eq('status', 'live')
.single()
...
if (error || !data) throw new Error(`Node not found or not live: ${nodeId}`)
```

At 2026-04-29 01:14, the Slant node was almost certainly not in `live` status. PHASE-1C3 transformation slices were actively rewriting node fields (1c.3-B kb merge, 1c.3-D 5-key kb merge, 1c.3-E mechanics-tab drop), which routinely move the node to `draft` during edit cycles. The current node row confirms it was last updated at **2026-04-30 22:10** — the re-publish to `live` happened during/after PHASE-1C3-PREP/POLISH close, **after** the failed upload attempt.

Current node state (read 2026-05-01):

| Field | Value |
|---|---|
| `id` | `75ed4b18-8a22-440e-9a23-b86204956056` |
| `name` | Slant |
| `status` | `live` |
| `node_version` | 6 |
| `updated_at` | 2026-04-30 22:10:33 UTC |

So the analyzer's hard `status='live'` filter rejected an upload that was in flight against a node mid-edit. This is a real, reproducible operational gotcha — see "Phase 2 input candidate" below.

## Most recent COMPLETE run (pre-Phase-1c.3)

| Field | Value |
|---|---|
| `upload_id` | `23936560-1284-4d13-bb68-9894afd2865c` |
| `result_id` | `1a5996b0-5384-4289-afef-da9666de7c5a` |
| `created_at` (upload) | **2026-04-26 03:00:51 UTC** |
| `analyzed_at` (result) | 2026-04-26 03:01:21 UTC |
| `aggregate_score` | 61 |
| `experiment` | `1c-slice-e-e36-post-migration` |
| `status` | `complete` |

This row pre-dates **all** of the Phase 1c.3 work being smoke-tested. Auditing it as a "post-1c.3 result" would be category-incorrect and is explicitly out of scope. For reference only, its `result_data` already carries the full ADR-0014 contract keys (`log_data`, `calibration_audit`, plus auto-zoom and movement diagnostics) — confirming the contract was well-formed at the close of Phase 1c.2. Whether the contract still holds post-1c.3 is the open question this smoke test was meant to answer.

## Pipeline shape verification — NOT PERFORMED

Steps 2-9 of the slice prompt (result row inspection, `result_data` shape against ADR-0014, `calibration_audit` field-by-field, metric results, Claude prompt/response, timing, anomalies, baseline comparison) require a successful post-1c.3 run. They were not executed.

## Anomalies surfaced

| Severity | Finding |
|---|---|
| **Critical (process)** | No post-1c.3 successful run of `slant-route-reference-v1.mp4` exists. Smoke test cannot validate Phase 1c.3 outputs. |
| **Warning (operational)** | Hard `status='live'` filter in `fetchNodeConfig` produces a confusing failure mode whenever an admin test upload races a node draft cycle. The error message names the node ID but doesn't disclose that the actual cause is the `status` filter. |
| **Info** | The 04-29 failed upload's `analysis_context.experiment` tag (`1c-slice-d-d5-post-strip-verify`) suggests it was re-run from a stored fixture, not freshly triggered post-1c.3. Even if it had succeeded, it wouldn't fully count as a post-1c.3 dogfood run unless the user explicitly re-triggered with current node state. |

## Path forward

**Recommended:** user triggers a fresh upload of `slant-route-reference-v1.mp4` through the Athlete Lab admin UI. The Slant node is currently `live`, so the run should proceed. Once a new `complete` row exists, re-run PHASE-2-SMOKE Steps 2-10 against it and write `phase-2-smoke-test-2026-05-01-v2.md` (or supersede this doc, depending on user preference).

**Not recommended:** treating the 2026-04-26 pre-1c.3 result as the smoke-test target. Those metrics, calibration values, and Claude feedback predate every change Phase 1c.3 made to the Slant node.

## Phase 2 input candidate (operational finding)

The `Node not found or not live` failure mode is worth a separate Phase 2 backlog entry. **Every concurrent admin test upload triggered while a node is in `draft` will fail with a misleading error.** Three remediation options, in increasing scope:

1. **Documentation only:** add a workflow note to `docs/agents/workflows.md` reminding agents to publish the target node before triggering admin test uploads. Cheapest. Doesn't fix the misleading error.
2. **Better error message:** keep the filter, but split the failure cases — surface "node exists but is in draft (re-publish before testing)" separately from "node ID does not exist." Small edge-function change. Doesn't change behaviour, just diagnoses it correctly.
3. **Admin-test bypass:** when `athlete_id === FIXED_TEST_ATHLETE_ID`, allow the analyzer to read draft nodes. Highest scope. Lets dogfooding survive node edit cycles. Risk: results computed against a draft node could be confused with results computed against the published version of the same `node_version`. Mitigate by tagging `result_data.node_status_at_run` so the audit trail is unambiguous.

This finding belongs in `docs/risk-register/` as F-OPS-5 or similar (Sev-3, operational hygiene, structural sibling of F-OPS-1 zombie pattern). **Not opened in this slice** (read-only inspection scope) — flagged here for the user to formalize.

## Cross-links

- [`docs/architecture/pipeline-trace.md`](../architecture/pipeline-trace.md) — Step 2 references `fetchNodeConfig`; the implicit `status='live'` filter is not currently called out in the trace and could be added as a one-line clarification.
- [`docs/adr/0014-c5-unified-edge-function-body-based-path.md`](../adr/0014-c5-unified-edge-function-body-based-path.md) — `calibration_audit` contract that the missing post-1c.3 run was meant to verify.
- [`docs/adr/0005-determinism-tolerance-1pct.md`](../adr/0005-determinism-tolerance-1pct.md) — ±1% tolerance for the cross-baseline comparison that could not be performed.
- [`docs/risk-register/F-OPS-1-zombie-upload-accumulation-rate-sev-3.md`](../risk-register/F-OPS-1-zombie-upload-accumulation-rate-sev-3.md) — structural sibling of the operational gotcha surfaced here.
- [`docs/audits/_README.md`](_README.md) — audit naming + retention policy.

## Summary verdict

**HALT.** Smoke test deliverable is this halt-outcome record, not a pipeline shape verification. Awaiting user decision: trigger a fresh upload (recommended), or accept this halt and move on without post-1c.3 dogfood validation.
