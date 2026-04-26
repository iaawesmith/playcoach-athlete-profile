---
id: F-SLICE-E-2
title: Pipeline `calibration_audit` shows ~0.78% non-deterministic drift on identical inputs (Sev-2)
status: open
severity: Sev-2
origin_slice: 1c.2-Slice-E
origin_doc: docs/process/phase-1c2-slice-e-outcome.md
related_adrs: [ADR-0004, ADR-0005, ADR-0006]
related_entries: []
opened: 2026-04-26
last_updated: 2026-04-26
---

# F-SLICE-E-2 — Pipeline `calibration_audit` shows ~0.78% non-deterministic drift on identical inputs (Sev-2)

- **Logged:** 2026-04-26, Slice E pre-flight (Option C scan)
- **Finding:** Hashing `result_data.calibration_audit` (canonical sorted-keys SHA-256, UTF-8) across 9 historical Slant runs (node `75ed4b18`, athlete `8f42b1c3…`, identical clip, identical params) yielded **3 distinct hash groups**:
  - **Group A** (6 runs, baseline): `34a87126…`. `body_based_ppy = 200.2135`, `body_based_confidence = 0.7866`. Spans Slice C 5-run determinism set + 1 Slice D D.5 run.
  - **Group B** (1 run, drift): `26603f63…`. `body_based_ppy = 201.7827` (Δ +0.78% from Group A), `body_based_confidence = 0.7818` (Δ −0.61%). Same input tags as a Group A run.
  - **Group C** (2 runs, different inputs): `51f5f268…`. `athlete_height_provided = false`; pipeline correctly fell back to static. Not a determinism issue.
- **Diagnosis:** Identical-input runs producing different `body_based_ppy` values demonstrate the pipeline is not bit-exact deterministic. Suspected (not confirmed) sources: floating-point variance in MediaPipe/RTMlib pose estimation, GPU non-determinism, model variance across Cloud Run cold/warm starts, frame-sampling jitter.
- **Decision:** Bit-exact determinism gates are unsafe. E-phase verification adopts Option D (tolerance-based check):
  - Hash matches `34a87126…` exactly → pass.
  - Numeric drift within ±1% (categoricals exact match) → pass + log drift amounts.
  - Numeric drift between ±1% and ±2% → halt for investigation.
  - Drift > ±2% → halt with high confidence of regression.
- **Open diagnostic questions (deferred — investigation does NOT gate Slice E, but should precede Phase 2 metric-quality work):**
  1. Is drift in Cloud Run keypoint output or in edge-side `calculateBodyBasedCalibration`? (Hash Cloud Run keypoint NDJSON across Group A vs Group B runs.)
  2. Do other metrics (Plant Leg Extension, Hip Stability, Release Speed, Hands Extension) drift in lockstep with `body_based_ppy`, or only body-based-derived values? (Lockstep → upstream layer; isolated → calibration-specific.)
  3. What is the magnitude distribution of drift? (Run 5 fresh analyses on identical inputs in a single batch; cost ~$0.25.)
- **Severity:** Sev-2 (real pipeline noise floor; affects metric accuracy ceiling for Phase 2 work).
- **Cross-references:** `docs/phase-1c2-slice-e-outcome.md` (Group A/B/C analysis); `docs/phase-1c2-determinism-drift-log.md` (longitudinal observations); `docs/calibration-ground-truth-dataset.md` (~1% noise floor notation).
- **Update 2026-04-26 (post-E.3.6) — bimodal hypothesis:** E.3.6 observation produced `body_based_ppy = 201.7827255013638`, **bit-identical** to the historical Group B observation (run `a164c815`). Two independent observations producing identical drifted values strongly suggests **discrete bimodal behavior** rather than continuous floating-point noise. Updated hypothesis: drift correlates with a discrete branch in the pipeline — possibilities include Cloud Run cold-vs-warm instance state, GPU vs CPU pose-estimation fallback, or model-weight version served from different replicas. Discrete bimodal patterns are substantially more tractable to investigate than continuous random drift.
- **Phase 2 investigation guidance:** Run 10+ analyses on identical inputs in a single batch. **Predicted result if bimodal:** outputs cluster at exactly 2 distinct values (`200.2135…` and `201.7827…`). **Falsification:** if 3+ distinct values appear, the bimodal hypothesis is wrong and continuous drift is back on the table.
