---
slice_id: PHASE-1C3-PREP
title: Documentation gap closure for Phase 2 readiness
date_shipped: 2026-04-30
status: shipped
related_risks: []
related_findings: [F-OPS-3, F-OPS-4]
related_adrs: [ADR-0006, ADR-0013]
---

# PHASE-1C3-PREP — Documentation gap closure for Phase 2 readiness

## Goal

Close the documentation gaps identified by a fresh-Claude comprehension audit (`docs/project-comprehension-audit-fresh-claude-2026-04-30.md`) before Phase 2a kickoff. Pure documentation slice — no code, migrations, or schema work. Success criterion: re-running the same audit prompt against post-prep state should report each named gap as closed.

## What shipped

### Group 1 — Roadmap & stale-doc cleanup

- **`docs/roadmap.md`** — Replaced "Phase 1c.3 — next" stub with a "Phase 1c.3 — Complete (2026-04-30)" section listing all six slices A–F with one-line outcomes and links. Marked Phase 2a as **next**.
- **`docs/risk-register/INDEX.md`** — Updated phase-ordering note (lines 126–129): 1c.3 marked Complete; Phase 2a marked next.
- **`docs/agents/workflows.md`** — Strengthened "Drafting a slice outcome" step 4 from soft "Add the slice to the phase's roadmap entry" to hard "A slice is **not 'shipped' until the roadmap reflects it**." Added F-OPS-3 cross-link and detector-script reference. Also fixed pre-existing `do../templates/` typo and corrected frontmatter field list (`date_shipped` not `date`; `related_findings` was missing).
- **`scripts/verification/check-roadmap-sync.ts`** — New detector script with full Pass 6.3 header (NAME / PHASE / VERIFIES / RECIPE / BACKLINKS / MAINTENANCE). Globs both `phase-*-outcome.md` and `phase-*-retrospective.md` (slice 1c.3-F lives in retrospective). Uses frontmatter `slice_id` as primary key with bidirectional normalization between long form (`PHASE-1C3-SLICE-A`) and short form (`1c.3-A`).
- **`docs/architecture/repo-architecture-audit.md`** — Status banner inserted ("Recommendations executed during Phase 1c.2 cleanup … ~85% executed; remaining items deferred per ADRs").
- **`docs/agents/onboarding.md`** — Removed stale `AGENTS.md` stub references (file was already deleted in 1c.3-A); updated "tail end of Phase 1c.2" framing to "Phase 1c.3 closed; Phase 2a next."
- **`docs/glossary.md`** — Updated AGENTS.md table row: "Removed in Phase 1c.3-A" rather than "to be removed at start of Phase 1c.3."

### Group 2 — System-level architecture documentation

- **`docs/architecture/system-overview.md`** — New file. Three product surfaces (Brand HQ / Athlete Lab / Athlete Profile with deferral), pipeline diagram (upload → edge fn → Cloud Run → calibration → AI Gateway → result), infrastructure layers (Lovable / Lovable Cloud / Google Cloud Run / Lovable AI Gateway), three key tables (`athlete_lab_nodes`, `athlete_uploads`, `athlete_lab_results`), trust boundaries (admin authoring vs athlete consumption), phase ordering. Cross-links ADR-0001/2/3/6/9/10/14.
- **`docs/architecture/pipeline-trace.md`** — New file. 10 numbered steps (0 Upload → 10 Mark complete) walking one upload INSERT → result row, with file:line citations into `analyze-athlete-video/index.ts` (entry at L607, callCloudRun at L3445/3484, resolveCalibration at L1471, callClaude at L3350, writeResults at L3595/3607, completion at L870/3649) and `mediapipe-service/app/main.py` (`/analyze` at L219, NDJSON stream at L252). Maintenance contract noted (line numbers as-of 2026-04-30).
- **`docs/agents/onboarding.md`** — Read-order updated: system-overview.md (step 5) and pipeline-trace.md (step 6) inserted after roadmap.md; conventions/workflows shifted to steps 7/8. ~45 min → ~60 min context cost.

### Group 3 — Convention & philosophy documentation

- **`docs/risk-register/F-OPS-4-…md`** — Added one-paragraph "What this finding is about" lede before "## Observation". Existing seven-sub-pattern evolution log preserved unchanged.
- **`docs/agents/testing-philosophy.md`** — New file. Frames per-slice manual verification as test surface (not absence of tests). Six load-bearing components: verification scripts (Pass 6.3 headers), calibration audit rollup CSV, determinism drift CSV, F-OPS-4 halt-and-decide discipline, ADR-0007 backup pattern, tsc as cheap regression check. When-this-works / when-this-needs-to-change framing. CI/CD and hosted observability deferrals documented with revisitable triggers.
- **Tier source-of-truth resolution:**
  - **`VISION.md`** — New "## Tier System (Canonical)" section appended; declares `src/features/onboarding/steps/AthleteTier.tsx` as source of truth; tier table (youth/high-school/college[active]/pro).
  - **`docs/reference/tiers/_schema.md`** — Removed "Phase 1c.2 has no canonical tier set yet" caveat; added canonical tier IDs sentence pointing to `AthleteTier.tsx`; reframed schema as documenting structured-content contract for tier-specific reference material rather than owning tier IDs.

### Group 4 — Verification & closure

- This outcome doc (`docs/process/phase-1c3-prep-slice-outcome.md`).
- `CHANGELOG.md` `[PHASE-1C3-PREP]` entry.

