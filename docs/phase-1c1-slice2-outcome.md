# Phase 1c.1 Slice 2 — Coaching Cues Migration: Shipped Outcome

**Date shipped:** 2026-04-25
**Phase:** 1c.1, Slice 2
**Risk addressed:** R-01 (see `docs/migration-risk-register.md`)
**Sibling docs:** `docs/migration-risk-register.md` (mitigation source-of-truth), `docs/athlete-lab-end-state-architecture.md` (terminal field shape).

This document records the as-shipped behavior of the coaching-cues migration so future phases (notably 1c.2) inherit accurate scope rather than relying on the original plan text, which diverged from the implementation in two specific places.

---

## §1 — What shipped

A per-phase admin migration flow that moves coaching cues from two legacy locations (`pro_mechanics` markdown sections + `— Coaching cues —` separator blocks inside `phase_breakdown[].description`) into a new dedicated field `phase_breakdown[].coaching_cues`, with an atomic description-strip on confirmation.

### Code surface
- **Helpers:** `src/features/athlete-lab/utils/migrateCoachingCues.ts`
  - `reconcileNode(node)` — classifies each phase into one of 5 patterns: `BOTH_IDENTICAL`, `DIFFERS`, `MECHANICS_ONLY`, `INLINE_ONLY`, `EMPTY`. Pure function, no side effects.
  - `applyConfirmedCues(node, confirmedPhaseIds)` — atomic transformation that, for each confirmed phase, writes `coaching_cues` and strips the `— Coaching cues —` separator block from `description`.
  - `nextMigrationStatus(node, confirmedPhaseIds)` — sticky lifecycle (`pending` → `in_progress` → `confirmed`); once `confirmed`, stays `confirmed` even when count regresses.
  - `canOfferConfirmAll(reconciliation)` — returns `true` only when every phase is `BOTH_IDENTICAL` or `EMPTY`. Enables one-click bulk confirm.
- **Modal:** `src/features/athlete-lab/components/MigrateCoachingCuesModal.tsx`
- **Banner:** `src/features/athlete-lab/components/CoachingCuesMigrationBanner.tsx` (rendered on Phases tab and Mechanics tab; no dismiss button per R-01)
- **Persistence:** `src/features/athlete-lab/components/NodeEditor.tsx` — atomic two-column write via `updateNode` (`phase_breakdown` + `coaching_cues_migration_status` in one transaction).
- **Export:** `src/features/athlete-lab/utils/nodeExport.ts` — admin text export now includes the `coaching_cues` field per phase.

### Database surface (Lovable Cloud)
- `athlete_lab_nodes.coaching_cues_migration_status` (text) — added by Slice 2 migration.
- `athlete_lab_nodes.phase_breakdown` (jsonb) — Slice 2 adds `phase_id` (deterministic UUIDv5) and `coaching_cues` (text) per phase entry.
- `athlete_lab_nodes.pro_mechanics` — **NOT modified by Slice 2.** Read-only source. Drop deferred to 1c.2.

---

## §2 — Two divergences from the original plan text (both approved)

### Divergence 1 — Slant pattern is INLINE_ONLY × 5, not BOTH_IDENTICAL × 5

The Slice 2 plan predicted Slant would classify as 5 × `BOTH_IDENTICAL`, enabling the one-click "Confirm all" shortcut. Empirical reconciliation against the live Slant fixture shows 5 × `INLINE_ONLY` because Slant has no `pro_mechanics` content — only the inline `— Coaching cues —` blocks in description.

**Resolution (approved):** Accept the per-phase flow for Slant as-is. The helper logic is correct and reflects the data shape it's given. Slant requires 5 individual confirmation clicks rather than 1 bulk click. Future nodes that have populated `pro_mechanics` matching their inline blocks will get the bulk shortcut.

**Implication:** `canOfferConfirmAll` is a real feature for nodes with duplicate sources, but is not exercised by Slant. No code change required.

### Divergence 2 — Description strip happens at confirm time, not deferred to 1c.2

