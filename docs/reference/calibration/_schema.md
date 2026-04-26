# Calibration Ground Truth — Schema

**Source of truth:** [`ground-truth.yaml`](ground-truth.yaml).

This schema defines the structured replacement for the prose dataset that lives at [`../calibration-ground-truth-dataset.md`](../calibration-ground-truth-dataset.md). Both files coexist during Phase 1c.2 cleanup; the prose doc is the canonical narrative (methodology, multi-context implication, B2 decision framing), and the YAML is the canonical structured record (numeric values, longitudinal entries, future-entry append target).

When a new clip is analyzed, append an entry to `ground-truth.yaml` first. Add narrative methodology / framing updates to the prose doc only if the new clip changes the directional finding or the B2 decision basis.

---

## Top-level keys

| Key | Type | Description |
|---|---|---|
| `version` | int | Schema version. Bump on breaking schema changes. |
| `dataset_established` | ISO date | When the dataset was first opened. |
| `noise_floor_pct` | float | Empirically observed `body_based_ppy` pipeline drift on identical inputs (relative %). |
| `noise_floor_origin` | string | Pointer to the finding/risk that established the noise floor. |
| `min_entries_for_b2_decision` | int | Per F-SLICE-B-1, the minimum clip count before the B2 architectural decision can be re-opened. |
| `min_filming_contexts_for_b2_decision` | int | Distinct filming contexts required alongside the entry threshold. |
| `entries` | list | Per-clip entries (see schema below). |
| `future_entries_needed` | list | Outstanding clip categories needed before the B2 decision can be re-opened. |

---

## Per-entry schema (under `entries:`)

| Key | Type | Description |
|---|---|---|
| `file_identifier` | string | Stable name. Never a signed URL. |
| `bucket_path` | string | `athlete-videos/...` storage path. |
| `video_dimensions` | object `{width, height, notes}` | Master file dimensions. `notes` flags preview-vs-master discrepancies. |
| `true_ppy_estimate` | object `{point, range_low, range_high, basis}` | Best estimate (point) and defensible range. `basis` cites the methodology. |
| `measurement_methodology` | list | Each method has `id`, `name`, `inputs`, `derived_value`, `notes`. |
| `body_based_ppy_at_time_of_measurement` | object | Per-code-path values, longitudinal sub-entries, and the unified path's run-to-run drift figure. See structure in `ground-truth.yaml`. |
| `static_ppy_at_time_of_measurement` | float | Deterministic; no noise floor. |
| `path_disagreement_pct` | object `{cloud_run_vs_edge_low, cloud_run_vs_edge_high}` | Disagreement between code paths on this clip. |
| `measurement_confidence` | enum | `low` / `medium` / `high`. |
| `directional_finding` | object | `body_based_off_factor_low/high`, `static_off_factor_low/high`, `invariant_under_uncertainty` flag. |
| `notes` | object | Filming context, bbox contamination, posture compression, multi-context implication. |
| `recorded_at` | ISO date | When the entry was added. |

---

## Append workflow

1. Run analysis on the new clip; capture `calibration_audit` row from Supabase.
2. Estimate true ppy by ≥2 independent methods. Record both.
3. Append a new entry to `entries:` in `ground-truth.yaml`. Preserve every numeric value verbatim — do not round, do not reformat.
4. If the new clip changes the directional finding (e.g., body_based **over**-reports in a new context, or static is suddenly correct), add a "Notes" amendment to `../calibration-ground-truth-dataset.md` Section "Entries" referencing this clip.
5. When `len(entries) >= min_entries_for_b2_decision` AND `len(unique filming contexts) >= min_filming_contexts_for_b2_decision`, the B2 decision (ADR-0004) can be re-opened.
