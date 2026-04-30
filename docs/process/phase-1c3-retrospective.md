---
slice_id: PHASE-1C3-SLICE-F
title: Phase 1c.3 retrospective + formal close
date_shipped: 2026-04-30
status: shipped
related_risks: [R-05, R-07, R-12]
related_findings: [F-OPS-3, F-OPS-4, F-SLICE-E-4, F-SLICE-E-5, F-SLICE-E-6]
related_adrs: [ADR-0007, ADR-0012, ADR-0013, ADR-0015]
---

# PHASE-1C3-SLICE-F — Phase 1c.3 retrospective + formal close

## Goal

> **Success criterion (slice plan v2):** Synthesize lessons across all six 1c.3 slices, document F-OPS-3 and F-OPS-4 (seven sub-patterns) as Phase 2 inputs, decide V-1c.3-08 disposition, audit cross-reference + INDEX integrity, formally close Phase 1c.3.

This slice is structurally different from 1c.3-A through 1c.3-E. No transformation work; documentation synthesis + V-1c.3-08 disposition + integrity audit + formal close.

---

## A. Slice-by-slice summary

### 1c.3-A — R2 stub sweep + V-1c.3-01 orphan verification (2026-04-29)

| Aspect | Detail |
|---|---|
| **Goal stated** | Remove 7 R2 stubs unless `rg` finds live references; resolve `reference_object` / `llm_tone` orphan status |
| **Actual scope** | Matched plan exactly. All 7 stubs removed (zero live references); orphan status confirmed |
| **Halts** | None |
| **Findings** | None new. Process learning: project-wide consumer audits must scope beyond `src/features/` |
| **Shipped** | 7 stub deletions, prep-backlog updates, CHANGELOG entry |
| **ADRs touched** | ADR-0013 referenced (drove the prose→structured stub creations being retired) |

### 1c.3-B — Mechanics tab + MechanicsEditor deletion + kb.mechanics merge (2026-04-29)

| Aspect | Detail |
|---|---|
| **Goal stated** | Delete Mechanics tab + MechanicsEditor file; merge `kb.mechanics` into `kb.phases` per R-12 |
| **Actual scope** | Plan + 200-LOC inline `MechanicsEditor` deletion (file already gone, function lived inline in `NodeEditor.tsx`); CoachingCues subsystem cascade discovered and deferred (V-1c.3-06) |
| **Halts** | 3 — V-1c.3-03 (constraint discovery), V-1c.3-04 (shape/serialization), V-1c.3-05 (location: inline definition + cascade) |
| **Findings opened** | F-OPS-3, F-OPS-4 (origin, sub-patterns 1–3) |
| **Risks closed/mitigated** | R-12 closed (mitigation applied) |
| **Shipped** | Migration `20260429064724_phase1c3b_kb_mechanics_merge`; ~200 LOC removed from `NodeEditor.tsx`; tab inventory regenerated |

### 1c.3-C — Training Status / Solution Class write-path resolution (2026-04-29)

| Aspect | Detail |
|---|---|
| **Goal stated** | Resolve F-SLICE-E-5 write path mutating dropped `solution_class` column |
| **Actual scope** | Plan + four-column defect class (`solution_class`, `performance_mode`, `det_frequency`, `tracking_enabled`) all writing to dropped columns; both readiness gates pruned; nodeExport `training_status` removed; `TrainingNode` interface cleaned |
| **Halts** | 1 sweep + 1 decision-cluster (Q1–Q4) |
| **Findings opened** | F-SLICE-E-6 (open + closed same slice). F-OPS-4 annotated with sub-pattern 5a (decision-cluster) |
| **Risks closed/mitigated** | F-SLICE-E-5 resolved; F-SLICE-E-6 resolved |
| **Shipped** | Code-only (no migration). `TrainingStatusEditor` 270 → 125 LOC; readiness checks pruned; nodeExport tabOrder cleaned |

