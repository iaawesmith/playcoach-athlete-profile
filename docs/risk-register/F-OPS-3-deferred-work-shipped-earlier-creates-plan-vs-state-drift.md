---
id: F-OPS-3
title: Deferred work that ships earlier than planned creates plan-vs-state drift
status: open
severity: none
origin_slice: 1c.3-B
opened: 2026-04-29
last_updated: 2026-04-29
classification: process-lesson
---

# F-OPS-3 — Deferred work shipped earlier creates plan-vs-state drift

## Related findings (methodological triad)

This finding is one face of a methodological triad. F-OPS-3, F-OPS-4, and F-SLICE-E-3 each describe a distinct failure mode of one underlying discipline: **trusting a prior assertion without re-verifying against current reality**. F-OPS-3 covers plan-vs-state drift; [F-OPS-4](F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md) covers pre-execution inspection scope underestimating reality; [F-SLICE-E-3](F-SLICE-E-3-recipe-propagation-without-independent-verification-process-lesson-no-severity.md) covers recipe propagation without independent verification.

## Observation

Slice 1c.3-B's prep inventory (in `phase-1c3-prep-backlog.md` and ADR-0015) anticipated several deletion items that the pre-execution audit discovered had **already shipped** during prior slices:

- `MechanicsEditor.tsx` was documented as scheduled for deletion in 1c.3 — pre-execution audit found the file was already deleted (with zero imports). *(Subsequent execution-time discovery: the function was actually defined inline within `NodeEditor.tsx`, not as a separate file — see F-OPS-4 example 3.)*
- `pro_mechanics` and `knowledge_base.mechanics` references in the frontend had already been purged.
- `NodeEditor.tsx`'s `TABS` array still had Mechanics commented out (from Slice E recovery) but the comment block read as "deferred to 1c.3" rather than "this is currently the state."

The plan documents (ADR-0015, prep-backlog) were written at decision-time and never refreshed to reflect what shipped opportunistically during recovery work.

## Methodological lesson

**Deferred work that ships earlier than planned creates plan-state drift.** The drift is real even when the early-shipping was correct (e.g., E.5 recovery legitimately included Mechanics tab hide ahead of the formal 1c.3 delete decision).

Future discipline: **plan documents that defer work to a future slice should be re-validated against the current state at the start of the future slice**, not trusted to still describe reality. The "deferred-until-X" status of a task is a write-once assertion; what actually happens between then and X is independent.

This is why every slice opens with a pre-execution inventory phase rather than treating the prep backlog as ground truth.

## Concrete reframing

The lesson is NOT "ADR-0015 was stale" or "prep backlog was inaccurate" — those are symptoms. The methodological lesson is:

**Plan documents describe intent at the time of writing; they do not auto-update when reality changes. Slice plans should treat upstream plans as historical context, and re-derive current state via pre-execution inspection.**

## Same root-cause family

- **F-OPS-4** — pre-execution inspection scope systematically underestimates reality (related: how to do the re-derivation step well)
- **F-SLICE-E-3** — recipe propagation without independent verification

All three share the pattern: trusting a prior assertion (about plan, about constraints, about file location) without re-verifying against current reality.

## Cross-links

- `docs/process/phase-1c3-slice-b-outcome.md` — slice where this finding surfaced
- ADR-0015 — annotated to reflect actual delivery sequence
- `docs/process/phase-1c3-prep-backlog.md` — the prep document whose drift surfaced the lesson
