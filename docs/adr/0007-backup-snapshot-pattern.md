---
id: ADR-0007
title: Backup-before-destructive-migration pattern (snapshot to `*_phase1c_backup` table)
status: accepted
date: 2026-04-26
deciders: workspace
related_risks: [R-04]
related_findings: []
supersedes: []
superseded_by: []
---

# ADR-0007 — Backup snapshot pattern for destructive migrations

## Context

Phase 1c migrations include destructive column drops on `athlete_lab_nodes` (8 columns dropped in the E.2 migration). R-04 (`docs/migration-risk-register.md`) flagged the original risk: a column drop with no snapshot makes rollback impossible if the migration silently lost text-bearing data that hadn't yet been audited as orphaned.

Two patterns were considered:

- **In-place revertible migrations** — keep dropped columns nullable for a deprecation period, then drop. Slow, requires multiple migrations per intent, and admin tabs continue showing the deprecated columns until the final drop.
- **Pre-drop snapshot to a backup table** — before any destructive change, copy the affected columns into a long-lived backup table keyed by `node_id` and a `source_column` discriminator. Drop columns immediately after.

The snapshot pattern was chosen and validated in Slice A R-04 assertion (`docs/process/phase-1c2-slice-a-r04-assertion.md`). This ADR codifies it as the standard pattern for Phase 1c and beyond.

**This ADR governs the *pattern* (how to take the snapshot).** Retention of the snapshot data is a separate decision — see ADR-0012.

## Decision

For every destructive schema migration that drops or rewrites text-bearing columns:

1. **Pre-snapshot:** create or extend a `<table>_phase1c_backup` companion table with columns `id uuid PK`, `node_id uuid`, `source_column text`, `content text`, plus discriminator metadata as needed (e.g., `node_name`, `disposition`, `audit_pattern`, `audit_reason`, `slice`, `original_intent`, `captured_at timestamptz default now()`).
2. **Capture:** insert one row per (source row, dropped column) pair before the destructive DDL runs.
3. **RLS:** backup tables get `service_role`-only RLS — they are an operational safety net, not a feature surface.
4. **Verify:** before the destructive DDL, run an assertion that backup row count equals the expected (rows × columns) product. Halt the migration on mismatch.

Backup tables are write-once during their migration. Subsequent migrations append new (column, content) pairs but never modify existing rows.

## Consequences

- **Positive:** every destructive migration is reversible by SELECT against the backup table.
- **Positive:** the backup is auditable independently of the migration itself — content can be inspected post-drop to confirm what was archived.
- **Positive:** the assertion step makes "silent backup failure" loud.
- **Negative:** backup tables grow without an automatic retention story (addressed in ADR-0012).
- **Negative:** an extra migration step adds time to each destructive change. Acceptable.

## Cross-links

- R-04 — the risk this ADR mitigates (status: closed, mitigation: this pattern).
- `docs/process/phase-1c2-slice-a-r04-assertion.md` — assertion-step verification record.
- ADR-0012 — separate retention-policy decision (different concern: how long to keep snapshots).
- Existing implementation: `athlete_lab_nodes_phase1c_backup` table.