### 1c.3-D — Tab consolidation 13 → 8 + R-05 mitigation + 5-key kb merge (2026-04-29)

| Aspect | Detail |
|---|---|
| **Goal stated** | Consolidate `TABS` array 13 → 8 or 9 (criterion-gated); ship R-05 redirect banner; merge 5 `knowledge_base` keys into surviving consolidated parents |
| **Actual scope** | Plan (8 tabs final) + 7 integration-decision halts (B1, B2, F, G, H, C, I) + transactional-correctness halt on stale-read defect during multi-source merge (5 → 4 keys) |
| **Halts** | 1 constraint replay + 1 transactional-correctness (sub-pattern 6, NEW) + 7 integration-decision (sub-pattern 5b, NEW) |
| **Findings annotated** | F-OPS-4 sub-patterns 5b + 6. F-SLICE-E-1 acknowledged unchanged |
| **Risks mitigated** | R-05 mitigated (consolidation banner + URL hash redirect map + HelpDrawer redirect map shipped) |
| **Shipped** | Migration `20260429204157` (constraint expansion) + `20260429204305` (5-key merge with accumulator pattern); `NodeEditor.tsx` 13 → 8 tabs, sub-editors inlined; `ConsolidationRedirectBanner.tsx` created; `nodeExport.ts` tabOrder consolidated |

### 1c.3-E — R-07 backup disposition audit + slice-tag normalization (2026-04-30)

| Aspect | Detail |
|---|---|
| **Goal stated** | Verify integrity of `athlete_lab_nodes_phase1c_backup` rows from B/C/D; close or mitigate R-07 |
| **Actual scope** | Plan + slice-tag taxonomy normalization (single-letter → `<phase>-<slice>` form) on 9 rows (3+4+2 distribution). 10 PHASE-1C2-SLICE-E rows deferred (V-1c.3-10) |
| **Halts** | None classical; one structural finding surfaced (sub-pattern 7) |
| **Findings annotated** | F-OPS-4 sub-pattern 7 (taxonomy drift across slices over time, NEW; structural remediation distinct from 1–6) |
| **Risks mitigated** | R-07 mitigated |
| **Shipped** | Migration `20260430212950` (CHECK constraint expansion + 9-row normalization); incidental `NodeEditor.tsx` 3-`</div>` close (residual from 1c.3-D Pipeline Config inlining, caught by `tsc -p tsconfig.app.json`) |

### 1c.3-F — Phase 1c.3 retrospective + formal close (2026-04-30, this slice)

| Aspect | Detail |
|---|---|
| **Goal stated** | Synthesize 1c.3 lessons; resolve V-1c.3-08; cross-reference + INDEX integrity audit; close Phase 1c.3 |
| **Actual scope** | Plan + one halt-and-decide (CHECK constraint replay for 1c.3-F slice tag during V-1c.3-08 merge — sub-pattern 1 replay) + INDEX count drift reconciled |
| **Halts** | 1 — F-OPS-4 sub-pattern 1 replay (CHECK constraint enumerated under 1c.3-E expansion did not include `1c.3-F`; constraint extended in slice migration) |
| **Findings annotated** | F-OPS-4 (no new sub-pattern; sub-pattern 1 replay confirms cadence — every new slice that writes backups must extend the slice CHECK constraint) |
| **Shipped** | Migration `slice1c3_f_v08_overview_to_basics_merge` (constraint expand + 2 backup rows + kb.overview → kb.basics merge); this retrospective doc; INDEX count reconciliation; CHANGELOG entry |

---

## B. Methodological evolution

### F-OPS-3 — plan-state drift

**Surface:** 1c.3-B prep inventory found `MechanicsEditor.tsx` already deleted, `pro_mechanics` already purged from frontend, TABS comment block reading "deferred to 1c.3" though E.5 recovery had already shipped that work.

