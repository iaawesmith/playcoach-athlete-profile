# Phase 1c.2 — Deletion Phase

## Status
- Pre-Slice-A artifacts: ✅ complete (camera_guidelines pre-flight, det_frequency snapshot, baseline Slant analysis)
- Slice sequencing: A → B → C → D → E **serial** (not parallel)
- Tab 8 calibration architecture: **Option A provisional** — pending Slice B doc reads
- Verification: R-04, R-06, R-09 assertion scripts; R-08 contract verification via edge log; Live Browser Smoke per slice

## Active slice
**Slice B1 — Non-calibration cleanup** (in flight). Slice A complete (R-04 PASS, 14/14).

## Slice A scope (✅ done)
1. Created `athlete_lab_nodes_phase1c_backup` (id, node_id, source_column, content, disposition, audit_pattern, audit_reason, original_intent, captured_at, slice).
2. Inserted 14 audit-rich rows for Slant covering 10 root columns + 4 JSONB sources.
3. R-04 backup completeness assertion passed (`scripts/slice1c2_r04_backup_assert.ts`) — text fields byte-equal, JSONB sources semantic deep-equal.

## Slice B split (post doc-read, post F-SLICE-B-1 finding)
Doc reads of `../docs/investigations/calibration-source-trace.md` and `../docs/investigations/calibration-ppy-investigation.md` surfaced **F-SLICE-B-1**: the two docs disagree on what "true ppy" means for the d1b3ab23 baseline clip (trace assumes static=true, investigation assumes neither path is true). Without empirical resolution, deletion of `calculateBodyBasedCalibration` is premature by the investigation doc's own Recommendation B standard ("ship after ~10 admin tests post-tightening").

Slice B is therefore split:

### Slice B1 scope (proceed now — non-calibration cleanup)
1. **MediaPipe payload trim:** drop `solution_class`, `performance_mode`, `tracking_enabled` from the POST body to `/analyze` and from the `callCloudRun` signature. New 4-key payload: `video_url`, `start_seconds`, `end_seconds`, `det_frequency`.
2. **det_frequency resolver collapse + pre-step UPDATE:** persist resolved values into per-scenario columns (idempotent for Slant per snapshot). Simplify `getScenarioDetFrequency` to read only the per-scenario columns (no more root-`det_frequency` fallback in the resolver — root is preserved in DB until Slice E for backup symmetry, but no longer consulted at runtime).
3. **Delete dead `athlete-lab-analyze` edge function.** Also delete the only client caller `runAnalysis()` in `src/services/athleteLab.ts` and the now-unused import. Keep the active `pollRunAnalysisResult` path (calls live `analyze-athlete-video`).
4. **Add Finding 5 log line:** `logInfo('mediapipe_request_payload', { keys: Object.keys(requestPayload), keyCount: Object.keys(requestPayload).length })` immediately before the `fetch` call in `callCloudRun`. Permanent observability for R-08 contract verification.

### Slice B1 verification
| Check | Method | Threshold | On exceed |
|---|---|---|---|
| Build | `tsc` clean | no new errors | halt |
| R-06 (det_frequency parity) | byte-equal on integer per scenario per node | exact | halt |
| R-08 (payload contract) | edge log shows exactly 4 keys | exact key set `{video_url, start_seconds, end_seconds, det_frequency}` | halt |
| R-09 (template variables) | re-run scan against post-B1 known-variable list | no growth in `missing_variables` | halt |
| Live Browser Smoke | open Slant in `/athlete-lab`, trigger one analysis end-to-end | analysis completes, calibration source unchanged (still `body_based` for off-spec clips), all 4 metric scores produce | halt and surface |
| Metric value parity vs baseline | compare against `docs/phase-1c2-baseline-slant-analysis.md` | **±5% on all 4 metrics** (calibration path unchanged in B1, expect near-identical values) | halt — indicates regression in non-calibration plumbing |

Document outcome in `docs/phase-1c2-slice-b1-outcome.md`.

### Slice B2 scope (deferred — post-1c.2, gated)
- Delete `calculateBodyBasedCalibration` and its call sites; static reference becomes the only fallback (Tab 8 Option A).
- **Pre-conditions (all three required, no schedule):**
  1. Slant `camera_filming_instructions` update ships (post-1c.2 backlog, see below) with explicit filming-distance specification matching the static reference geometry.
  2. ≥5 admin test clips collected post-instructions-update demonstrating static produces accurate metrics on on-spec filming.
  3. Empirical resolution of trace-vs-investigation arithmetic disagreement on what "true ppy" means for the d1b3ab23 baseline clip — either via re-running d1b3ab23 with on-spec re-filming, or via ground-truth measurement of the clip's actual pixel-per-yard via a known-distance landmark.
- B2 metric-value thresholds (when it eventually ships): **±5% angle metrics**, **±50% distance/velocity** (calibration path changes — drift expected and bounded).
- Tab 8 calibration architecture decision is deferred with B2. 1c.2 closes with body-based code path still in place.

## Slice C–E scope (unchanged)
- **C:** SectionTooltip `forwardRef` fix, `onStatusChange` no-op prop removal, remove `athlete_height` from admin types.
- **D:** `phase_context_mode` CHECK constraint (`'full' | 'compact' | 'names_only'`); strip targeted sub-fields from `camera_guidelines` JSONB (preserve `camera_filming_instructions`); strip non-`pixels_per_yard` fields from `reference_calibrations[]`.
- **E:** Root column drops (10 fields including `pro_mechanics`, `llm_tone`, `det_frequency`, etc.) gated on R-04 / R-06 / R-09 re-assertions.

## Post-1c.2 backlog (admin authoring — NOT code work)
- **Slant `camera_filming_instructions` content drift:** the admin-authored text currently says "the athlete's height in their profile will be used as a reference," which becomes factually wrong after Slice C removes `athlete_height`. Update Slant's filming instructions to remove the athlete_height reference, replace with an accurate description of the new (static-only) calibration model, AND add explicit filming-distance specification matching the static reference geometry (~25–40 yd sideline). Bundles with B2 pre-condition #1.

## Risk register references
- R-04 (Sev-1, irreversible): backup completeness — ✅ passed for Slice A; gates Slice E execution.
- R-06: det_frequency resolution parity — trivially passes per pre-Slice-A snapshot; re-asserted in B1.
- R-08: MediaPipe request contract — verified via `mediapipe_request_payload` edge log line shipping in B1.
- R-09: llm_prompt_template variable safety — re-asserted in B1 and before Slice E drops.
- F-SLICE-B-1 (Sev-3, non-blocking for B1, gates B2): body_based deletion premature without empirical ppy ground truth. See doc reads in `docs/calibration-source-trace.md` and `docs/calibration-ppy-investigation.md`.
