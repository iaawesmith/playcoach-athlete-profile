# `scripts/verification/` — Index

Single-page index of every verification script in this directory. Each row gives the script's `NAME`, originating `PHASE`, a one-line `VERIFIES` summary, and the canonical run command. The full Pass 6.3 header (NAME / PHASE / VERIFIES / RECIPE / BACKLINKS / MAINTENANCE) lives at the top of each script and is the authoritative contract.

> **Why this exists.** The Pass 6.3 convention is documented across `agents/conventions.md` (the rule), `_template.ts` (the shape), and the headers themselves. This README collapses the triangulation step into one page so a fresh agent can scan all scripts at once and pick the relevant one without grepping. Recipe drift is the underlying lesson — see [F-SLICE-E-3](../../docs/risk-register/F-SLICE-E-3-recipe-propagation-without-independent-verification-process-lesson-no-severity.md): recipes that live in code with backlinks stay current; recipes in prose drift.

## Scripts

| Script | Phase | Verifies | Recipe |
|---|---|---|---|
| [`slice3_verify.ts`](slice3_verify.ts) | PHASE-1C1 (Slice 3) | Position field UI round-trips through `athlete_lab_nodes` and is consumed by the `analyze-athlete-video` edge function exactly as Save writes it. | `npx tsx scripts/verification/slice3_verify.ts` |
| [`slice1c2_r04_backup_assert.ts`](slice1c2_r04_backup_assert.ts) | PHASE-1C2-SLICE-A | R-04 backup completeness — every (node × deletion-target field) pair is byte-equal between `athlete_lab_nodes_phase1c_backup` and the live source. | `npx tsx scripts/verification/slice1c2_r04_backup_assert.ts` |
| [`slice1c2_b1_smoke_compare.ts`](slice1c2_b1_smoke_compare.ts) | PHASE-1C2-SLICE-B1 | Slice B1 trim (4-key MediaPipe payload, det_frequency collapse, dead-fn delete) does not perturb runtime metric output vs the d1b3ab23 baseline (±0.5%). | `deno run --allow-env --allow-net scripts/verification/slice1c2_b1_smoke_compare.ts` |
| [`slice1c_full_pipeline_verification.ts`](slice1c_full_pipeline_verification.ts) | PHASE-1C2 (Slice C) | End-to-end Slant determinism across 5 parallel uploads: calibration_audit byte-identical, PPY values non-null and within ±5%, source flags consistent. | `deno run --allow-env --allow-net scripts/verification/slice1c_full_pipeline_verification.ts` |
| [`slice1c2_d5_post_strip_verify.ts`](slice1c2_d5_post_strip_verify.ts) | PHASE-1C2-SLICE-D | D.3/D.4 JSONB sub-field strips did not perturb calibration math; post-C.5 baseline holds (`body_based_ppy ≈ 200.21`, `static_ppy = 80`, `selected_source = 'body_based'`). | `deno run --allow-env --allow-net scripts/verification/slice1c2_d5_post_strip_verify.ts` |
| [`slice1c2_determinism_cloudrun.ts`](slice1c2_determinism_cloudrun.ts) | PHASE-1C2-SLICE-A (re-used for F-SLICE-E-2) | Cloud Run `/analyze` byte-determinism under the trimmed 4-key payload: 5 parallel POSTs, hash keypoints/scores, assert pairwise equality + variance within ADR-0005 ±1%. | `deno run --allow-env --allow-net --allow-write scripts/verification/slice1c2_determinism_cloudrun.ts` |
| [`check-roadmap-sync.ts`](check-roadmap-sync.ts) | PHASE-1C3-PREP | F-OPS-3 contract — every slice outcome doc with `status: shipped` is referenced in `docs/roadmap.md` by its slice_id (long or short form). Tolerant of pre-template legacy docs. | `bun run scripts/verification/check-roadmap-sync.ts` |
| [`_template.ts`](_template.ts) | n/a (template) | Pass 6.3 header template (NAME / PHASE / VERIFIES / RECIPE / BACKLINKS / MAINTENANCE) for new verification scripts. | not executable — copy-and-fill |

## When to add a new script

A new verification script joins this directory whenever a slice ships an invariant that should remain true after future work. Process:

1. Copy `_template.ts` to a new file (`<phase-slug>_<short-name>.ts`).
2. Fill in NAME / PHASE / VERIFIES / RECIPE / BACKLINKS / MAINTENANCE. The header is the contract — without it, the script is invisible to future maintainers (F-SLICE-E-3 lesson).
3. Add a row to the table above in the same change.
4. Cross-link from the relevant risk-register entry, ADR, or slice outcome doc. BACKLINKS in the script header must match.

## Cross-references

- [`_template.ts`](_template.ts) — the Pass 6.3 header template.
- [`../../docs/agents/conventions.md`](../../docs/agents/conventions.md) Pass 6.3 section — the rule, with rationale.
- [`../../docs/agents/testing-philosophy.md`](../../docs/agents/testing-philosophy.md) §1 — verification scripts in the broader test-discipline frame.
- [`../../docs/risk-register/F-SLICE-E-3-recipe-propagation-without-independent-verification-process-lesson-no-severity.md`](../../docs/risk-register/F-SLICE-E-3-recipe-propagation-without-independent-verification-process-lesson-no-severity.md) — recipe-propagation lesson behind the header contract.