The Slice 2 plan text expected the inline `— Coaching cues —` block in `description` to be left intact at confirm time, with the strip deferred to 1c.2's deletion phase. The shipped implementation strips the block atomically in `applyConfirmedCues` at confirm time, in the same write that populates `coaching_cues`.

**Resolution (approved):** Keep aggressive strip. The reasoning that drove the divergence:

- Leaving the inline block intact would create a **double-render window** between Slice 2 ship and 1c.2 ship, during which slice 1's `phase_context` mode=full renderer would emit cue text **twice** — once from `coaching_cues` and once from the inline description block. This corrupts Claude prompt quality for every analysis run during that window.
- The alternative — adding renderer-side dedup logic to suppress the inline block when `coaching_cues` is populated — is more complex than atomic strip, introduces more failure surface, and would itself need to be removed in 1c.2.
- Atomic strip closes the double-render window the moment the admin confirms, with no intermediate state.

**Implication for 1c.2:** Description-strip work is **already done**. 1c.2 inherits a smaller scope: only the `pro_mechanics` column drop and cleanup of any CHECK constraints introduced in Slice 1.

---

## §3 — Verification record (242/242 cumulative assertions)

| Step | Suite | Result |
|---|---|---|
| Step 2 | Helper unit tests across 5 patterns + Slant | 25/25 |
| Step 3 | Modal commit-handler smoke | 9/9 |
| Step 4 | Banner SSR smoke (6 surface×status combos) | 37/37 |
| Step 5 | Admin text export across 3 states + regression | 17/17 |
| Step 6 | Persistence smoke (lifecycle + commit math) | 14/14 |
| Step 7 | Extended worst-case fixture (8 phases × all patterns + idempotency) | 71/71 |
| Step 8 | Integration verification report (§8b–§8g) | 69/69 |
| **Total** | | **242/242** |

### Notable verifications from Step 8
- **§8b end-to-end on Slant:** All 5 phases reconciled, all 5 confirmed, `coaching_cues` byte-equal to source per phase (490, 483, 693, 559, 587 chars), description cleaned per Divergence 2.
- **§8c Slice 1 regression on post-migration Slant:** `phase_context` mode=full emits 5 "Coaching cues:" lines (was 0 pre-migration) with text byte-equal to migrated field. All 4 modes stay under 108,800-token budget (totals: 916 across all modes).
- **§8d Worst-case fixture:** 8 phases all carry deterministic `phase_id`s and preserved `coaching_cues` (chars: 983, 925, 851, 737, 651, 652, 635, 612). Token totals across modes: 1128, 1239, 1734, 5299 — all under budget.
- **§8f Lifecycle:** `pending` → `in_progress` → `confirmed` transitions correct; `confirmed` is sticky even when count regresses (defensive); reopen hydrates `confirmedPhaseIds` correctly.
- **§8g Network failure:** `updateNode` rejection surfaces `toast.error`, leaves local state unchanged (no phantom commit), clears modal in-flight state. Retry path works end-to-end.

---

## §4 — Inherited cleanup for 1c.2

1. **Drop `athlete_lab_nodes.pro_mechanics` column.** Backup row goes into `athlete_lab_nodes_phase1c_backup` with `disposition='earmark_phases_coaching_cues'` per R-04 mitigation.
2. **Clean up any CHECK constraints introduced in Slice 1** (token budget guards, `coaching_cues_migration_status` enum guards if added as constraints rather than triggers).
3. **Remove `onStatusChange` no-op prop from `MigrateCoachingCuesModal`** — vestigial from Step 6 wiring; status now flows through the parent's commit handler via `nextMigrationStatus`.
4. **Description-strip is NOT in scope** — already shipped in Slice 2 per Divergence 2.

---

## §5 — Open follow-ups (non-blocking)

- **§8e live UI screenshots:** Deferred-acceptable per Step 4's 37/37 SSR coverage. If captured post-ship, append to this doc.
- **Slice 3 next:** Position field UI on Basics tab (P0 audit item). Plan-mode kickoff after ship.
- **1c.1 slice count re-evaluation:** After Slice 3, decide whether 1c.1 needs additional slices or transition to 1c.2 deletion phase.
