# Node simplification — Batch 5 (Errors)

Completed 2026-10-23 UTC. Stop after Batch 5; Wheel correction awaits separate approval.

## Restore point and scope

Pre-batch source history: `f74bd369802966dced9b9cee93bf45f872c41cc7`.
Slant WR remains LIVE v12. Only its `common_errors` and automatic `updated_at` changed; no metric, scoring, analyzer or service changes/deployments. Retained rule severity, correction, condition, detection flags and internal notes remain untouched. No stored result writes.

- Remove Tipping the route with eyes, Body catch and Drifting after the catch.
- Rename Rounding the break to Sinking too deep in the plant; retain `Plant Leg Extension < 125`.
- Retain Slow release off the line and `Release Speed < 5`.
- Hide severity selector/pills and severity in the node text export; preserve stored severity and analyzer reporting.
- Relabel Correction as Admin Note, not sent to the coach model or used in fallback feedback.
- Correct the disabled auto-detection tooltip; disabled rules are not coaching-model context.

## Reproducible read-only rescore

`scripts/fingerprint-rescore.ts --errors` now additionally calls the extracted existing analyzer `detectErrors` on recomputed stored-data metrics. It returns full `errors.detected`, `errors.context` and `errors.evaluations`. Errors remain outside the unchanged canonical metric hash. No pose, AI, network calls from extracted analyzer code, or writes to the result.

Before snapshot and after fresh read:

```text
bun scripts/fingerprint-rescore.ts c6fa0895 --save-input /tmp/batch5-input-before.json --expect fba7237f605f41960d27375977057819623d820906c28a57c148cce25fc72b21
bun scripts/fingerprint-rescore.ts c6fa0895 --input /tmp/batch5-input-before.json --errors --expect fba7237f605f41960d27375977057819623d820906c28a57c148cce25fc72b21
bun scripts/fingerprint-rescore.ts c6fa0895 --errors --save-input /tmp/batch5-input-after.json --expect fba7237f605f41960d27375977057819623d820906c28a57c148cce25fc72b21
```

Both fingerprints: `fba7237f605f41960d27375977057819623d820906c28a57c148cce25fc72b21`, aggregate 94, 90 frames. Full responses: `/tmp/batch5-before.json`, `/tmp/batch5-after.json`.

`errors.detected` before and after is identical:

```json
[{"name":"Slow release off the line","condition":"Release Speed < 5","metric_value":3.76,"severity":"common"}]
```

| Before rule | Condition | Value | Triggered | Before reason | After |
|---|---|---|---|---|---|
| Rounding the break | Plant Leg Extension < 125 | 139.61 | false | condition_false | Sinking too deep in the plant; same condition/value/result |
| Tipping the route with eyes | Head Snap Timing < 1 | null | false | not_auto_detectable | removed |
| Slow release off the line | Release Speed < 5 | 3.76 | true | triggered | unchanged |
| Body catch | Catch Efficiency < 70 | null | false | not_auto_detectable | removed |
| Drifting after the catch | Post-Catch YAC Burst < 3.0 | null | false | not_auto_detectable | removed |

Current disabled dead rules evaluate as `not_auto_detectable`, not `metric_unavailable`; this live-state result supersedes older audit wording.

## Wheel proposal — NOT applied

Wheel WR's Drifting to the sideline is already disabled with a blank condition. Propose removing it from the measurable Errors list and preserving its wording as an admin knowledge-base note. None of its four metrics measures sideline clearance; assigning Turn Radius > 2.5 would duplicate another rule and falsely imply boundary detection. In fact its distance_variance math tracks inter-hip distance spread, not boundary position. No new threshold or metric is proposed in this batch. Wait for user approval before changing Wheel.

Fresh reads confirm Wheel WR, Wheel RB and Slant TE unchanged.

## Verification and stop

- 162 existing-suite tests pass, including added below-125 and below-5 concrete rule checks.
- Real Slant Errors editor shows two rules, no severity controls, Admin Note label; edit cancelled without Save Node; no browser runtime errors.
- Preview build OK. Screenshot `/tmp/browser/batch5/errors.png`.
- Result snapshot identical before/after. Slant retained-rule fields preserved except requested rename.
- Batch 6+ not started.