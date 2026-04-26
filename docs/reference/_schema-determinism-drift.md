# Determinism Drift Log — Schema

**Source of truth:** [`determinism-drift.csv`](determinism-drift.csv).

This schema defines the structured replacement for the prose tables that lived in the determinism drift log. The full prose record (canonical baseline, decision matrix, per-phase interpretation paragraphs) remains canonical at [`./phase-1c2-determinism-drift-log.md`](phase-1c2-determinism-drift-log.md). The CSV is the canonical structured record for per-run observations.

When a new verification run is performed against the canonical Slant clip, append a row to `determinism-drift.csv` first. Add a narrative interpretation paragraph to the prose log only if the run reveals new information about the noise floor (new mode, regression, etc.).

---

## Canonical baseline (constants — not in CSV)

| Field | Value |
|---|---|
| Hash | `34a8712604547408d5b8c2c7d5c37a281eaf9c9d83619dc1f6668a4e29afcc77` |
| Recipe | SHA-256 of canonical JSON (sorted keys, no whitespace, UTF-8) of `result_data.calibration_audit` |
| Established from | 6 historical Slant runs (Slice C 5-run + 1 Slice D D.5 run) |
| Reference clip | `athlete-videos/test-clips/slant-route-reference-v1.mp4` |
| Reference inputs | node `75ed4b18-8a22-440e-9a23-b86204956056` (Slant), athlete `8f42b1c3-5d9e-4a7b-b2e1-9c3f4d5a6e7b`, `start_seconds=0`, `end_seconds=3`, `camera_angle=sideline`, `athlete_height=74"` |
| Baseline `body_based_ppy` | `200.21353797230793` |
| Baseline `body_based_confidence` | `0.78658371191…` |
| Baseline `selected_ppy` | `200.21353797230793` |
| Baseline `static_ppy` | `80` |

## Decision matrix (Option D)

| Condition | Outcome |
|---|---|
| Hash exact match | Pass |
| Categoricals exact + numeric drift ≤ ±1% | Pass + log |
| Numeric drift > ±1% and ≤ ±2% | Halt for investigation |
| Numeric drift > ±2% | Halt — regression |
| Any categorical mismatch | Halt |

---

## CSV columns

| Column | Type | Description |
|---|---|---|
| `date_utc` | ISO timestamp (UTC) | Wall-clock time of the run. |
| `upload_id` | UUID | Row in `athlete_uploads`. |
| `result_id_prefix` | string | First 8 chars of the `athlete_lab_results.id` (full ID kept for redaction tolerance). |
| `hash` | hex64 | SHA-256 of canonical-JSON `calibration_audit`. |
| `group` | enum `A` \| `B` | Drift mode — `A` = baseline-exact, `B` = +0.784% bimodal mode. |
| `body_based_ppy` | float | Recorded value, full precision. |
| `body_based_confidence` | float \| null | Null for historical seed rows where confidence was not captured separately. |
| `selected_ppy` | float | Recorded value. |
| `static_ppy` | float \| null | `80` when captured; null for historical seed rows where it was not separately recorded. |
| `delta_pct_vs_baseline` | float | Drift in `body_based_ppy` vs baseline (signed). `0.000` for Group A. |
| `categoricals_exact` | bool | True if all categorical fields match baseline. |
| `outcome` | string | `baseline`, `pass-exact`, `pass-within-tolerance`, `halt-investigate`, `halt-regression`. |
| `phase` | string | `historical-seed`, `E.0`, `E.3.6`, etc. |
| `experiment_tag` | string \| null | Experiment label when present. |
| `change_under_test` | string \| null | What code change preceded this run. Null for seed rows. |
| `pipeline_runtime_s` | int \| null | Approximate runtime in seconds. |
| `notes` | string | Anything noteworthy (sub-precision drift, bit-identity with prior row, etc.). |

---

## Append workflow

1. Run analysis on the canonical Slant clip with the recipe inputs.
2. Compute the canonical-JSON SHA-256 hash of `calibration_audit`.
3. Append a row to `determinism-drift.csv` — preserve `body_based_ppy` to full double precision (do **not** truncate). Compute `delta_pct_vs_baseline` to 4 decimal places.
4. Apply the decision matrix above. If outcome is anything other than `pass-exact` or `pass-within-tolerance`, **halt and add a narrative interpretation paragraph to `phase-1c2-determinism-drift-log.md`** before continuing pipeline work.
5. If a new bimodal mode appears (a second non-A non-B hash), update `_schema.md` and the F-SLICE-E-2 risk-register entry to reflect.
