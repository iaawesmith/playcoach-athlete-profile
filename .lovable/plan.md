# Target direction on metrics + wider level-of-play ban

## 1. Target direction

New optional metric field `target_direction`: `target` (default when missing, today's behavior), `at_most`, `at_least`.

**Scoring** (one pure helper, unit-tested):
- `target`: unchanged — distance from target, existing tolerance and curve.
- `at_most`: value at or below target scores 100; above it, the existing tolerance and curve apply to the amount over.
- `at_least`: value at or above target scores 100; below it, the same curve on the amount under.

**Wording** — one shared describer used by the coaching prompt, fallback summary, Analysis Log and results panel:
- On the good side, or within tolerance for `target`: "inside the target" / "on target".
- On the bad side: "short of the target by 3.24 mph" (`at_least`), "over the target by 0.02 yd" (`at_most`), "off the target by X" (`target`).
- The bare word "below" is never used.

**Slant (WR) to version 10, stays LIVE:** Hip Stability `at_most`, Release Speed `at_least`, Plant Leg Extension `target`. Nothing else on the node changes. No other node is touched, so the rest keep today's behavior.

**Editor:** a "Target direction" dropdown on the metric form (Aim for target / At most / At least), defaulting to Aim for target, with a one-line explanation under it.

## 2. Feedback check

Add "high-level", "top-level" and "next-level" to the always-banned level-of-play list, with tests. These include the hyphenated and spaced forms, so "that's high-level stuff" from result 1f7c3450's rejected draft is caught.

## Verification

- Rescore 1f7c3450 from its stored metric values (no new pose run, nothing written back). Expected: Hip Stability 88 to 100, Release Speed and Plant Leg Extension unchanged. Report the aggregate score before and after.
- Replay 1f7c3450 once through the admin replay and show the final response and its check result.
- Run all tests.

## Technical details

- `KeyMetric.target_direction?: "target" | "at_most" | "at_least"` lives in the `key_metrics` JSON, so no database change is needed.
- `scoreMetric` in analyze-athlete-video moves to a pure `scoring.ts` that takes the direction. Missing direction gives the same result as today, and a test proves it.
- The describer lives in `prompt.ts` and gets reused by the frontend through the existing pure-import pattern. The Analysis Log and results panel read the direction from the node's metric.
- The replay path carries the direction into the formatted metric lines. A small service-role-only rescore mode returns before and after scores from the stored `metric_results` and writes nothing.
- Redeploy analyze-athlete-video, then record the rule in AGENTS.md.
