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
| `provenance` | object | **Required** when the analyzed artifact is not the camera original. Records the derivation from master to uploaded clip. See structure below. Omit **only** for entries whose `bucket_path` artifact *is* the unmodified master — and see § Pre-schema entries for why omission is not self-describing. |
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

## `provenance` structure (per entry)

| Key | Type | Description |
|---|---|---|
| `source_file_id` | string | Parent Google Drive file ID of the master. ID only — never a share link, which carries an access grant. |
| `source_file_name` | string | Master filename as it exists in Drive, for human cross-reference. |
| `source_bytes` | int | Master byte size, pre-trim. |
| `source_sha256` | hex64 | Content hash of the master. Drive file IDs pin *identity*, not *content* — the same ID serves different bytes after a re-upload or version-history revision, so ID + size alone cannot detect a same-size master swap. If re-hashing the full master is impractical, record Drive's `md5Checksum` instead and set `source_hash_algo` accordingly. |
| `source_hash_algo` | enum `sha256` \| `drive_md5` | Which algorithm `source_sha256` carries. Present so a `drive_md5` value is never mistaken for a SHA-256. |
| `trim_in` | string | Trim in-point, `HH:MM:SS.mmm`, **master-relative**. |
| `trim_out` | string | Trim out-point, `HH:MM:SS.mmm`, **master-relative**. |
| `trim_command` | string | The verbatim `ffmpeg` invocation — exact flags as executed, not a paraphrase or template. Operands normalized to `$MASTER` and `$OUT`; a literal local path is machine-specific and reads as more reproducible than it is. Identity of both operands is carried by `source_file_id` / `source_sha256` and `post_trim_sha256`. |
| `ffmpeg_version` | string | Full `ffmpeg -version` first line (build string included). This is what actually makes `trim_command` reproducible: stream-copy behavior at keyframe boundaries has changed across releases, so identical flags on a different build can produce a different cut. Flags alone do not pin the result. |
| `trim_mode` | enum `stream_copy` \| `reencode` | `stream_copy` is the standing intake rule. `reencode` requires a note stating why **and** an explicit acknowledgement that `body_based_ppy` then measures the transcode, not the camera. |
| `post_trim_bytes` | int | Actual byte size of the uploaded artifact. Must sit under the 170 MiB intake budget (≈15% headroom under the service's 200 MiB `MAX_VIDEO_BYTES` cap). |
| `post_trim_sha256` | hex64 | SHA-256 of the trimmed artifact as uploaded. Ties the entry to exact bytes. |
| `post_trim_verified` | object `{dimensions, codec, profile}` | `ffprobe` readback of the trimmed artifact. Must equal the master on all three. A mismatch means the trim did **not** stream-copy — halt, do not append. |
| `analysis_window` | object `{start_seconds, end_seconds, master_equivalent_start, master_equivalent_end}` | `start_seconds` / `end_seconds` are **relative to the trimmed artifact**, because they feed `athlete_uploads.start_seconds` directly. `master_equivalent_*` records the same window in master time so the entry stays interpretable against the original. The window must be strictly interior to the trim — keyframe imprecision at trim edges is tolerable only if nothing analyzed sits at an edge. |

**Why this is required, not optional:** `body_based_ppy` is derived from pixel data in original-file pixel units. Without provenance, an entry's ppy value cannot be attributed to a camera rather than to a transcode, and the entry becomes unfalsifiable — it can never be re-derived or challenged. An entry lacking `provenance` where the artifact is derived is a schema violation, not an incomplete record.

### Pre-schema entries

Entries appended before this provenance block existed carry **unknown** provenance, not **absent-because-unmodified**. Omission is therefore not self-describing for those rows, and the dataset is append-only so they cannot be retrofitted. Any outcome doc that counts a pre-schema entry toward a threshold (notably A3, where the original n=1 entry counts) must state plainly that its provenance is pre-schema and unknown. That statement belongs alongside the filming-context asymmetry note and the code-reasoned-units note in the same doc.

---

## Append workflow

0. If the analyzed artifact was derived from a master, populate `provenance` **before** running analysis, and confirm `post_trim_verified.dimensions` and `.codec` match the master. If they do not, the trim re-encoded — discard and re-trim. Do not analyze a clip whose provenance cannot be completed.
1. Run analysis on the new clip; capture `calibration_audit` row from Supabase.
2. Estimate true ppy by ≥2 independent methods. Record both.
3. Append a new entry to `entries:` in `ground-truth.yaml`. Preserve every numeric value verbatim — do not round, do not reformat.
4. If the new clip changes the directional finding (e.g., body_based **over**-reports in a new context, or static is suddenly correct), add a "Notes" amendment to `../calibration-ground-truth-dataset.md` Section "Entries" referencing this clip.
5. When `len(entries) >= min_entries_for_b2_decision` AND `len(unique filming contexts) >= min_filming_contexts_for_b2_decision`, the B2 decision (ADR-0004) can be re-opened.
