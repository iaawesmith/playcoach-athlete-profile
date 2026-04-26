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
- **Finding:** Hashing `result_data.calibration_audit` (canonical sorted-keys SHA-256, UTF-8) across 9 historical Slant runs (node `75ed4b18`, athlete `8f42b1c3…`, identical clip, identical params) initially appeared to yield 3 hash groups. **Pass 5e-bis full-hash analysis revised this to 4 groups across 9 calibration-bearing rows (12 additional pre-C.5 rows lack the payload):**
  - **Group A** (7 runs, baseline): `34a8712604547408d5b8c2c7d5c37a281eaf9c9d83619dc1f6668a4e29afcc77`. `body_based_ppy = 200.21353797234588`, `body_based_confidence = 0.7865837119124024`. Spans Slice C 5-run determinism set + 1 Slice D D.5 run + 1 E.0 verification run.
  - **Group B** (1 run): `26603f63a77266f3a2f7e2c0dc4ae0cb5e37126353f7e9b65a3cdf3398c4d032`. `body_based_ppy = 201.7827255013638` (Δ +0.78% from Group A), `body_based_confidence = 0.7817768960473507`.
  - **Group C** (1 run, E.3.6 post-migration): `884b740b6f5fe4286c4454b381fed613a1dfeb30c22656ed4b735fde23b361e9`. `body_based_ppy = 201.7827255013638` (**bit-identical to Group B's `body_based_ppy`**), but `body_based_confidence = 0.7818235851106613` (differs from Group B by Δ +5.97e-5 absolute). **Full payload is NOT bit-identical to Group B** — the full-hash analysis distinguishes them; the Pass 3c determinism CSV's previous short-hash form (`26603f63`) had aliased Groups B and C together.
  - **Group D** (historical, separate input class — not represented in current calibration-bearing rows): `athlete_height_provided = false`; pipeline correctly fell back to static. Recorded for completeness; not a determinism issue.
- **Diagnosis:** Identical-input runs produce **multiple distinct `calibration_audit` payloads**. Suspected (not confirmed) sources unchanged: floating-point variance in MediaPipe/RTMlib pose estimation, GPU non-determinism, model variance across Cloud Run cold/warm starts, frame-sampling jitter.
- **Decision:** Bit-exact determinism gates are unsafe. E-phase verification adopts Option D (tolerance-based check):
  - Hash matches Group A baseline exactly → pass.
  - Numeric drift within ±1% (categoricals exact match) → pass + log drift amounts.
  - Numeric drift between ±1% and ±2% → halt for investigation.
  - Drift > ±2% → halt with high confidence of regression.
- **Open diagnostic questions (deferred — investigation does NOT gate Slice E, but should precede Phase 2 metric-quality work):**
  1. Is drift in Cloud Run keypoint output or in edge-side `calculateBodyBasedCalibration`? (Hash Cloud Run keypoint NDJSON across Group A vs Group B vs Group C runs.)
  2. Do other metrics (Plant Leg Extension, Hip Stability, Release Speed, Hands Extension) drift in lockstep with `body_based_ppy`, or only body-based-derived values? (Lockstep → upstream layer; isolated → calibration-specific.)
  3. What is the magnitude distribution of drift? (Run 10+ fresh analyses on identical inputs in a single batch; cost ~$0.50.)
- **Severity:** Sev-2 (real pipeline noise floor; affects metric accuracy ceiling for Phase 2 work).
- **Cross-references:** `docs/process/phase-1c2-slice-e-outcome.md` (Group A/B analysis); `docs/reference/phase-1c2-determinism-drift-log.md` (longitudinal observations); `docs/reference/calibration-ground-truth-dataset.md` (~1% noise floor notation); `docs/process/phase-1c2-determinism-experiment.md` (carries a Pass 5e-bis clarification banner about the original "bimodal" framing).
- **Update 2026-04-26 (post-E.3.6) — multimodal, not bimodal:** Initial framing (recorded in `docs/process/phase-1c2-determinism-experiment.md` and an earlier revision of this entry) hypothesized **bimodal** discrete output behavior, on the basis that E.3.6's `body_based_ppy = 201.7827255013638` was bit-identical to historical run `a164c815`. Pass 5e-bis full-SHA-256 analysis (via `scripts/aggregate-calibration-audit.ts`) shows the two payloads are **NOT** bit-identical end-to-end — they diverge in `body_based_confidence`. **`body_based_ppy` bit-identity does not imply `calibration_audit` payload bit-identity.** Revised framing: pipeline is **multimodal** in the full payload, with `body_based_ppy` occasionally aligning across distinct payloads. The bimodal-cluster prediction is therefore **already falsified** for the full payload; whether `body_based_ppy` *alone* clusters bimodally remains an open Phase 2 question (predicted under one hypothesis; needs N≥10 fresh batch).
- **Phase 2 investigation guidance:**
  - **Use full-SHA-256 hash analysis, not `body_based_ppy` comparison.** The aggregate-calibration-audit.ts script is the primary tool; rerun it after each new batch and inspect `calibration_audit_hash` + `body_based_confidence` together.
  - Run 10+ analyses on identical inputs in a single batch.
  - **Predicted result under "discrete branch in pose estimator" hypothesis:** small finite number of distinct full hashes (≤4) with `body_based_ppy` clustering at ≤2 distinct values.
  - **Falsification of any discrete-branch hypothesis:** distinct full hashes scale roughly linearly with batch size (continuous noise) AND `body_based_ppy` produces 5+ distinct values in 10 runs.