**Lesson:** plan documents describe intent at write time; they do not auto-update when reality changes. Slice plans should treat upstream plans as historical context and re-derive current state via pre-execution inspection.

**Informed subsequent slices:** every slice from 1c.3-C onward opened with a pre-execution inspection phase rather than treating prep backlog or slice plan as ground truth. This discipline directly enabled the 1c.3-C four-column defect-class discovery.

### F-OPS-4 — pre-execution inspection scope underestimates reality

Seven sub-patterns surfaced across five slices. The first six concern within-slice failures; the seventh concerns across-slice temporal drift. Different remediation classes:

| # | Name | Origin | Class | Remediation |
|---|---|---|---|---|
| 1 | Constraint discovery | 1c.3-B | within-slice | Methodological — enumerate constraints via `pg_constraint` |
| 2 | Shape discovery | 1c.3-B | within-slice | Methodological — sample N elements at every nesting level |
| 3 | Location discovery | 1c.3-B | within-slice | Methodological — `rg` for symbol globally, not assumed file path |
| 4 | Stated-vs-actual scope (structural) | 1c.3-A retroactive | within-slice | Methodological — expect scope underestimation; build halt-tolerance |
| 5a | Pre-execution decision-cluster | 1c.3-C | within-slice | Methodological — surface decisions before code edits |
| 5b | Integration-decision halt | 1c.3-D | within-slice | Methodological — enumerate consumer integration points alongside transformation |
| 6 | Transactional correctness on multi-source merges | 1c.3-D | within-slice | **Algorithmic** — accumulator pattern + single terminal commit + post-condition assertions |
| 7 | Taxonomy drift across slices over time | 1c.3-E | **across-slice** | **Structural** — durable identifiers from start, OR periodic audit + normalization |

The evolution from one example to seven distinct sub-patterns across five slices is itself the strongest evidence that the methodological lesson is generalizable rather than slice-specific.

**Sub-pattern 1 replay observation (this slice):** the CHECK constraint expanded in 1c.3-E to allow `1c.3-E` did not include `1c.3-F`. The merge in 1c.3-F failed first iteration on the constraint, expanded it, retried clean — exactly the 1c.3-B precedent. This is not a new sub-pattern; it confirms the cadence: **every slice that writes backups must extend the slice CHECK constraint as part of its migration**, or the constraint should accept a regex (`^1c\.[0-9]+-[A-Z]$`) instead of an enumerated whitelist. Logged as a Phase 2 process recommendation below.

---

## C. What worked

- **Halt-and-decide discipline.** Every halt in 1c.3-B/C/D/E/F prevented a worse outcome (invented disposition values, broken substring assertions, premature subsystem retirement, lost merge content, slice-tag collision under rollback pressure). Halts ARE the value, not inefficiency.
- **Pre-execution sweep + decision-cluster as standard slice opening.** From 1c.3-C onward, the standard slice opening became: (1) pre-execution sweep for scope bounds, (2) decision-cluster for plan gaps, (3) execution. This shape worked across very different slice geometries (write-path cleanup, tab consolidation, audit verification, retrospective).
- **Atomic migrations with byte-equal substring assertions.** ADR-0007's backup-snapshot pattern paired with substring assertions (1c.3-B, 1c.3-D, 1c.3-F) caught the only data-loss failure mode (1c.3-D stale-read) at post-condition time, before commit, with rollback to clean backup state.
- **Backup pattern with honest disposition values.** R-07 audit confirmed 9/9 in-scope backup rows had honest `disposition` + `original_intent` + `source_column` against actual operations. The discipline of writing honest backup metadata at write time paid out at audit time.
- **ADR + risk register + slice outcome doc structure.** Cross-references between the three layers stayed coherent across six slices. ADR-0015 evolved through annotations rather than supersession; F-OPS-4 evolved through five annotations preserving the connection between sub-patterns rather than fragmenting into seven separate findings.

---

