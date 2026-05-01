---
id: F-OPS-5
title: Admin-test uploads fail silently when target node is in draft
status: open
severity: Sev-3
origin_slice: post-1c
origin_doc: docs/audits/phase-2-smoke-test-2026-05-01.md
related_adrs: []
related_entries: [F-OPS-1]
opened: 2026-05-01
last_updated: 2026-05-01
---

# F-OPS-5 — Admin-test uploads fail silently when target node is in draft (Sev-3)

## Observation

`fetchNodeConfig` in [`supabase/functions/analyze-athlete-video/index.ts:928-932`](../../supabase/functions/analyze-athlete-video/index.ts) hard-filters the node lookup on `status = 'live'`:

```ts
.eq('id', nodeId)
.eq('status', 'live')
.single()
...
if (error || !data) throw new Error(`Node not found or not live: ${nodeId}`)
```

Any admin-test upload triggered while the target node is in `draft` fails with the error message `Node not found or not live: <node_id>`. The error names the node ID but does not disclose that the actual cause is the `status='live'` filter. To the operator this looks indistinguishable from "node ID does not exist" or "edge function bug" — neither of which is the truth.

## Impact

Surfaced concretely on **2026-04-29 01:14 UTC** when the first attempt at the post-1c.3 smoke test failed. The Slant node (`75ed4b18-8a22-440e-9a23-b86204956056`) was in `draft` because Phase 1c.3 transformation slices were actively rewriting node fields. The admin-test upload landed in that window, returned the misleading error, and blocked the smoke test until the user re-published the node and re-triggered. See [`docs/audits/phase-2-smoke-test-2026-05-01.md`](../audits/phase-2-smoke-test-2026-05-01.md) for the full halt record.

This failure mode will recur during **every future Phase 2 substantive slice** that edits node config. Any concurrent dogfood run during the edit window will fail with the same misleading error. Severity is Sev-3 — operational hygiene, no data loss, no production impact — but the misdirection cost is real: an operator who doesn't know to check node status spends time debugging the analyzer when the actual fix is "republish the node."

## Origin

Surfaced during PHASE-2-SMOKE pre-execution sweep on 2026-05-01. Documented in halt record `docs/audits/phase-2-smoke-test-2026-05-01.md` (initial v1 was a halt-outcome record; re-written in place after the user triggered a successful run). Captured as queued-for-triage finding in the audit doc's "Phase 2 prep backlog" section. Formally opened during PHASE-2-PREP-FOLLOWUPS (2026-05-01).

## Remediation candidates

### (a) Workflow-doc note only — smallest scope

Add a one-paragraph reminder to `docs/agents/workflows.md`: when triggering admin test uploads, publish the target node first; an upload landed against a draft node fails with a misleading error. Cheapest fix. Does not change the error message; relies on operator memory.

### (b) Edge-function diagnostic split — recommended

Restructure `fetchNodeConfig` to return distinct errors:

- `Node ID does not exist: <node_id>` when no row matches the ID
- `Node exists but is in <status> (must be 'live' for analysis): <node_id>` when row exists but status filter rejects it

Single-file edit (~15 lines) in `analyze-athlete-video/index.ts`. Does not change *behavior* (draft nodes still rejected), only *diagnosis*. Makes the failure mode honest about what it is. Structurally correct.

### (c) Admin-test bypass — durable but adds complexity

When `athlete_id === FIXED_TEST_ATHLETE_ID` (`8f42b1c3-5d9e-4a7b-b2e1-9c3f4d5a6e7b`), allow the analyzer to read draft nodes. Tag the resulting `result_data.node_status_at_run` field so the audit trail is unambiguous. Lets dogfooding survive node edit cycles entirely. Risk: results computed against a draft node could be confused with results against the published version of the same `node_version`; mitigated by the `node_status_at_run` tag.

## Recommended remediation

**(b)** is structurally correct. Most actionable. Fixes the lying-error-message problem without introducing new behavior or special-case branches. Out of scope for PHASE-2-PREP-FOLLOWUPS (this slice opens the finding only); deferred to Phase 2 substantive work.

If Phase 2a finds itself blocked by this failure mode more than once, escalate to (c).

## Cross-references

- [F-OPS-1](F-OPS-1-zombie-upload-accumulation-rate-sev-3.md) — structural sibling: also operational hygiene, also surfaces as silently-wrong upload state. Both findings live in the gap between "the system rejected the operation" and "the operator can tell why."
- [`docs/architecture/pipeline-trace.md`](../architecture/pipeline-trace.md) — Step 2 references `fetchNodeConfig`; the implicit `status='live'` filter is not currently called out in the trace and could be added as a one-line clarification when (b) ships.
- [`docs/audits/phase-2-smoke-test-2026-05-01.md`](../audits/phase-2-smoke-test-2026-05-01.md) — origin doc; Phase 2 prep backlog section queued this finding for triage.
- [`supabase/functions/analyze-athlete-video/index.ts:928-932`](../../supabase/functions/analyze-athlete-video/index.ts) — implementation surface for remediation (b).
