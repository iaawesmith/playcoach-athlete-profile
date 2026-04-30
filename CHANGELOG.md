# Changelog

All notable changes to PlayCoach are recorded here. Format inspired by
[Keep a Changelog](https://keepachangelog.com/); versioning aligns with
phase identifiers (`PHASE-NN[a/b/c]`) rather than semver until public launch.

Entry shape:

```
## [PHASE-1C3-PREP] — 2026-04-30

### Added
- `docs/architecture/system-overview.md` — system-level architecture: three product surfaces, pipeline shape, infrastructure layers, key tables, trust boundaries.
- `docs/architecture/pipeline-trace.md` — 10-step upload→result trace with file:line citations into `analyze-athlete-video/index.ts` and `mediapipe-service/app/main.py`.
- `docs/agents/testing-philosophy.md` — frames per-slice manual verification as the test surface; documents CI/CD and observability deferrals with revisitable triggers.
- `scripts/verification/check-roadmap-sync.ts` — detector enforcing F-OPS-3 contract: shipped slice outcome docs must be referenced in `docs/roadmap.md`. Tolerant of pre-template legacy docs.
- `docs/process/phase-1c3-prep-slice-outcome.md` — this slice's outcome doc.
- F-OPS-4: one-paragraph "What this finding is about" lede before the seven-sub-pattern evolution log.
- VISION.md: "Tier System (Canonical)" section pointing to `src/features/onboarding/steps/AthleteTier.tsx` as source of truth.

### Changed
- `docs/roadmap.md` — Phase 1c.3 marked **Complete (2026-04-30)** with all six slices A–F listed; Phase 2a marked **next**.
- `docs/risk-register/INDEX.md` — phase-ordering note updated: 1c.3 Complete, 2a next.
- `docs/agents/workflows.md` — "Drafting a slice outcome" step 4 strengthened: a slice is not "shipped" until the roadmap reflects it. Frontmatter field list corrected.
- `docs/agents/onboarding.md` — read-order extended to include system-overview.md + pipeline-trace.md (~45 → ~60 min). Stale 1c.2 framing replaced with 1c.3-closed framing. AGENTS.md stub references purged.
- `docs/architecture/repo-architecture-audit.md` — status banner added (recommendations executed during 1c.2 cleanup, ~85% complete).
- `docs/reference/tiers/_schema.md` — caveat removed; canonical tier IDs declared with pointer to `AthleteTier.tsx`.
- `docs/glossary.md` — AGENTS.md row updated to reflect file removal in 1c.3-A.

### Fixed
- `docs/agents/workflows.md` — pre-existing `do../templates/slice-outcome.md` typo and missing `related_findings` field in slice-outcome frontmatter spec.

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

## [PHASE-1C3-CLOSE] — 2026-04-30

Phase 1c.3 formally closes with the slice 1c.3-F retrospective. All 6 slices (A–F) shipped; R-12 closed; R-05 and R-07 mitigated; 5 findings opened during 1c.3 (F-OPS-3, F-OPS-4, F-SLICE-E-6 + carry-overs); 3 findings resolved (F-SLICE-E-4/E-5/E-6). Phase 1c.3 deliverables synthesized into a single retrospective; methodological discipline (F-OPS-3, F-OPS-4 with seven sub-patterns) ready as Phase 2 input.

### Added
- **`docs/process/phase-1c3-retrospective.md`** — full Phase 1c.3 retrospective: slice-by-slice summary (A–F), F-OPS-3/F-OPS-4 methodological evolution, what worked / what didn't, deferrals to Phase 2, Phase 2 readiness inputs, process recommendations.
- **Migration `slice1c3_f_v08_overview_to_basics_merge`** — V-1c.3-08 disposition. Extends `alb_phase1c_slice_chk` to allow `1c.3-F`; backs up 2 `kb.overview` sections (slice='1c.3-F', disposition='relocated'); merges into `kb.basics` with provenance prefix and `(migrated)` title suffix; drops `kb.overview` key. Atomic transaction, post-condition assertions all passed (basics 13 → 15, 2 backup rows, overview key absent).

### Changed
- **`docs/risk-register/INDEX.md`** — counts narrative reconciled: 25 entries (12 risks + 13 findings), 10 verification tasks. Earlier "26 / 14 / 9" wording was drift; status distribution sentence added.
- **`docs/process/phase-1c3-prep-backlog.md`** — V-1c.3-08 marked resolved with the merge decision and migration reference.
- **`docs/roadmap.md`** — Phase 1c.3 status: Not started → **Complete**. Cross-link to retrospective.
- **`docs/risk-register/F-OPS-4`** — sixth annotation: sub-pattern 1 replay observation from this slice (CHECK constraint extended in 1c.3-E did not include `1c.3-F`; cadence confirmed). Phase 2 prep recommendation: convert slice CHECK to pattern or validation trigger.

### Verified
- V-1c.3-08 merge migration: post-condition assertions passed (basics length 13 → 15, 2 backup rows for slice='1c.3-F', `kb.overview` key absent).
- Cross-reference integrity audit: 15 ADRs verified, 25 risk-register entries verified per-file vs INDEX. Clean.
- INDEX count drift reconciled (was: 26 / 14 / 9; actual: 25 / 13 / 10).
- Final sweep: `rg "TODO.*1c\.3"` → zero hits in code or docs. `rg "1c\.3"` references are all retrospective / historical / cross-link as expected.

### Closed
- **Phase 1c.3** formally complete. Phase 2 (analysis quality) ready to enter prep.

---

## [PHASE-1C3-SLICE-E] — 2026-04-30

R-07 backup disposition audit + slice-tag taxonomy normalization. All 9 in-scope rows (slices B/C/D) verified clean on disposition/intent/source_column; 9 rows renamed from ambiguous single-letter form to durable `<phase>-<slice>` form. R-07 mitigated. F-OPS-4 sub-pattern 7 (taxonomy drift across slices over time) annotated.

### Added
- **Migration `slice1c3_e_normalize_backup_slice_tags`** — expanded `alb_phase1c_slice_chk` CHECK constraint to allow durable phase-slice form alongside legacy single letters; renamed 9 rows in a single transaction with three independent UPDATE statements + post-condition row-count assertions (3 / 4 / 2).
- **`docs/process/phase-1c3-slice-e-outcome.md`** — slice outcome doc with full per-row audit table.
- **V-1c.3-10** in `phase-1c3-prep-backlog.md` — normalize 10 PHASE-1C2-SLICE-E backup rows (deferred from this slice scope).

### Changed
- **`docs/risk-register/R-07`** — open → **mitigated**. Mitigation note added documenting the periodic-audit + durable-tag convention. Stays mitigated (not closed) per long-horizon preventive nature.
- **`docs/risk-register/F-OPS-4`** — fifth annotation; catalogue now lists **seven distinct sub-patterns**, including the genuinely new **sub-pattern 7 (taxonomy drift across slices over time)** with structural remediation distinct from sub-patterns 1–6.
- **`docs/risk-register/INDEX.md`** — R-07 row updated to mitigated; cross-link to F-OPS-4 added.

### Fixed
- **`src/features/athlete-lab/components/NodeEditor.tsx`** — three missing `</div>` closes in the basics tab (Pipeline Config inline subtree shipped in 1c.3-D had unbalanced JSX). Caught during this slice's `tsc --noEmit -p tsconfig.app.json` verification — the default project tsc did not surface it. Verification-discipline note: future slice closes should run app-level tsc, not just the default.

### Verified
- `npx tsc --noEmit -p tsconfig.app.json` exit 0, no output.
- Post-migration `GROUP BY slice` distribution: `1c.2-D: 4, 1c.3-B: 3, 1c.3-D: 2, E: 10`.

---

## [PHASE-1C3-SLICE-D] — 2026-04-29

Tab consolidation 13 → 8 + R-05 mitigation + 5-key knowledge_base merge. Final tab set: Basics, Videos, Phases, Metrics, Reference, LLM Prompt, Badges, Run Analysis. Two F-OPS-4 halts during DB work (constraint discovery + new transactional-correctness sub-pattern on multi-source merge).

### Added
- **`src/features/athlete-lab/components/ConsolidationRedirectBanner.tsx`** — one-time per-browser banner with explicit redirect list for the 5 retired tabs (Filming Guidance / Scoring / Errors / Checkpoints / Training Status); localStorage key `athleteLab.consolidationBannerDismissed.v1`. R-05 mitigation.
- **`HASH_REDIRECT_MAP`** in `NodeEditor.tsx` (10 entries) + `useEffect` hooks coercing stale persisted `tab`, URL hash anchors (with strip-after-redirect), and stale `helpTabKey`.
- **`KB_REDIRECT_MAP` + `resolveTabKey`** in `HelpDrawer.tsx` — coerces stale tab keys before `knowledgeBase[tabKey]` lookup so consolidated content is never silently empty.
- **5-key knowledge_base merge migrations** — `scoring`/`errors` → `metrics`, `camera` → `reference`, `checkpoints` → `phases`, `training_status` → `basics`, all with HTML provenance headers.
- **`docs/process/phase-1c3-slice-d-outcome.md`** — slice outcome doc.
- **V-1c.3-07/08/09** in `phase-1c3-prep-backlog.md` — score_bands consumer wiring (Phase 2/3), kb.overview/kb.test disposition (1c.3-F), Reference Video Quality Guide overlap (1c.3-E).

### Changed
- **`NodeEditor.tsx`** — `TABS` 13 → 8; `CRITICAL_TABS` updated to `["metrics", "phases", "prompt", "basics"]`; `ADVANCED_TAB_KEYS` / `showAdvancedTabs` toggle / advanced-tabs localStorage retired entirely. Sub-editors inlined: Metrics hosts Scoring + Common Errors; Reference hosts Filming Guidance (CameraEditor); Phases gates Checkpoints on `segmentation_method === "checkpoint"`; Basics hosts inline Pipeline Config (det_frequency triplet).
- **`NodeReadinessBar.tsx`** — `TabKey` shrunk to 8; Training Status category routes to `basics`, Camera category routes to `reference`.
- **`utils/nodeExport.ts`** — `TabKey` shrunk to 7 markdown-emitting tabs + `LegacyTabKey` for stale callers; `TAB_GENERATORS` combines merged sub-section markdown on consolidated tabs (copying Metrics → metrics+scoring+errors); `generateTabMarkdown` redirects legacy keys; `generateFullNodeMarkdown` `tabOrder` shrunk 12 → 7 (latent runtime bug fixed — old array referenced retired keys, would have crashed via undefined generator under `strict: false`).
- **`docs/risk-register/R-05`** — open → **mitigated**. Banner + hash-anchor + HelpDrawer redirects all shipped.
- **`docs/risk-register/R-12`** — remained closed; cross-link added noting 1c.3-D completes the broader knowledge_base consolidation pattern R-12 originally named.
- **`docs/risk-register/F-OPS-4`** — fourth annotation; catalogue now lists **six distinct sub-patterns**, including the genuinely new **transactional correctness on multi-source merges** (algorithmic remediation: accumulator pattern + post-condition invariant assertions).
- **`docs/risk-register/INDEX.md`** — R-05 row updated to mitigated; counts note added for V-entries (V-1c.3-01 through V-1c.3-09).
- **`docs/architecture/athlete-lab-tab-inventory.md`** — regenerated via `scripts/generate-tab-inventory.ts`; AUTO block now shows 8 tabs (down from 13).

### Verified
- `npx tsc --noEmit` exit 0, no output.
- Knowledge base merge correctness: `basics`(13), `phases`(19), `metrics`(30), `reference`(16). Source keys (`scoring`, `errors`, `camera`, `checkpoints`, `training_status`) absent.
- Tab inventory script: "wrote …(8 tabs, 0 hidden)".
- Reference sweep for retired tab keys: remaining hits are unrelated enum values, comments, or column names — not tab keys. `nodeExport.ts:436` `tabOrder` runtime bug discovered + fixed in the same sweep.
- F-SLICE-E-1 stays open (criterion check confirmed: no new det_frequency content surfaced).
- F-SLICE-E-5 stays resolved.

### Process
- Two F-OPS-4 halts during DB work: (1) constraint discovery on backup table for merge-time backup row (sub-pattern 1, replay), (2) **transactional correctness on multi-source merges** (NEW sub-pattern 6) — first iteration's in-loop UPDATE-then-reread pattern produced stale-read defect on `metrics` (expected 30 sections, got 25; 8 scoring sections silently overwritten by errors merge). Recovered via rollback to slice backup + re-execution with `v_kb` PL/pgSQL accumulator + post-merge length assertion. Sub-pattern 6 sits **alongside** F-OPS-4's methodological remediation rather than within it (algorithmic, not methodological).
- Integration-decision halts (B1, B2, F, G, H, C, I) surfaced **during** execution at integration boundaries — distinct from pre-execution decision-cluster (1c.3-C). Vocabulary refinement: cleanup-shaped slices that consolidate UI surfaces will surface integration-decision halts; cleanup-shaped slices that remove broken surfaces will surface scope-decision halts. Both belong in the F-OPS-4 family.

---

## [PHASE-1C3-SLICE-C] — 2026-04-29

Training Status tab write-path resolution. F-SLICE-E-5 expanded under F-OPS-4 pre-execution sweep into a four-column defect class (Solution Class, Performance Mode, legacy `det_frequency`, Tracking — all routing through the shared `updateWithCriticalTrack` helper against columns dropped in migration `20260426025918`). Captured as F-SLICE-E-6 and resolved same slice.

### Removed
- **4 write-path handlers** in `src/features/athlete-lab/components/NodeEditor.tsx` (`TrainingStatusEditor` call site): `solution_class`, `performance_mode`, `det_frequency` (legacy single-field), `tracking_enabled`. Save-payload allow-list shape confirmed at `~L600` (not spread-based) — no Sev-2 escalation.
- **Solution Class radio + Performance Mode toggle + legacy Detection Frequency input + Tracking toggle** UI controls deleted from `TrainingStatusEditor`. Per-context detection-frequency controls (`solo` / `defender` / `multiple`) retained — they write to active columns.
- **Dead helpers**: `getSolutionClassWarnings`, `SOLUTION_CLASSES`, `SOLUTION_CLASS_MAP`, legacy `pipelineCode` template.
- **`solution_class` readiness gates** in both `NodeReadinessBar.tsx` (Reference Calibration `wholebody3d` short-circuit dropped; Training Status category replaced with placeholder) AND `NodeEditor.tsx` `checkCompleteness()` L167.
- **`generateTrainingStatus()`** in `src/features/athlete-lab/utils/nodeExport.ts` deleted in full; `training_status` removed from `TabKey` union, `TAB_GENERATORS`, `TAB_LABELS`, `tabOrder`; `# Solution Class:` header line removed from `generateFullNodeMarkdown`; `reference_filming_instructions` reference dropped from `generateReference`; orphan `getActiveMetrics` import removed.
- **6 fields** removed from `TrainingNode` interface in `types.ts`: `solution_class`, `performance_mode`, `tracking_enabled`, `det_frequency`, `reference_object`, `reference_filming_instructions`. `pro_mechanics` intentionally retained per V-1c.3-06.
- **`TrainingStatusEditor` refactored** ~270 LOC → ~125 LOC.

### Changed
- **`docs/risk-register/F-SLICE-E-5`** — status open → resolved; F-SLICE-E-6 added to related_entries; resolution pointer added.
- **`docs/risk-register/F-OPS-4`** — annotated with the **pre-execution decision-cluster** sub-pattern; evolution log added (now three explicit annotations across three slices).
- **`docs/risk-register/INDEX.md`** — counts 24 → 26 entries, 12 → 14 findings; F-SLICE-E-5 row updated; F-SLICE-E-6 row added.

### Added
- **`docs/risk-register/F-SLICE-E-6-training-status-write-paths-class-defect.md`** — captures the four-column defect class, save-payload allow-list verification, Q1–Q4 decisions and reasoning. Status: opened and closed same slice (1c.3-B precedent).
- **`docs/process/phase-1c3-slice-c-outcome.md`** — slice outcome doc.

### Verified
- `npx tsc --noEmit` exit 0, no output.
- Project-wide write-path sweep across all 8 dropped columns returns zero live write paths.

### Process
- Two pre-execution halts surfaced before any code edits: (1) write-path sweep expanded scope from 1 column to 4 (F-SLICE-E-6 opened); (2) decision cluster surfaced 4 sub-decisions (Q1–Q4) the plan didn't specify. Both halts resolved before execution. Pre-execution decision-cluster captured as a new halt category in F-OPS-4.

---

## [PHASE-1C3-SLICE-B] — 2026-04-29

Mechanics tab + `MechanicsEditor` deletion + Mechanics-only `knowledge_base` merge per R-12 mitigation and ADR-0015.

### Removed
- **Mechanics tab + inline `MechanicsEditor` function** in `src/features/athlete-lab/components/NodeEditor.tsx` (~200 LOC), plus `pro_mechanics` validation block, dead JSX block, and `MechanicsSection` type import. `"mechanics"` removed from both `TabKey` unions (`NodeEditor.tsx` and `NodeReadinessBar.tsx`).
- **`knowledge_base.mechanics` key** removed from all nodes via migration `20260429064724_phase1c3b_kb_mechanics_merge`. Single affected node (Slant); 3 sections merged into `knowledge_base.phases` with `(migrated)` title suffix and provenance HTML prefix. R-12 closed.

### Added
- **3 backup rows** in `athlete_lab_nodes_phase1c_backup` (disposition `relocated`, slice `B`, original_intent disambiguates Phase 1c.3-B).
- **`docs/process/phase-1c3-slice-b-outcome.md`** — slice outcome doc.
- **`docs/risk-register/F-OPS-3-...md`** — process finding: deferred work shipped earlier creates plan-vs-state drift.
- **`docs/risk-register/F-OPS-4-...md`** — process finding: pre-execution inspection scope systematically underestimates reality (3 examples in this slice).
- **V-1c.3-06** in `phase-1c3-prep-backlog.md` — captures discovered work to retire CoachingCues migration subsystem (blocked on migration-completion verification).

### Changed
- **`docs/architecture/athlete-lab-tab-inventory.md`** — AUTO block regenerated by `scripts/generate-tab-inventory.ts`; now reflects 13 visible tabs, 0 hidden.
- **`docs/adr/0015-mechanics-tab-delete-not-patch.md`** — annotated with delivery sequence and added F-OPS-3, F-OPS-4 to related_findings; R-12 added to related_risks.

### Process
- 3 execution-time halts (V-1c.3-03 constraint discovery, V-1c.3-04 shape discovery, V-1c.3-05 location discovery) each prevented a worse outcome — captured as F-OPS-4 examples 1, 2, 3.

---

Phase 1c.3 entry slice: stub sweep and orphan-column verification. Lowest-risk slice executed first to surface any V-1c.3-01 finding that would inform downstream slice scope. No findings surfaced; both halves clean.

### Removed
- **7 R2 redirect stubs retired.** All removal-trigger `rg` queries returned zero live in-repo references. Stubs removed: `AGENTS.md`, `docs/run-analysis-observability-audit-v2.md`, `docs/repo-architecture-audit.md`, `docs/athlete-lab-architecture-audit.md`, `docs/calibration-ground-truth-dataset.md`, `docs/phase-1c2-determinism-drift-log.md`, `docs/migration-risk-register.md`. R2 stub policy (`docs/agents/conventions.md`) worked as designed — one phase boundary of grace, then clean removal.

### Verified
- **V-1c.3-01 — `reference_object` and `llm_tone` confirmed truly orphaned.** Project-wide `rg` for both column names with documented exclusions returned zero hits. Migration `20260426025918` dropped them with no functional impact across `src/`, `supabase/functions/`, `scripts/`, or `mediapipe-service/`. Process learning captured for the Phase 1c retrospective: future data-shape-changing slices must scope consumer audits project-wide, not feature-wide (same root-cause class as F-SLICE-E-4 / F-SLICE-E-5).

### Changed
- **`docs/process/phase-1c3-prep-backlog.md`** — V-1c.3-01 marked resolved; stub queue marked retired with execution date. Tables preserved for historical reference.

### Added
- **`docs/process/phase-1c3-slice-a-outcome.md`** — slice outcome doc per `docs/templates/slice-outcome.md`.

---

## [Phase 1c.2 — pre-Project-setup integrity fixes] — 2026-04-29

Two small fixes surfaced by the consolidated integrity sweep, applied before Phase 1c.3 entry. No content rewrites, no R2 stubs.

### Fixed
- **`scripts/generate-tab-inventory.ts`** — removed the `Generated by ... on YYYY-MM-DD` date stamp from the AUTO block. The date was sourced from `new Date()`, which made `--check` mode fail any day after the last regen — breaking its CI-gating contract. Block content is now fully derived from `NodeEditor.tsx` source state; `--check` is deterministic across days. (Finding A from final integrity sweep.)
- **`docs/agents/conventions.md`** — wrapped the illustrative `ADR-0016` reference in the ADR supersession worked example in backticks so automated ID-resolution scans skip it. The `ADR-0004` references in the same paragraph are real and remain unwrapped. (Finding B from final integrity sweep.)

### Verified
- Integrity sweep (8 checks): all PASS.
- `deno run scripts/generate-tab-inventory.ts --check`: exit 0, deterministic across reruns.
- `docs/reference/calibration-audit-rollup.csv` MD5 unchanged (`8f389f5146b11df3672fdf21b6298cf6`).

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
