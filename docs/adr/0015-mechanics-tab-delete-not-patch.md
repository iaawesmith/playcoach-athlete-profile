---
id: ADR-0015
title: Slice E recovery — hide Mechanics tab rather than patch MechanicsEditor
status: accepted
date: 2026-04-26
deciders: workspace
related_risks: [R-12]
related_findings: [F-SLICE-E-4, F-OPS-3, F-OPS-4]
supersedes: []
superseded_by: []
---

> **Delivery annotation (2026-04-29):** The decision below — delete-not-patch — still
> holds. Actual delivery sequence differed from this ADR's plan in two ways:
> (1) the Mechanics tab was hidden in Slice E recovery (1c.2) as planned;
> (2) the `MechanicsEditor` component was substantially deleted **earlier than 1c.3
> anticipated** (specific date unknown — see F-OPS-3 drift finding for context;
> likely during Slice E.5 cleanup). The `knowledge_base.mechanics → phases` merge,
> the `TABS`/`TabKey` cleanup, and the inline `MechanicsEditor` function deletion
> all completed in `PHASE-1C3-SLICE-B` (2026-04-29). The `pro_mechanics` field on
> `TrainingNode` and the CoachingCues migration subsystem (`MigrateCoachingCuesModal`,
> `CoachingCuesMigrationBanner`, `migrateCoachingCues.ts`) remain intentionally
> alive — see `phase-1c3-prep-backlog.md` V-1c.3-06 for retirement criteria.

# ADR-0015 — Mechanics tab: delete-not-patch in Slice E recovery

## Context

Slice E Attempt 1 halted on a `TypeError` thrown by the Mechanics tab at
`NodeEditor.tsx:1015` (recorded as F-SLICE-E-4 in
`docs/process/phase-1c2-slice-e-outcome.md` line 207). The crash was a
straightforward null-handling bug — a one-character `?? ""` patch would
have unblocked the tab.

Two options for recovery:

- **Patch:** add the `?? ""` defensive coalesce at the crash site, keep the Mechanics tab live, continue Slice E.
- **Hide:** remove the Mechanics tab from `NodeEditor`'s tab list (5-line edit), continue Slice E without it.

The MechanicsEditor component was already scheduled for deletion in
Phase 1c.3 as part of the broader athlete-lab cleanup (the component
has no consumer in the post-1c.2 architecture; see
`docs/architecture/athlete-lab-architecture-audit.md` and
`docs/process/phase-1c3-prep-backlog.md`). Patching a component slated
for deletion is throwaway work that adds:

- A `?? ""` that will be deleted in 1c.3 anyway.
- A reviewer cost (someone has to understand and approve the patch).
- A small ongoing maintenance liability if 1c.3 slips.

## Decision

Hide the Mechanics tab in Slice E recovery rather than patch
`MechanicsEditor`. The full component deletion happens in Phase 1c.3 per
the existing cleanup queue.

Rule generalized: **when a component is slated for deletion in the next
phase and crashes during the current phase, prefer hiding the entry-point
over patching the component.** The threshold:

- The crashed component must already be on the cleanup queue with a clear next-phase deletion target.
- The hide must be ≤ ~20 lines (typically a tab-list filter or a route gate).
- The hide must not block other in-flight work on the same component (i.e., nobody is actively iterating on it).
- The deletion target must be in the immediate next phase, not "someday."

If any of those fail, patch the component instead.

## Consequences

- **Positive:** zero throwaway code. The 1c.3 deletion lands without first removing a defensive patch.
- **Positive:** Slice E unblocked in minutes rather than blocked on a patch + verification cycle.
- **Positive:** the user-facing surface (Mechanics tab gone) signals "this is being removed" more honestly than a working-but-deprecated tab would.
- **Negative:** any user who relied on the Mechanics tab between Slice E and 1c.3 deletion loses access immediately. Acceptable — internal admin tab, no athlete-facing impact.
- **Operational:** future slice recoveries should consult the cleanup queue (`docs/process/phase-1c3-prep-backlog.md`) before patching a crash. If the crashed component is on the queue, default to hide-not-patch.

## Cross-links

- F-SLICE-E-4 — the originating crash finding (`docs/process/phase-1c2-slice-e-outcome.md` line 207).
- `docs/process/phase-1c2-slice-e-outcome.md` — Slice E outcome doc with full recovery narrative.
- `docs/process/phase-1c3-prep-backlog.md` — cleanup queue containing the MechanicsEditor deletion task.
- `docs/architecture/athlete-lab-architecture-audit.md` — architecture doc establishing MechanicsEditor as orphaned post-1c.2.
- Implementation surface: `NodeEditor.tsx` tab list (the 5-line hide edit) and `MechanicsEditor.tsx` (1c.3 deletion target).
