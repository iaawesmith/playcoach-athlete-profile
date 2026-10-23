# Node simplification — Batch 3 Metric card

## Restore point

Pre-Batch-3 source revision: `ad7be4e1ae943ab62d5078f49aa4dcecb19a51f8` (Lovable history entry immediately before this batch; a separate history identifier is unavailable).

## Reproducible baseline

The user accepted identical pre-Batch-2/current output as a pass and retired the unavailable `718c917a…` method. `scripts/fingerprint-rescore.ts` reads a result and its current node through the read-only project CLI, then runs analyzer calculations on stored keypoints, scores, per-frame scales and phase windows. It never calls pose inference, AI or writes results.

Canonical payload is `{aggregate, metrics: { [metricName]: {score, status, value} }}`. All object keys and metric names are lexical-order sorted; finite numbers are rounded to four decimals, missing values/scores become null. Configuration, diagnostic details and phase aggregates are excluded. SHA256 hashes UTF-8 `JSON.stringify(payload)`. Duplicate metric names fail instead of colliding.

Baseline: `fba7237f605f41960d27375977057819623d820906c28a57c148cce25fc72b21`.
Result: `c6fa0895-744a-450a-aca6-80a252c42470`, Slant v12, 90 frames, aggregate **94**.

| Metric | Value | Score | Status |
| --- | ---: | ---: | --- |
| Hip Stability | 0.01 | 100 | scored |
| Plant Leg Extension | 139.61 | 100 | scored |
| Release Speed | 3.76 | 68.9765 | scored |
| Speed into the break | 1 | 100 | scored |

```sh
bun scripts/fingerprint-rescore.ts c6fa0895 --save-input /tmp/batch3-input.json
bun scripts/fingerprint-rescore.ts c6fa0895 --input /tmp/batch3-input.json --analyzer-root /tmp/batch2-before --expect fba7237f605f41960d27375977057819623d820906c28a57c148cce25fc72b21
bun scripts/fingerprint-rescore.ts c6fa0895 --input /tmp/batch3-input.json --expect fba7237f605f41960d27375977057819623d820906c28a57c148cce25fc72b21
```

Pre-Batch-2 `7712968`, current-before-Batch-3 and current-after-Batch-3 all match on the identical saved input. Exit 2 means a baseline mismatch; missing/ambiguous input throws. `--input` is an exported `{result,node}` snapshot with upload `analysis_context` attached to result; snapshots stay outside the repository because they contain stored athlete data.

## Changes

- Hide Depends On and Body Group controls without removing saved fields.
- Landmark picker shows every region present in the landmark library, independent of the hidden saved group list, without empty tabs. Selection and presets preserve hidden groups and landmark order.
- One Side choice replaces Node Default and Direction Override: Auto → auto/auto, Left → left/force_left, Right → right/force_right, Not bilateral → none/none.
- Display uses analyzer precedence (forced override, either none, fixed side, auto). Opening or saving untouched settings does not normalize conflicting legacy values.
- Human-readable node export shows Side and omits retired Depends On/Body Groups. Admin documentation remains editable and exported.
- No analyzer, service, node data or scoring changes; no deployments needed.

## Verification

- Canonical hashing and Side preservation tests added; all 160 tests pass (47 targeted regression tests).
- Actual Slant editor checked in the browser: single Side selector responds to Right/Auto changes; retired controls absent; admin documentation retained. Draft cancelled without saving node data. No browser runtime errors.
- Stored result is not overwritten; aggregate remains 94 and semantic baseline matches.
- Stop after Batch 3. Batch 4 and later remain unstarted.
- Previous Batch 2 history/video-playback verification limits remain historical limits, not claims of new verification.