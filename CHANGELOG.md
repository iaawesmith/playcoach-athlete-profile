# Changelog

All notable changes to PlayCoach are recorded here. Format inspired by
[Keep a Changelog](https://keepachangelog.com/); versioning aligns with
phase identifiers (`PHASE-NN[a/b/c]`) rather than semver until public launch.

Entry shape:

```
## [<phase-id>] — YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Deprecated
- ...

### Removed
- ...

### Security
- ...
```

Cross-link risk-register IDs (`R-NN`, `F-*`) and ADR IDs (`ADR-NNNN`) inline
where applicable.

---

## [Phase 1c.2 — cleanup refinements] — 2026-04-26

Five small additive documentation refinements landed post-Pass-6 to address concerns surfaced during the org assessment. No existing content rewritten or removed; no new R2 stubs; no structural changes.

### Added
- **`docs/risk-register/_schema.md`** — new `## When these rules apply` header inserted before the existing `## Status field derivation` section. Clarifies that the derivation rules below were one-time Pass-4-split-script logic and that new entries created going forward populate frontmatter directly at creation time. (Refinement 1.)
- **`docs/agents/conventions.md`** — four new sections appended after `## Structured vs prose` and before `## Pass 5 sub-conventions`:
  - `## Process vs investigations distinction` — codifies that `docs/process/` holds slice-aligned outcomes and `docs/investigations/` holds free-standing diagnostic work; documents the `phase-1c2-determinism-experiment.md` edge case explicitly. (Refinement 3.)
  - `## Investigations directory curation` — defines the new/concluded/archived lifecycle for investigation docs and earmarks Phase 1c.3 cleanup to review and archive entries superseded for two or more phases. (Refinement 2.)
  - `## Reference directory composition (forward-looking note)` — enumerates the five current content types in `docs/reference/` and sets a trigger (>20 files, or any single content type >8 files) for evaluating sub-organization. Trigger-evaluation only — no auto-execution. (Refinement 4.)
  - `## ADR supersession convention` — full procedure for new-ADR / old-ADR / cross-reference / INDEX updates when superseding, with an ADR-0004 worked example. (Refinement 5.)
- **`docs/adr/template.md`** — appended a pointer line at the bottom directing authors superseding an existing ADR to the new convention in `conventions.md`. (Refinement 5 — author-facing entry point.)

### Changed
- *(none — all five refinements are additive.)*

---

## [Phase 1c.2 — cleanup] — 2026-04-26

Foundation pass — documentation and scaffolding only. No pipeline changes,
no schema changes, no athlete-facing UI changes.

### Added
- `README.md`, `docs/INDEX.md`, `docs/glossary.md`, `docs/roadmap.md` — repo navigation foundation (Pass 1).
- `docs/agents/{onboarding,conventions,workflows}.md` — operational agent guidance (Pass 2).
- `docs/{architecture,process,reference,investigations,adr,templates}/` subdirectory layout (Pass 3a).
- `docs/reference/calibration/{ground-truth.yaml,_schema.md}` — structured calibration ground-truth dataset (Pass 3b).
- `docs/reference/determinism-drift.csv` + `_schema-determinism-drift.md` — structured drift log (Pass 3c).
- `docs/adr/0001`–`0012` — 12 backfilled ADRs covering user-roles table, Lovable Cloud default, Lovable AI Gateway default, calibration deferral (ADR-0004), determinism tolerance (ADR-0005), phase ordering (ADR-0006), backup snapshot pattern (ADR-0007), validation triggers, MediaPipe-on-Cloud-Run, Zustand, icon/font policy, backup retention (ADR-0012). See `docs/adr/INDEX.md`.
- `docs/adr/0013-prose-to-structured-policy.md` — codifies the two-of-four rule for converting prose datasets to CSV/YAML (Pass 3d follow-up).
- `docs/adr/0014-c5-unified-edge-function-body-based-path.md` — records the Slice C.5 collapse of the two parallel `body_based` calibration paths into a single edge-function path with structured `calibration_audit` payload (Pass 3d follow-up; resolves F-SLICE-B-1 path-disagreement).
- `docs/adr/0015-mechanics-tab-delete-not-patch.md` — records the Slice E recovery decision to hide the Mechanics tab rather than patch `MechanicsEditor` since the component is slated for 1c.3 deletion (Pass 3d follow-up; generalizes to a delete-not-patch rule).
- `docs/adr/template.md`, `docs/templates/slice-outcome.md` (Pass 3f).
- `scripts/verification/` — relocated all `slice*_verify.ts` and related verification scripts from `scripts/` root (Pass 3e).
- `docs/risk-register/` — split of `docs/migration-risk-register.md` into one file per `R-*` / `F-*` ID (22 entries: 12 R + 10 F), with `_schema.md` frontmatter contract and `INDEX.md` aggregated view (Pass 4). Frontmatter fields: `id`, `title`, `status`, `severity`, `origin_slice`, `origin_doc`, `related_adrs`, `related_entries`, `opened`, `last_updated`. Meta-commentary (§2 heatmap, §3.5 invariants table, §4 closing summary, phase-ordering note) preserved in `INDEX.md`.
- `docs/risk-register/_schema.md` — appended Pass 4 split-script lesson (intervening `##` headers between `###` entries) and `related_adrs` derivation note (Pass 4 follow-up).
- `docs/reference/{tiers,metrics,events,observability}/_schema.md` — Pass 5a–5d foundation scaffolds. Each anchors a frontmatter contract for future entries; no per-entry files exist yet.
- `docs/reference/calibration-audit-rollup.md` — Pass 5e single-entry rollup of calibration accuracy + determinism state. Aggregates ground-truth dataset, determinism CSV, related findings (F-SLICE-B-1, F-SLICE-B1-2, F-SLICE-E-2), and ADRs (0004, 0005, 0014).
- Pass 5.5 sanity check: DB-verified the 9 canonical `athlete_lab_results` rows referenced by `determinism-drift.csv` (`SELECT count(*) ... → 9`). Gate satisfied.
- `scripts/aggregate-calibration-audit.ts` + `docs/reference/calibration-audit-rollup.csv` + `docs/reference/_schema-calibration-audit-rollup.md` — Pass 5e-bis. Deno/TS aggregator that reads every `docs/reference/calibration/*.yaml`, joins to `athlete_uploads.video_url` by `bucket_path` suffix, pulls `result_data.calibration_audit`, and emits a deterministic, idempotent CSV. Seed run: 1 clip, 9 rows (matches Pass 5.5 gate), 12 pre-C.5 rows skipped (no `calibration_audit` payload — expected per ADR-0014). Convention: re-run after each ground-truth clip addition (see `docs/agents/conventions.md` § "Calibration audit rollup"). Surfaced finding: the Pass 3c `determinism-drift.csv` short-hash column conflates two distinct full-SHA-256 payloads (`26603f63…` and `884b740b…`); rollup uses full hashes. No edits to Pass 3c CSV — flagged for follow-up.

### Changed
- Renamed `AGENTS.md` → `PRODUCT-SPEC.md` to eliminate naming collision with `docs/agents/` (Pass 1). R2 stub remains at `AGENTS.md`.
- Renamed `docs/run-analysis-observability-audit-v2.md` → `docs/reference/run-analysis-observability-audit.md` (Pass 1 + Pass 3a). R2 stub remains at root.
- Moved `docs/repo-architecture-audit.md`, `docs/athlete-lab-architecture-audit.md`, `docs/calibration-ground-truth-dataset.md`, `docs/phase-1c2-determinism-drift-log.md` into their canonical subdirectories (Pass 3a). R2 stubs remain at the four old root paths and are tracked in `docs/process/phase-1c3-prep-backlog.md` "Stub cleanup queue."
- `docs/migration-risk-register.md` → R2 redirect stub (Pass 4). Content split into `docs/risk-register/`. Stub registered in 1c.3 cleanup queue (now 7 stubs total: 2 from Pass 1 + 4 from Pass 3a + 1 from Pass 4).
- `README.md`, `docs/INDEX.md`, `docs/agents/conventions.md`, `docs/agents/workflows.md` updated to reference the new `docs/risk-register/` location instead of the old combined doc (Pass 4 cross-reference sweep).
- Status banners added to 10 historical investigation/snapshot docs (Pass 1).
- `docs/agents/conventions.md` — added "Catalog doc exemption" subsection codifying that `INDEX.md` and `repo-architecture-audit.md` are exempt from the >30 cross-reference threshold (Pass 3a).

### Fixed
- All in-repo `.md` cross-references to moved docs (88 occurrences across 14 files; verified by markdown link resolver, 0 broken intra-pass links).
- Stale ADR cross-references corrected after the Pass 3d follow-up audit: `docs/roadmap.md` and `docs/agents/onboarding.md` previously cited "ADR-0010" for the "no new athlete UI in Phase 1c" rule (ADR-0010 is actually `zustand-for-shared-state`); both now correctly cite ADR-0006 (phase ordering) as the basis. `docs/investigations/calibration-ppy-investigation.md` previously cited "ADR-0011" for the C.5 unification decision; now correctly cites ADR-0014.
- **Pass 5e-bis follow-up corrections.** `docs/reference/determinism-drift.csv` `hash` column upgraded from short alias to full SHA-256 on all rows; the two rows previously sharing alias `26603f63` now correctly carry distinct full hashes (`26603f63a77266…` for `a164c815`, `884b740b6f5fe4…` for `23936560`). The `23936560` row's `group` re-labeled `B → C`; both affected rows' `notes` clarified that `body_based_ppy` is bit-identical but `body_based_confidence` differs (0.7817768960473507 vs 0.7818235851106613) so the full payload is **not** bit-identical. Hash set in the corrected drift CSV now matches the rollup CSV's hash set exactly (verified by re-running `scripts/aggregate-calibration-audit.ts`; rollup md5 unchanged: `8f389f51…`).
- **`docs/risk-register/F-SLICE-E-2`** — body revised from "bimodal" to **multimodal** framing. Now records 4 hash groups (3 calibration-bearing + 1 historical static-fallback), explicitly notes that `body_based_ppy` bit-identity does NOT imply `calibration_audit` payload bit-identity, points Phase 2 investigators to use full-SHA-256 analysis via `scripts/aggregate-calibration-audit.ts` rather than `body_based_ppy` comparison, and updates the bimodal-prediction / falsification criteria accordingly. Status stays `open`, severity stays `Sev-2`. Cross-reference paths corrected to current post-Pass-3a locations (`docs/process/...`, `docs/reference/...`).
- **`docs/process/phase-1c2-determinism-experiment.md`** — added a "Pass 5e-bis clarification" banner near the top noting that the original "Group A vs Group B" framing predates the full-hash analysis. Findings on `body_based_ppy` remain valid; the implicit "Group B is bit-identical end-to-end" framing is insufficient. Points to F-SLICE-E-2 for the revised guidance. No body content edited.

### Pass 6 — mechanical automation

- **6.1 — Tab inventory generator.** `scripts/generate-tab-inventory.ts` parses the `TABS` array (and ADVANCED_TAB_KEYS) from `src/features/athlete-lab/components/NodeEditor.tsx` and regenerates the block between `<!-- INVENTORY:AUTO:START -->` / `<!-- INVENTORY:AUTO:END -->` markers in `docs/architecture/athlete-lab-tab-inventory.md`. Boundary policy: only tab order, label, key, advanced flag, and hidden flag are derived; per-tab descriptions, fields, and disposition predictions stay human-curated above the AUTO block. Supports `--check` mode (exit 4 on drift) for pre-PR gating. First run produced 14-tab/1-hidden snapshot matching the existing human table. Idempotent across consecutive runs.
- **6.2 — Phase ID registry.** `docs/reference/phases.md` codifies the `PHASE-1C0`…`PHASE-3` ID set + slice IDs (`PHASE-1C2-SLICE-A` … `PHASE-1C2-SLICE-E`). Roadmap remains the status source of truth; phases.md mirrors. Lists usage rules (scripts, risk register, ADRs) and anti-patterns (ad-hoc IDs, slice-without-phase, generic "Phase 2" references).
- **6.3 — Verification recipe template + retrofit.** `scripts/verification/_template.ts` defines the canonical `NAME / PHASE / VERIFIES / RECIPE / BACKLINKS / MAINTENANCE` header block. Retrofitted all 6 existing verification scripts (`slice1c2_b1_smoke_compare`, `slice1c2_d5_post_strip_verify`, `slice1c2_determinism_cloudrun`, `slice1c2_r04_backup_assert`, `slice1c_full_pipeline_verification`, `slice3_verify`) with structured headers — coverage check confirms 7/7 files carry all three required tags. Functionality unchanged: TS parse-check shows only pre-existing Deno-globals errors on the 4 Deno scripts, none introduced by the retrofit. The convention embeds the F-SLICE-E-3 lesson ("recipes that live in code with backlinks stay current") in the template body so it propagates to every future verification script.
- `docs/agents/conventions.md` — populated all three Pass 6 sub-convention sections (previously stubs).

### Deferred (not changed in this pass)
- B2 calibration architecture decision — see ADR-0004.
- Per-entry tier/metric/event/observability files — scaffolding only in Pass 5; first entries will land in Phase 1c.3 or post-1c as concrete content emerges.
- R2 stub removal (7 stubs total: `AGENTS.md`, `docs/repo-architecture-audit.md`, `docs/athlete-lab-architecture-audit.md`, `docs/calibration-ground-truth-dataset.md`, `docs/phase-1c2-determinism-drift-log.md`, `docs/run-analysis-observability-audit-v2.md`, `docs/migration-risk-register.md`) — scheduled for Phase 1c.3 per `docs/process/phase-1c3-prep-backlog.md` "Stub cleanup queue."
