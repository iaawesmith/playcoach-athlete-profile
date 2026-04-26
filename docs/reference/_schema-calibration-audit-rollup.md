# `calibration-audit-rollup.csv` — schema

> Generated artefact. **Do not hand-edit.** Produced by `scripts/aggregate-calibration-audit.ts` (Pass 5e-bis). Re-run the script after any clip is added to `docs/reference/calibration/*.yaml`. Convention: see [`../agents/conventions.md`](../agents/conventions.md) § "Calibration audit rollup."

## Source of truth

- **Clip registry:** every `*.yaml` under [`./calibration/`](./calibration/), joined to `athlete_uploads.video_url` by suffix-match on `bucket_path`.
- **Per-row payload:** `athlete_lab_results.result_data.calibration_audit` (introduced by Slice C.5; pre-C.5 rows lack this field and are skipped — see [ADR-0014](../adr/0014-c5-unified-edge-function-body-based-path.md)).

## Columns (fixed order)

| # | Column | Type | Source / derivation |
|---|---|---|---|
| 1 | `clip_id` | string | `file_identifier` from the clip's YAML entry. |
| 2 | `upload_id` | uuid | `athlete_uploads.id` |
| 3 | `result_id` | uuid | `athlete_lab_results.id` |
| 4 | `analyzed_at` | ISO-8601 timestamp | `athlete_lab_results.analyzed_at` |
| 5 | `body_based_ppy` | float64 verbatim | `result_data.calibration_audit.body_based_ppy` |
| 6 | `body_based_confidence` | float64 verbatim | `result_data.calibration_audit.body_based_confidence` |
| 7 | `selected_ppy` | float64 verbatim | `result_data.calibration_audit.selected_ppy` |
| 8 | `static_ppy` | number verbatim | `result_data.calibration_audit.static_ppy` |
| 9 | `calibration_audit_hash` | hex (sha-256) | SHA-256 of canonicalized `calibration_audit` (keys sorted, no whitespace). Use the **full** hex; the truncated short-hash form used in `determinism-drift.csv` aliases distinct payloads. |
| 10 | `group` | A/B/C/... | Per-clip first-seen-order over `calibration_audit_hash`. Baseline (earliest `analyzed_at`) is always `A`. |
| 11 | `delta_pct_vs_baseline` | float (4 dp) | `(body_based_ppy / baseline_body_based_ppy − 1) × 100`, where the baseline is the earliest row per `clip_id`. Empty if either value is null. |
| 12 | `notes` | string | Reserved for human annotation in append-only follow-ups; populated empty by the script. |

## Determinism / idempotency contract

- Rows sorted by `(clip_id, analyzed_at ASC, upload_id)`.
- Numeric values written verbatim from the JSON payload — no rounding.
- Re-running the script with no DB changes overwrites the file with byte-identical content (see md5 check in Pass 5e-bis surface).

## Halt conditions

- Any registered clip resolving to **zero** uploads ⇒ exit non-zero, log `F-SLICE-1C2-CLEANUP-1`.
- A result row with no `calibration_audit` field is **skipped** (logged to stderr, counted in summary). Pre-C.5 historical rows are expected here.

## Risk-register backlinks

- [`F-SLICE-B-1`](../risk-register/F-SLICE-B-1-both-calibration-paths-produce-2-6-distance-errors-static-only.md) — both calibration paths produce 2.6× distance errors.
- [`F-SLICE-B1-2`](../risk-register/F-SLICE-B1-2-release-speed-metric-correctness-on-slant-route-reference-v1-mp4.md) — release-speed metric correctness on the slant-route reference clip.
- [`F-SLICE-E-2`](../risk-register/F-SLICE-E-2-pipeline-calibration-audit-shows-0-78-non-deterministic-drift-on-identical.md) — ~0.78% non-deterministic drift on identical input.

## Relationship to other artefacts

- [`calibration-audit-rollup.md`](./calibration-audit-rollup.md) — human-readable rollup; cross-references this CSV.
- [`determinism-drift.csv`](./determinism-drift.csv) (Pass 3c) — overlapping but **hand-curated**; its `hash` column uses a short alias that conflates two distinct full hashes (`26603f63…` vs `884b740b…`). The Pass 5e-bis script surfaces the finer split.