## D. What didn't (or could be improved)

- **TypeScript strict mode disabled** allowed latent bugs to ship past `tsc --noEmit`. Concrete cost: 1c.3-D's `nodeExport.ts:436` `tabOrder` discovery (untyped string in a position the union should have constrained); 1c.3-E's `NodeEditor.tsx` 3-`</div>` residual from 1c.3-D Pipeline Config inlining was caught only by `tsc -p tsconfig.app.json` (stricter than the default `tsc --noEmit`). **Phase 2 prep recommendation: enable strict mode incrementally.**
- **Single-letter slice tags** (`B`, `C`, `D`, `E`) created taxonomy collision when reused across phases (1c.2 ↔ 1c.3). Resolved structurally in 1c.3-E with durable `<phase>-<slice>` form. Cost: one full audit slice (1c.3-E) + V-1c.3-10 backlog for 10 remaining 1c.2-E rows. **Cheap to prevent at design time, expensive to remediate after the fact.**
- **Plan-state drift in 1c.3-B initial inventory.** The cost was three execution-time discoveries that pre-execution inspection could have caught with broader scope. Origin of F-OPS-3.
- **Methodological lessons surfaced through execution rather than planning.** F-OPS-4's seven sub-patterns all surfaced execution-side. This is the value of execution-as-verification, but also the cost of work done before the lesson was available — earlier slices ran with narrower discipline than later slices benefited from. Normal evolutionary cost; worth naming.
- **Slice CHECK constraint as enumerated whitelist** rather than pattern. Required extension in 1c.3-E AND 1c.3-F (and will require extension in every future backup-writing slice). A regex CHECK (`^(B|C|D|E|1c\.[0-9]+-[A-Z])$`) would eliminate the constraint-extension halt cadence permanently. **Phase 2 prep recommendation: convert to validation trigger or pattern CHECK.**

---

## E. Deferred to Phase 2

| Item | Owner phase | Notes |
|---|---|---|
| **F-SEC-1** — RLS hardening + public bucket listing | Phase 3 ship blocker | Surfaced repeatedly in Supabase linter; tracked since 1c.2-Slice-E |
| **F-OPS-1** — zombie upload accumulation | Operational hygiene | Sev-3, no immediate phase blocker |
| **F-OPS-2** — missing error boundary around NodeEditor | Phase 3 ship blocker | Sev-2 |
| **F-SLICE-B-1** — calibration accuracy (2–6× distance error, static-only fundamentally limited) | **Phase 2a** | Deferred per ADR-0004 pending ground-truth dataset growth (n=1 → n≥3) |
| **F-SLICE-B1-2** — release speed metric correctness on slant-route-reference-v1.mp4 | **Phase 2b** | Reframed 2026-04-26; metric audit gates |
| **F-SLICE-E-2** — pipeline `calibration_audit` ~0.78% non-deterministic drift | **Phase 2 investigation** | ADR-0005 multimodal-mode awareness in place |
| **V-1c.3-06** — CoachingCues subsystem retirement | Future cleanup slice | Blocked on `coaching_cues_migration_status = 'confirmed'` for all nodes |
| **V-1c.3-07** — `score_bands` consumer wiring (R-11) | Phase 2 or 3 (whichever ships consumer first) | Sev-4, dead weight until consumer exists |
| **V-1c.3-08** — `kb.overview` / `kb.test` disposition | **RESOLVED THIS SLICE** (see §F) | — |
| **V-1c.3-09** — Reference Video Quality Guide overlap | Phase 2 admin authoring or Phase 3 athlete UI | Re-deferred from 1c.3-E to 1c.3-F to Phase 2/3 (audience separation decision belongs with audience-facing work) |
| **V-1c.3-10** — 1c.2-E backup slice tag normalization | Future cleanup | 10 rows; mechanical UPDATE per 1c.3-E precedent |

---

## F. V-1c.3-08 disposition decision (RESOLVED)

