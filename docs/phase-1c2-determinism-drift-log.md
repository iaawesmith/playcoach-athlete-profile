# Phase 1c.2 — Pipeline Determinism Drift Log

**Established:** 2026-04-26
**Purpose:** Append-only longitudinal record of pipeline `calibration_audit` hash observations against the canonical determinism baseline. Used to characterize the noise floor of the body-based calibration path and to detect any regression that exceeds the established drift envelope.

**Scope:** All E-phase verification runs and any future verification runs against the canonical Slant reference clip.

---

## Canonical baseline (reference)

- **Hash:** `34a8712604547408d5b8c2c7d5c37a281eaf9c9d83619dc1f6668a4e29afcc77`
- **Recipe:** SHA-256 of canonical JSON (sorted keys, no whitespace, UTF-8) of `result_data.calibration_audit`
- **Established from:** 6 historical Slant runs (Slice C 5-run determinism set + 1 Slice D D.5 run)
- **Reference clip:** `athlete-videos/test-clips/slant-route-reference-v1.mp4`
- **Reference inputs:** node `75ed4b18-8a22-440e-9a23-b86204956056` (Slant), athlete `8f42b1c3-5d9e-4a7b-b2e1-9c3f4d5a6e7b`, `start_seconds=0`, `end_seconds=3`, `camera_angle=sideline`, `athlete_height=74"`
- **Baseline numeric values:**
  - `body_based_ppy` = `200.21353797230793`
  - `body_based_confidence` = `0.78658371191…`
  - `selected_ppy` = `200.21353797230793`
  - `static_ppy` = `80`

## Decision matrix (Option D)

| Condition | Outcome |
|---|---|
| Hash exact match | ✅ Pass |
| Categorical fields exact + numeric drift ≤ ±1% | ✅ Pass + log |
| Numeric drift > ±1% and ≤ ±2% | ❌ Halt for investigation |
| Numeric drift > ±2% | ❌ Halt — regression |
| Any categorical mismatch | ❌ Halt |

---

## Observation log

### Historical seed observations (from Option C scan)

| date (UTC) | upload_id | result_id | hash | group | body_based_ppy | Δ vs baseline | outcome |
|---|---|---|---|---|---|---|---|
| 2026-04-26 01:08:25 | `528f296a-63ce-4355-ba46-241c97f78f43` | `f027103e-…` | `34a87126…` | A | 200.21353797 | 0.000% | baseline |
| 2026-04-26 01:08:25 | `0a477dc7-d1d5-4aaa-891e-2dafcce84bac` | `ca6e805e-…` | `34a87126…` | A | 200.21353797 | 0.000% | baseline |
| 2026-04-26 01:08:25 | `a9ece02b-c4bb-4e49-98b4-0a4b64f1ce07` | `a98d02b9-…` | `34a87126…` | A | 200.21353797 | 0.000% | baseline |
| 2026-04-26 01:08:25 | `c946e1ad-45ac-46d6-b059-b4194185fc34` | `3605ff5d-…` | `34a87126…` | A | 200.21353797 | 0.000% | baseline |
| 2026-04-26 01:08:25 | `0527f664-ea84-45dc-a5c6-6072e256b809` | `3a269037-…` | `34a87126…` | A | 200.21353797 | 0.000% | baseline |
| 2026-04-26 01:47:22 | `d2df20e9-f827-4b58-8674-cbb4917cc7fc` | `4754d0c8-…` | `34a87126…` | A | 200.21353797 | 0.000% | baseline |
| 2026-04-26 01:56:35 | `a164c815-0fa7-4705-8970-910fe93ef859` | `a120daa7-…` | `26603f63…` | **B** | 201.78272550 | **+0.784%** | drift (within ±1%; logged for F-SLICE-E-2) |

**Drift envelope to date:** [+0.000%, +0.784%] across 7 in-spec runs. Single off-baseline observation. ±1% tolerance band has 27% headroom over observed drift; ±2% has 155% headroom.

### E-phase verification runs

*(Append new observations below as E.0, E.3.6, and any future verification runs complete.)*

