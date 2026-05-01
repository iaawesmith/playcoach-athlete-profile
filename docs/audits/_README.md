# Audits

Point-in-time comprehension snapshots of the repo. Each audit captures what a fresh-Claude session can derive from the codebase + docs alone, and surfaces gaps where the current state and the documented state diverge.

## Purpose

Audits drive **prep slices** when material gaps surface. The PHASE-1C3-PREP and PHASE-1C3-POLISH slices were both audit-driven. They are not retrospectives (those live in `process/phase-*-retrospective.md`) and they are not roadmap-state docs (that lives in `docs/roadmap.md`).

## Retention

Audits are retained as historical record after their gap-closure work ships. They are not pruned. Future fresh-Claude sessions can compare an audit against current state to see what changed in response.

## Naming convention

```
project-comprehension-audit-fresh-claude-{YYYY-MM-DD}[-{run-suffix}].md
```

Run-suffix is optional and used when a second audit runs on the same date (e.g. `-post-prep` for an audit run after a prep slice closes).

## Current audits

- `project-comprehension-audit-fresh-claude-2026-04-30.md` — baseline; drove PHASE-1C3-PREP.
- `project-comprehension-audit-fresh-claude-2026-04-30-post-prep.md` — post-prep verification; drove PHASE-1C3-POLISH.