**Sample state (Slant node only):**
- `kb.overview`: 2 sections, 7,363 bytes total. Titles: `OVERVIEW TAB OVERIVEW` (sic) + `- Field 1: Skill Overview`. Content: real authored documentation describing the (now-retired) Overview tab and the Skill Overview rich-text field that fed it.
- `kb.test`: 1 section, 3,123 bytes. Title: `Overview`. Content: test-tab documentation.

**Tab status:** Overview tab was retired in 1c.3-D consolidation (final 8 tabs: basics, videos, phases, metrics, reference, prompt, badges, test). Test tab survives.

**Decision:**

- **`kb.overview`: merged into `kb.basics`.** Mirrors the training_status pattern from 1c.3-D (consolidated content keyed to a retired tab → migrated to surviving parent with provenance prefix and `(migrated)` title suffix). Content is meaningful authored documentation about a field that still surfaces (Skill Overview rich-text feeds athlete training feed header), so the documentation belongs alongside other basics-tab admin guidance rather than being dropped.
- **`kb.test`: left untouched.** Test tab still exists in the editor; `kb.test` is the natural home. No action.

**Migration shipped:** `slice1c3_f_v08_overview_to_basics_merge` — extends `alb_phase1c_slice_chk` to allow `1c.3-F`; backs up 2 overview sections (slice='1c.3-F', disposition='relocated'); appends to basics with provenance HTML prefix; drops `kb.overview` key. Atomic; post-condition assertions: 2 backup rows, basics length 13 → 15, overview key absent. ✅ all passed.

**Rationale captured for retrospective:** the decision tree was — meaningful → merge with provenance; stale/test data → drop after backup; never leave indefinitely without explicit decision. `kb.overview` content cleared the meaningful bar (real authored field documentation, distinct from `kb.test`).

---

## G. Cross-reference integrity audit

### ADR cross-link audit (15 ADRs)

| ADR | Slices that reference it | Cross-link verified |
|---|---|---|
| ADR-0001 (user_roles separate table) | F-SEC-1 | ✅ |
| ADR-0002, ADR-0003 (Lovable Cloud / AI Gateway defaults) | None this phase | ✅ no expected refs |
| ADR-0004 (B2 calibration deferral) | F-SLICE-B-1, F-SLICE-B1-2 | ✅ |
| ADR-0005 (±1% determinism tolerance) | F-SLICE-E-2 | ✅ |
| ADR-0006 (phase ordering: metrics before UI) | F-SEC-1, F-OPS-1, F-OPS-2 | ✅ |
| ADR-0007 (backup snapshot pattern) | R-04, R-07; 1c.3-B, 1c.3-D, 1c.3-E, 1c.3-F slices | ✅ |
| ADR-0008 (validation triggers over CHECK) | None this phase | ✅ — **but recommended for slice CHECK conversion** (see §I below) |
| ADR-0009, ADR-0010, ADR-0011 (MediaPipe / Zustand / Material Symbols) | None this phase | ✅ no expected refs |
| ADR-0012 (backup retention indefinite) | R-04, R-10; 1c.3-E (sub-pattern 7 origin) | ✅ |
| ADR-0013 (prose-to-structured policy) | 1c.3-A | ✅ |
| ADR-0014 (C.5 unified body_based) | F-SLICE-B-1 | ✅ |
| ADR-0015 (Mechanics tab delete-not-patch) | R-12, F-OPS-3, F-OPS-4, F-SLICE-E-4; 1c.3-B | ✅ |

**Result:** clean. All ADRs that should be referenced by 1c.3 work are referenced. No supersession events occurred during 1c.3 (ADR-0015 evolved via annotation, not supersession).

### R-* and F-* cross-link audit (12 risks + 13 findings)

Per-entry status verification against slice outcome claims:

| ID | Status (INDEX) | Status (per-file) | Slice-claim consistent? |
|---|---|---|---|
| R-01 | mitigated | mitigated | ✅ (1c.1) |
| R-02, R-03 | open | open | ✅ |
| R-04 | open | open | ✅ Sev-1, controlled by R-04 assertion script |
| R-05 | mitigated | mitigated (1c.3-D ship) | ✅ |
| R-06, R-08, R-09 | open | open | ✅ |
| R-07 | mitigated | mitigated (1c.3-E ship) | ✅ |
| R-10, R-11 | open | open | ✅ |
| R-12 | closed | closed (1c.3-B ship) | ✅ |
| F-OPS-1, F-OPS-2 | open | open | ✅ Phase 2/3 deferral |
| F-OPS-3, F-OPS-4 | open | open | ✅ retained as live process-lessons |
| F-SEC-1 | open | open | ✅ |
| F-SLICE-B-1 | deferred | deferred | ✅ |
| F-SLICE-B1-2 | open | open | ✅ |
| F-SLICE-E-1 | open | open | ✅ Sev-3, det_frequency complex consolidation deferred |
| F-SLICE-E-2 | open | open | ✅ |
| F-SLICE-E-3 | open | open | ✅ process lesson |
| F-SLICE-E-4, F-SLICE-E-5, F-SLICE-E-6 | resolved | resolved | ✅ |

**Result:** clean. Per-file status matches INDEX status for all 25 entries. Cross-links bidirectional where present (R-12 ↔ ADR-0015 ↔ F-OPS-3/F-OPS-4 verified; R-07 ↔ F-OPS-4 verified; R-05 ↔ R-12 ↔ F-OPS-4 verified).

---

## H. INDEX integrity check (drift reconciled)

INDEX header line 5 narrative claimed:
- `26 total entries — 12 risks (R-01–R-12) and 14 findings (F-*)`
- `9 verification tasks (V-1c.3-01–V-1c.3-09)`

**Actual counts at 1c.3 close:**
- Risks: 12 (R-01–R-12) ✅
- Findings: **13** (F-OPS-1, F-OPS-2, F-OPS-3, F-OPS-4, F-SEC-1, F-SLICE-B-1, F-SLICE-B1-2, F-SLICE-E-1 through E-6) — INDEX narrative said 14, actual is 13. **Drift.**
- Verification tasks: **10** (V-1c.3-01 through V-1c.3-10) — INDEX narrative said 9. **Drift.**
- Total entries: 12 + 13 = 25 (not 26). **Drift.**

Status distribution at close:
- R-* — open: 7 (R-02/03/04/06/08/09/10/11 = 8) // recount: R-02, R-03, R-04, R-06, R-08, R-09, R-10, R-11 = **8 open**; R-01, R-05, R-07 mitigated (3); R-12 closed (1). Total 12. ✅
- F-* — open: 7 (F-OPS-1, F-OPS-2, F-OPS-3, F-OPS-4, F-SEC-1, F-SLICE-B1-2, F-SLICE-E-1, F-SLICE-E-2, F-SLICE-E-3 = **9 open**); deferred 1 (F-SLICE-B-1); resolved 3 (F-SLICE-E-4, E-5, E-6). Total 13. ✅

**INDEX narrative reconciled in this slice** — counts updated to 12 risks + 13 findings + 10 verification tasks = 25 total entries. Status-distribution sentence added.

---

## I. Phase 2 readiness inputs

