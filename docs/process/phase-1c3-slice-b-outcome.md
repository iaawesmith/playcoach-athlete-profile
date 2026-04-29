---
slice_id: 1c.3-B
title: Mechanics tab + MechanicsEditor deletion + Mechanics-only knowledge_base merge
date_shipped: 2026-04-29
status: shipped
related_risks: [R-12]
related_findings: [F-OPS-3, F-OPS-4]
related_adrs: [ADR-0007, ADR-0015]
---

# 1c.3-B — Mechanics tab + MechanicsEditor deletion + Mechanics-only knowledge_base merge

## Goal

Per Phase 1c.3 plan v2: delete the Mechanics tab from the admin UI, delete the
`MechanicsEditor` component, and merge `knowledge_base.mechanics` into
`knowledge_base.phases` per the R-12 mitigation. Other `knowledge_base` keys
(`reference`, `filming_guidance`, `training_status`, `scoring`, `checkpoint`)
were explicitly out of scope and deferred to 1c.3-D. Invariant: `knowledge_base`
keys reflect current tab structure at every slice boundary.

## What shipped

### Database
- **Migration `20260429064724_phase1c3b_kb_mechanics_merge`** — atomic transaction performing:
  1. Backup of 3 Mechanics sections from Slant node (`75ed4b18-8a22-440e-9a23-b86204956056`) into `athlete_lab_nodes_phase1c_backup` with `disposition='relocated'`, `slice='B'`, original_intent text disambiguating Phase 1c.3-B.
  2. Append of 3 sections to `knowledge_base.phases` with `(migrated)` title suffix and provenance HTML prefix (`<p><em>Migrated from Mechanics tab (Phase 1c.3-B, 2026-04-29)</em></p>`).
  3. Substring assertion: each backup row's content appears as a suffix of a phases-array element's content.
  4. Drop of `knowledge_base.mechanics` key.
  5. Final invariants: zero nodes with `knowledge_base.mechanics`, Slant node has 9 phases sections.

### Code (`src/features/athlete-lab/components/`)
- `NodeEditor.tsx`:
  - Removed `"mechanics"` from `TabKey` type union
  - Removed Mechanics row from `TABS` array (was previously commented out)
  - Removed `MechanicsSection` from type imports
  - Deleted dead JSX block (`{tab === "mechanics" && ...}`)
  - Deleted `pro_mechanics` validation block in node-readiness check
  - Deleted inline `MechanicsEditor` function (~200 LOC, lines 2180–2386)
- `NodeReadinessBar.tsx`:
  - Removed `"mechanics"` from local `TabKey` type union
- `docs/architecture/athlete-lab-tab-inventory.md`:
  - Regenerated AUTO block via `scripts/generate-tab-inventory.ts` — now reflects 13 visible tabs, 0 hidden (was 14 entries with Mechanics hidden)

### Backup table state
3 rows added to `athlete_lab_nodes_phase1c_backup`:

| source_column | length | disposition | slice |
|---|---|---|---|
| `knowledge_base.mechanics[0].MECHANICS OVERVIEW` | 3,086 | relocated | B |
| `knowledge_base.mechanics[1].- Field 1: Phase Link` | 2,609 | relocated | B |
| `knowledge_base.mechanics[2].- Field 2: Coaching Cues` | 7,994 | relocated | B |

`original_intent` on all 3: `"Phase 1c.3-B: knowledge_base.mechanics merged into knowledge_base.phases per R-12 mitigation; Mechanics tab deleted per ADR-0015"`

## Verification

| Check | Method | Outcome |
|---|---|---|
| R-12 mitigation: `knowledge_base.mechanics` content preserved | Backup table row count = 3, content lengths match | ✅ |
| Atomic merge: substring of each backup content found in phases | Per-row `right(p->>'content', length(b.content)) = b.content` assertion in migration | ✅ |
| `knowledge_base.mechanics` key removed everywhere | Final assertion `COUNT(*) WHERE knowledge_base ? 'mechanics' = 0` | ✅ |
| Phases array length: Slant node | `jsonb_array_length(knowledge_base->'phases') = 9` (was 6 + 3 merged) | ✅ |
| TabKey union no longer references mechanics | `rg '"mechanics"' src/features/athlete-lab/components/NodeEditor.tsx` returns nothing | ✅ |
| Tab inventory AUTO block regenerated | `bunx tsx scripts/generate-tab-inventory.ts` wrote 13 tabs, 0 hidden | ✅ |
| `pro_mechanics` purge in NodeEditor | Inline `MechanicsEditor`, validation, dead JSX all deleted | ✅ |
| R-12 truncation halt | Combined phases content well under any UI display limit (33KB total) | ✅ no halt |

