---
slice_id: PHASE-1C3-POLISH
title: Post-prep audit cleanup — INDEX refresh, audits/verification READMEs, glossary, methodological-triad annotation
date_shipped: 2026-04-30
status: shipped
related_risks: []
related_findings: [F-OPS-3, F-OPS-4, F-SLICE-E-3]
related_adrs: []
---

# PHASE-1C3-POLISH — Post-prep audit cleanup

## Goal

Close the small inconsistencies and documentation refinements surfaced by the post-prep comprehension audit (`docs/audits/project-comprehension-audit-fresh-claude-2026-04-30-post-prep.md`). Self-rating from that audit was "High execution-ready" with only Section B inconsistencies (#1, #2), Section D refinements (#1, #2, #3), and Section E what-was-confusing items (#2, #3) outstanding. This slice closes them. Pure documentation; no code, no migrations, no schema work.

Success criterion: re-running the post-prep audit prompt against post-polish state should mark each named gap as closed without surfacing new ones.

## What shipped

### Group 1 — INDEX.md and audits/ structure

- **`docs/INDEX.md`** — Header status banner refreshed: "Phase 1c.3 closed 2026-04-30. PHASE-1C3-PREP and PHASE-1C3-POLISH shipped same day." Stub-cleanup forward-reference removed (no longer relevant).
- **`docs/INDEX.md`** — Architecture section: added rows for `architecture/system-overview.md` and `architecture/pipeline-trace.md` (shipped in PHASE-1C3-PREP, were not yet listed in INDEX).
- **`docs/INDEX.md`** — Risks & findings row updated: 25 total entries, 12 risks + 13 findings, 10 verification tasks (`V-1c.3-01`–`V-1c.3-10`).
- **`docs/INDEX.md`** — ADR row updated: `adr/0001` … `adr/0015` (15 ADRs total, with one-line summary of 0013/0014/0015).
- **`docs/INDEX.md`** — Agents section: added row for `agents/testing-philosophy.md` (shipped in PHASE-1C3-PREP).
- **`docs/INDEX.md`** — New **Audits** section between Investigations and ADRs, listing both audit docs and `_README.md`.
- **`docs/INDEX.md`** — Historical "Coming online during this cleanup" passes table replaced with a one-line pointer to CHANGELOG (the table was confusing for fresh agents post-Phase-1c.2).
- **`docs/audits/_README.md`** — New file. Purpose, retention policy (kept indefinitely as historical record), naming convention (`project-comprehension-audit-fresh-claude-{date}[-{run-suffix}].md`).

### Group 2 — scripts/verification/README.md

- **`scripts/verification/README.md`** — New single-page index of all 8 entries (7 scripts + `_template.ts`) as a four-column table: `Script | Phase | Verifies | Recipe`. Each row collapses the prior triangulation across `agents/conventions.md` Pass 6.3, `_template.ts`, and individual script headers into one scan. Includes process for adding new scripts and cross-references to F-SLICE-E-3 (the recipe-propagation lesson behind the header contract).
- Format note (per refinement #1): chose a four-column table over five-line stanzas. The table fits one screen on a standard viewport, making it genuinely one-page scannable. Eight rows total, ~100 chars per row.

### Group 3 — Onboarding read order

- **`docs/agents/onboarding.md`** — Read order now includes `docs/data-dictionary/fields.json` as step 7 (after the system-overview/pipeline-trace pair, before conventions/workflows). Conventions and workflows shifted to steps 8 and 9. Closing line updated: "After step 9 you have working context. ~65 minutes total."

### Group 4 — Glossary entries

- **`docs/glossary.md`** — Added **Slant** entry to Athlete-Lab section (the only currently-active node; canonical ground-truth clip is `slant-route-reference-v1.mp4`).
- **`docs/glossary.md`** — Added **FIXED_TEST_ATHLETE_ID** entry to Athlete-Lab section (UUID `8f42b1c3-5d9e-4a7b-b2e1-9c3f4d5a6e7b`, used by `admin-test-upload`).
- Athlete-Lab section reordered alphabetically to integrate the new entries cleanly (was ordered by mental-model concept; now consistently A-Z).

### Group 5 — Pre-template legacy slice doc banners

Added the one-line banner to **7** legacy docs (not 5 — see "Halts" below):

> *Legacy slice outcome doc (pre-template, Pass 3f). Frontmatter contract evolved 2026-04-26; this doc retained as historical record.*

Files bannered:

1. `docs/process/phase-1c1-slice2-outcome.md`
2. `docs/process/phase-1c1-slice3-outcome.md`
3. `docs/process/phase-1c2-determinism-experiment.md`
4. `docs/process/phase-1c2-slice-a-r04-assertion.md`
5. `docs/process/phase-1c2-slice-b1-outcome.md`
6. `docs/process/phase-1c2-slice-d-outcome.md`
7. `docs/process/phase-1c2-slice-e-outcome.md`

### Group 6 — Methodological triad annotation

- **`docs/risk-register/F-OPS-3-…md`** — Added "## Related findings (methodological triad)" section after the H1, before "## Observation". Frames F-OPS-3 as one face of the triad with F-OPS-4 and F-SLICE-E-3.
- **`docs/risk-register/F-OPS-4-…md`** — Added the same triad block after the existing "## What this finding is about" lede paragraph, before "## Observation".
- **`docs/risk-register/F-SLICE-E-3-…md`** — Added the same triad block after the H1, before "- **Logged:**".
- **`docs/agents/testing-philosophy.md`** — §4 now opens with the triad-framing paragraph (verbatim per spec) before the existing F-OPS-4 sub-pattern enumeration.

The framing across all four locations is consistent: one underlying discipline (trusting a prior assertion without re-verifying against current reality) with three distinct surfaces (plan-vs-state drift, pre-execution inspection scope, recipe propagation). Cross-annotation rather than a new F-OPS-5 finding — preserves existing structure without adding meta-finding overhead.

### Group 7 — Verification, drift fix, closure

- **`docs/process/phase-1c3-prep-slice-outcome.md`** — Drift correction (per refinement #2): the Halt 1 entry originally said "Five … docs" and listed five files. The actual count visible to the detector is five, but the broader pre-template legacy population is seven (the determinism-experiment and slice-a-r04-assertion docs are not matched by the detector's `phase-*-outcome.md` glob). Inserted an explicit "Drift correction (PHASE-1C3-POLISH, 2026-04-30)" callout pointing to this slice outcome doc and noting the audit trail spans both prep and polish outcome docs. The detector NOTE itself still reports 5 (correct for its glob scope); the banner policy applied here covers all 7 pre-template docs (broader, intentionally).
- **`docs/process/phase-1c3-polish-slice-outcome.md`** — This file.
- **`CHANGELOG.md`** — New `[PHASE-1C3-POLISH]` entry.

## Verification

| Check | Method | Outcome |
|---|---|---|
| Detector remains green | `bun run scripts/verification/check-roadmap-sync.ts` | ✅ `OK: 7 shipped slices, all referenced in roadmap.` (NOTE: 5 legacy docs without frontmatter — unchanged from pre-polish baseline) |
| No remaining stale "Pass 3a" / "12 backfilled ADRs" framing in INDEX | `rg -n 'Pass 3a\|12 backfilled' docs/INDEX.md` | ✅ zero hits |
| No "After step 8" stale read-order phrasing | `rg -n 'After step 8' docs/agents/` | ✅ zero hits |
| Build clean | `npx tsc --noEmit -p tsconfig.app.json` | ✅ green (no output) |
| Triad cross-annotations present in all three findings | `rg -l 'methodological triad' docs/risk-register/` | ✅ F-OPS-3, F-OPS-4, F-SLICE-E-3 all present |

Remaining `rg -n 'Pass 3a' docs/` hits are legitimate historical references in `agents/workflows.md`, audit docs, and prior slice outcome docs — they correctly describe what shipped in Pass 3a. Not drift; not removed.

## Halts encountered

### Halt 1 — Legacy doc count: spec said 5, reality is 7 (resolved pre-execution)

**Surfaced (during pre-execution sweep):** The slice prompt anticipated "5 legacy docs" and included a halt-condition: "Group 5 surfaces more than 5 legacy docs or fewer than 5." Pre-execution sweep counted 7 pre-template docs in `docs/process/` lacking YAML frontmatter (the prompt's 5 + `phase-1c2-determinism-experiment.md` + `phase-1c2-slice-a-r04-assertion.md`).

**Decision:** The "5" came from the PHASE-1C3-PREP outcome doc's Halt 1 entry, which itself only enumerated docs visible to the detector script's `phase-*-outcome.md` glob. The two extra docs are pre-template by the same date criterion (Pass 3f, 2026-04-26) but don't match the detector glob — they're an experiment writeup and a small ship record. Both belong under the "pre-template legacy" banner policy. Resolution: banner all 7; correct the PHASE-1C3-PREP outcome doc's count via the explicit drift-correction callout described in Group 7.

**Triad relevance:** This is itself a fresh instance of the F-OPS-3 / F-OPS-4 / F-SLICE-E-3 triad. PHASE-1C3-PREP asserted "5 legacy docs"; that assertion was propagated into the polish slice prompt without re-verification; pre-execution sweep against current reality found 7. Logged here as a meta-example of why the triad framing matters: even a slice explicitly about closing audit drift can drift in its own enumerations if assertions aren't re-verified at execution time.

### Halt 2 — Glossary alphabetization convention (resolved pre-execution)

**Surfaced:** Glossary uses thematic sections (Product / Athlete-Lab / Process / Files / Retired). Within Athlete-Lab, original ordering was concept-driven (Athlete Lab → Node → Tab → Calibration → calibration_audit → body_based_ppy → upload_id → result_id) rather than alphabetical. New entries (Slant, FIXED_TEST_ATHLETE_ID) didn't have a clean concept-position.

**Decision:** Reordered the entire Athlete-Lab section alphabetically. Cleaner long-term and resolves the placement question. No content changes to existing entries.

## Decisions deferred

- **Detector glob expansion to cover non-outcome docs** — `phase-1c2-determinism-experiment.md` and `phase-1c2-slice-a-r04-assertion.md` lack frontmatter and would emit SHAPE_ERROR if added to the detector glob. Out of scope for polish; would require either expanding the detector to multiple globs with different rules, or normalizing those two docs. Logged as a Phase 2 prep candidate.
- **Retroactive frontmatter normalization for the 7 pre-template docs** — banner suffices for now. Mechanical edit, low value, deferred.
- **F-OPS-5 as a new finding** — explicitly rejected. Cross-annotation across the three existing findings preserves structure without meta-finding overhead.

## Cross-links

- Audit doc that drove this work: [`../audits/project-comprehension-audit-fresh-claude-2026-04-30-post-prep.md`](../audits/project-comprehension-audit-fresh-claude-2026-04-30-post-prep.md)
- Predecessor slice: [`phase-1c3-prep-slice-outcome.md`](phase-1c3-prep-slice-outcome.md)
- Phase 1c.3 retrospective: [`phase-1c3-retrospective.md`](phase-1c3-retrospective.md)
- F-OPS-3, F-OPS-4, F-SLICE-E-3 — methodological triad cross-annotated by this slice
- New: [`../audits/_README.md`](../audits/_README.md), [`../../scripts/verification/README.md`](../../scripts/verification/README.md)

## Recommended re-audit

Re-run the same fresh-Claude comprehension audit prompt against post-polish state. Section B inconsistencies #1 and #2, Section D #1/#2/#3, and Section E what-was-confusing #2/#3 should all report closed. Self-rating expected to remain "High execution-ready" with the two intentional MEDIUMs (repo-level abstractions) unchanged. If new gaps surface, log them into a Phase 2 prep backlog rather than expanding this slice retroactively.