## Verification

| Check | Method | Outcome |
|---|---|---|
| Detector finds all 6 shipped 1c.3 slices in roadmap | `bun run scripts/verification/check-roadmap-sync.ts` | ✅ `OK: 6 shipped slices, all referenced in roadmap.` |
| No remaining "Phase 1c.3 — Not started / next" prose in docs/ | `rg "Phase 1c\.3 — Not started\|Phase 1c\.3 — next\|1c\.3.*\(next\)" docs/` | ✅ zero hits |
| AGENTS.md stub references purged from agent-facing docs | `rg "AGENTS\.md.*stub\|redirects to PRODUCT-SPEC" docs/` | ✅ remaining hits are historical (onboarding parenthetical, glossary "Removed in Phase 1c.3-A" entry) — both correctly state the file is gone |
| Build clean | `npx tsc --noEmit -p tsconfig.app.json` | ✅ green (no output) |

## Halts encountered

### Halt 1 — slice outcome doc frontmatter shape (resolved by scope decision)

**Surfaced:** First run of `check-roadmap-sync.ts` exited 2 with `SHAPE_ERROR: docs/process/phase-1c1-slice2-outcome.md — no parseable frontmatter`.

**Root cause:** ~~Five~~ **Seven** pre-1c.3 outcome docs (`phase-1c1-slice2-outcome.md`, `phase-1c1-slice3-outcome.md`, `phase-1c2-determinism-experiment.md`, `phase-1c2-slice-a-r04-assertion.md`, `phase-1c2-slice-b1-outcome.md`, `phase-1c2-slice-d-outcome.md`, `phase-1c2-slice-e-outcome.md`) predate the `slice-outcome.md` template (Pass 3f, 2026-04-26). They use prose headers ("**Date shipped:** …") rather than YAML frontmatter. This is F-OPS-4 sub-pattern 7 (taxonomy drift) appearing at the doc-format level rather than the slice-tag level.

> **Drift correction (PHASE-1C3-POLISH, 2026-04-30):** This entry originally said "Five … docs" and listed five files. The actual count was seven (the determinism-experiment and slice-a-r04-assertion docs were missed in the original enumeration). PHASE-1C3-POLISH bannered all seven and corrected this passage. See `phase-1c3-polish-slice-outcome.md` for the audit trail; this is itself an instance of the F-OPS-3 / F-OPS-4 / F-SLICE-E-3 triad (a documentation count was asserted without re-verification, and drifted between prep-time and polish-time).

**Decision (within slice scope):** Made the detector tolerant of pre-template docs — emit a NOTE listing them, then continue enforcing the contract for docs that DO have frontmatter. Did **not** retroactively normalize the legacy docs (would expand slice scope and rewrite historical artifacts whose value is in being a record-as-shipped). The contract is enforced for current and future slices; legacy docs remain as historical record. Logged as a known follow-up rather than a defect.

### Halt 2 — slice_id format mix (resolved by detector design)

**Surfaced (during pre-execution sweep):** Six 1c.3 slice docs use two formats — long (`PHASE-1C3-SLICE-A/E/F`) and short (`1c.3-B/C/D`). This is exactly F-OPS-4 sub-pattern 7 reproducing inside the very docs that introduced sub-pattern 7.

**Decision:** Detector accepts both forms via `normalizeSliceId()` — searches roadmap for either verbatim slice_id OR its complementary form. Avoids forcing a normalization pass on existing docs. Logged in this outcome doc; future slices should pick one form (short form `<phase>-<slice>` is the durable choice per slice 1c.3-E lesson).

## Decisions deferred

- **Slice-outcome frontmatter normalization for legacy 1c.1/1c.2 docs** — out of scope for this prep slice. Logged here as a Phase 2 prep candidate. Cost is low (5 docs, mechanical edit) but value is also low (docs are historical).
- **Slice-id format consolidation** — not normalized in existing 1c.3 docs. Future slices SHOULD use short form `<phase>-<slice>` per 1c.3-E lesson.
- **Removing `noEmit` / enabling TS strict** — flagged as Phase 2 priority in the retrospective; not in this slice.
- **Pre-template doc rewrite** — see Halt 1.

## Cross-links

- Audit doc that drove this work: `docs/project-comprehension-audit-fresh-claude-2026-04-30.md`
- Phase 1c.3 retrospective: [`phase-1c3-retrospective.md`](phase-1c3-retrospective.md)
- F-OPS-3 (plan-vs-state drift; the detector enforces against this): [`../risk-register/F-OPS-3-deferred-work-shipped-earlier-creates-plan-vs-state-drift.md`](../risk-register/F-OPS-3-deferred-work-shipped-earlier-creates-plan-vs-state-drift.md)
- F-OPS-4 (sub-pattern 7 surfaced twice during this slice): [`../risk-register/F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md`](../risk-register/F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md)
- Detector script: `scripts/verification/check-roadmap-sync.ts`

## Recommended re-audit

Re-run the same fresh-Claude comprehension audit prompt against the post-prep state. Each named gap (roadmap drift, AGENTS.md stub, system-architecture absence, end-to-end pipeline trace cost, F-OPS-4 lede, testing-philosophy absence, tier ambiguity) should now report closed. If new gaps surface, log into the Phase 2 prep backlog rather than expanding this slice retroactively.
