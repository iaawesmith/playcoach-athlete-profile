# Phase 1c.2 — Slice B1 Outcome

**Date:** 2026-04-25
**Slice:** B1 (non-calibration cleanup; B2 deferred per F-SLICE-B-1)
**Gates:** R-06 (det_frequency parity) PASS · R-08 (MediaPipe contract) ready for live verification · build clean

---

## Scope shipped

1. **MediaPipe payload trim — 4 keys.** `callCloudRun()` signature and `requestPayload` in `supabase/functions/analyze-athlete-video/index.ts` now post exactly: `{ video_url, start_seconds, end_seconds, det_frequency }`. The three accepted-but-ignored fields (`solution_class`, `performance_mode`, `tracking_enabled`) are no longer sent or selected from `fetchNodeConfig`.
2. **det_frequency resolver collapse.** Pre-step migration `UPDATE` persisted resolved values into the per-scenario columns for every node. `getScenarioDetFrequency()` no longer falls back to the root `det_frequency` column at runtime; per-scenario columns are authoritative. Root column preserved in DB until Slice E (backup symmetry).
3. **Dead code deletion.** `supabase/functions/athlete-lab-analyze/` source removed and the function deleted from Supabase deployment. `runAnalysis()` and the `AnalysisResult` import removed from `src/services/athleteLab.ts`. Active path `pollRunAnalysisResult()` → `analyze-athlete-video` unchanged.
4. **Finding 5 / R-08 log line.** `logInfo('mediapipe_request_payload', { uploadId, keys, keyCount })` now fires immediately before every `fetch` to the MediaPipe service. Permanent observability — if the contract drifts, this is the canary.

## Verification

### R-06 — det_frequency parity (byte-equal on resolved integer per scenario per node)

Pre-migration snapshot (from `docs/phase-1c2-detfreq-resolution-snapshot.md`):

| Node | resolved_solo | resolved_defender | resolved_multiple |
|---|---|---|---|
| Slant | 2 | 1 | 1 |

Post-migration query (`SELECT id, name, det_frequency, det_frequency_solo, det_frequency_defender, det_frequency_multiple FROM athlete_lab_nodes;`):

```
                  id                  |  name  | det_frequency | det_frequency_solo | det_frequency_defender | det_frequency_multiple
--------------------------------------+--------+---------------+--------------------+------------------------+------------------------
 75ed4b18-8a22-440e-9a23-b86204956056 | Slant  |             7 |                  2 |                      1 |                      1
(1 row)
```

**Result: PASS.** Byte-equal on every resolved integer (2=2, 1=1, 1=1). Idempotent UPDATE behaved exactly as the snapshot predicted.

Comparison invariant per `docs/migration-risk-register.md` §3.5: byte-equal on canonical integer form (resolved scalar; no JSON re-serialization). Correct invariant for this data shape.

### R-08 — MediaPipe payload contract (set equality on key set)

**Static evidence (code-level):**
- `requestPayload` literal in `callCloudRun()` (`supabase/functions/analyze-athlete-video/index.ts:3373–3378`) declares exactly four keys: `video_url`, `start_seconds`, `end_seconds`, `det_frequency`.
- Final ripgrep sweep `rg -n "solution_class|performance_mode|tracking_enabled" supabase/functions/analyze-athlete-video/index.ts` returns **only one match** — the explanatory comment on line 3372. Zero remaining live references.
- `fetchNodeConfig()` SELECT no longer requests these columns from `athlete_lab_nodes`, eliminating any accidental future re-introduction via destructuring.

**Live evidence (pending Live Browser Smoke):** the `mediapipe_request_payload` log line will emit `keyCount: 4` and `keys: ["video_url","start_seconds","end_seconds","det_frequency"]` on the next analysis. Verify in `supabase--edge_function_logs` filtered on `mediapipe_request_payload` after the smoke test.

Comparison invariant per `docs/migration-risk-register.md` §3.5: set equality on key set (token-extraction contract; order and multiplicity are not invariants). Correct invariant for this data shape.

### R-09 — Template variable safety (set membership)

No template variables added or removed in B1. `llm_prompt_template` and `llm_system_instructions` substitution surface unchanged. R-09 will be re-asserted before Slice E drops.

### Build

`bunx tsc --noEmit` — exit 0, no errors. The `AnalysisResult` interface in `src/features/athlete-lab/types.ts` is now unused but intentionally untouched in B1 (non-blocking; can be removed in Slice C cleanup).

### Live Browser Smoke (pending)

Per protocol:
1. Open `/athlete-lab` in admin UI.
2. Select Slant node.
3. Trigger one end-to-end analysis on the standing test clip.
4. Confirm:
   - Analysis completes without console errors beyond baseline.
   - All 4 metric scores produce.
   - Calibration source is unchanged from baseline (still `body_based` for off-spec clips — B1 does NOT touch the calibration path; F-SLICE-B-1 deferred to B2).
   - `mediapipe_request_payload` log line shows `keyCount: 4`.
   - Metric values within ±5% of baseline `docs/phase-1c2-baseline-slant-analysis.md` (calibration unchanged → expect near-identical values).

Halt and surface as Finding if any check fails. ±5% threshold is intentionally tight in B1 because the calibration path is unchanged; any larger shift indicates non-calibration plumbing regression.

## What did NOT ship in B1

Per F-SLICE-B-1 (recorded in `docs/migration-risk-register.md`): `calculateBodyBasedCalibration` deletion deferred to Slice B2. Pre-conditions: filming-instructions update, ≥5 on-spec admin test clips, empirical resolution of the trace-vs-investigation arithmetic disagreement on what "true ppy" means for the d1b3ab23 baseline clip.

## Gate to Slice C

B1 is ready to ship. Live Browser Smoke is the final gate; on PASS, proceed to Slice C (SectionTooltip forwardRef fix, onStatusChange no-op prop removal, athlete_height removal from admin types).