- **Calibration architecture decision (ADR-0004)** — deferred pending ground-truth dataset growth (n=1 → n≥3 / ≥2 contexts). Phase 2a inputs in place: `docs/reference/calibration/ground-truth.yaml` schema ready; `docs/reference/calibration-audit-rollup.{md,csv}` seeded with 9 rows.
- **Determinism tolerance (ADR-0005)** — multimodal-mode-aware ±1% tolerance in place. F-SLICE-E-2 ready for Phase 2 investigation. `docs/reference/determinism-drift.csv` populated and DB-verified.
- **Foundation scaffolds populated** — tiers/metrics/events/observability schemas under `docs/reference/`; `scripts/aggregate-calibration-audit.ts` operational; `scripts/generate-tab-inventory.ts` keeps tab inventory AUTO block in sync.
- **Methodological discipline ready** — F-OPS-3 plan-state drift discipline + F-OPS-4 seven-sub-pattern catalogue ready to apply. Halt-tolerance built into slice planning posture from 1c.3-C onward; Phase 2 slices should inherit.
- **Backup table state** — `athlete_lab_nodes_phase1c_backup` audited (R-07 mitigated); 9 rows on durable `<phase>-<slice>` form, 10 legacy rows on V-1c.3-10 normalization queue, 2 rows added this slice (V-1c.3-08). All disposition values honest. Indefinite retention per ADR-0012.

---

## J. Process recommendations for Phase 2

1. **Continue F-OPS-4 family discipline.** Pre-execution sweep + decision-cluster as standard slice opening. Plan for halts as the system working correctly. Apply remediation by sub-pattern class (methodological / algorithmic / structural).
2. **Use full phase-slice taxonomy from start.** Sub-pattern 7 lesson. Durable identifiers (`<phase>-<slice>`) over short forms even when short forms are unambiguous at write time.
3. **Convert slice CHECK constraint to pattern or validation trigger.** Sub-pattern 1 replay observation from this slice. Current enumerated-whitelist requires extension every backup-writing slice; a pattern CHECK (`^(B|C|D|E|1c\.[0-9]+-[A-Z])$`) or validation trigger per ADR-0008 eliminates the cadence permanently. **Recommend as Phase 2 prep work.**
4. **Enable TypeScript strict mode incrementally.** Catches latent bugs at build time (1c.3-D `tabOrder` and 1c.3-E missing-`</div>` precedents). Apply per-file or per-feature; do not gate Phase 2 on full-repo strict.
5. **Apply transactional correctness pattern for multi-step migrations.** Sub-pattern 6 lesson. Multi-source-to-single-target patterns must use accumulator + single terminal commit + post-condition invariant assertions. Document in agent conventions.
6. **Run app-level tsc in slice verification.** `npx tsc --noEmit -p tsconfig.app.json` is stricter than the default `tsc --noEmit` and surfaces JSX structural issues the default misses (1c.3-E discovery).
7. **Audit-shaped verification slices on long-horizon data structures.** Per sub-pattern 7: long-lived data subject to taxonomy or content drift should be audited periodically (cheap during a verification slice, expensive under rollback pressure). Backup table + reference YAML files are the candidates.

---

## Cross-links

- All five slice outcome docs: [1c.3-A](phase-1c3-slice-a-outcome.md), [1c.3-B](phase-1c3-slice-b-outcome.md), [1c.3-C](phase-1c3-slice-c-outcome.md), [1c.3-D](phase-1c3-slice-d-outcome.md), [1c.3-E](phase-1c3-slice-e-outcome.md)
- [F-OPS-3](../risk-register/F-OPS-3-deferred-work-shipped-earlier-creates-plan-vs-state-drift.md) (origin lesson)
- [F-OPS-4](../risk-register/F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md) (seven sub-patterns)
- [`docs/process/phase-1c3-prep-backlog.md`](phase-1c3-prep-backlog.md) — V-1c.3-01 through V-1c.3-10 dispositions
- [`docs/risk-register/INDEX.md`](../risk-register/INDEX.md) — counts reconciled this slice
- [`docs/roadmap.md`](../roadmap.md) — Phase 1c.3 status updated to Complete
- ADRs accepted/referenced this phase: ADR-0007, ADR-0012, ADR-0013, ADR-0015 (annotated)
- Migration `slice1c3_f_v08_overview_to_basics_merge` — V-1c.3-08 disposition shipped this slice