## Findings surfaced

Three execution-time halts surfaced during this slice. Two captured as the same finding (F-OPS-4) because they share root-cause family.

- **[F-OPS-3](../risk-register/F-OPS-3-deferred-work-shipped-earlier-creates-plan-vs-state-drift.md)** — Deferred work that ships earlier than planned creates plan-vs-state drift. Surfaced when pre-execution inventory found `MechanicsEditor.tsx` already deleted, `pro_mechanics` already purged from frontend, and TABS comment said "deferred to 1c.3" but reality was "already done in E.5 recovery."
- **[F-OPS-4](../risk-register/F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md)** — Pre-execution inspection scope systematically underestimates reality. Three concrete examples surfaced in this slice:
  - V-1c.3-03 — constraint discovery (one of three CHECK constraints inspected pre-execution; second surfaced at execution time)
  - V-1c.3-04 — shape discovery (outer container shape verified; element-level shape and JSON-vs-text serialization mismatch surfaced at execution)
  - V-1c.3-05 — location discovery (`MechanicsEditor.tsx` asserted deleted; function actually defined inline in `NodeEditor.tsx` with downstream cascade into a 6-file CoachingCues migration subsystem)

## Decisions deferred

- **Retire CoachingCues migration subsystem** — the `pro_mechanics` field on `TrainingNode`, `MigrateCoachingCuesModal`, `CoachingCuesMigrationBanner`, `migrateCoachingCues.ts`, and consumers in `nodeExport.ts` and `NodeReadinessBar.tsx` remain alive intentionally. Cannot retire until `coaching_cues_migration_status = 'confirmed'` for all nodes (verification SQL in prep backlog). Captured as `V-1c.3-06` in `phase-1c3-prep-backlog.md`. Candidate slice: 1c.3-D or dedicated future slice. **No ADR yet** — decision deferred to next plan-mode pass.
- **Other `knowledge_base` key migrations** (`reference`, `filming_guidance`, `training_status`, `scoring`, `checkpoint`) — explicitly out of scope per slice plan v2; carried into 1c.3-D as part of broader tab-consolidation work.

## Process observation

The three halts in this slice each prevented a worse outcome:
- V-1c.3-03 halt prevented committing invented disposition values (would have required cleanup migration)
- V-1c.3-04 halt prevented committing a broken substring assertion (caught by atomic transaction rollback — source data untouched)
- V-1c.3-05 halt prevented premature CoachingCues subsystem retirement without migration-completion verification (would have risked data loss for unmigrated nodes)

The halts are the system working correctly. Execution-as-verification is a complement to pre-execution inspection: sometimes the only way to verify expectations against reality is to attempt the operation against real schema.

## Cross-links

- Slice plan: `phase-1c3-prep-backlog.md` (1c.3 prep, V-1c.3-06 added)
- Predecessor slice: [1c.3-A outcome](phase-1c3-slice-a-outcome.md)
- ADRs referenced: [ADR-0007](../adr/0007-backup-snapshot-pattern.md) (backup pattern applied), [ADR-0015](../adr/0015-mechanics-tab-delete-not-patch.md) (annotated)
- Risk-register entries opened: [F-OPS-3](../risk-register/F-OPS-3-deferred-work-shipped-earlier-creates-plan-vs-state-drift.md), [F-OPS-4](../risk-register/F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md)
- Risk closed: R-12 (mitigation applied — `knowledge_base.mechanics` merged into `phases`, no nodes stranded)
- Tab inventory: `docs/architecture/athlete-lab-tab-inventory.md` (AUTO block regenerated)
