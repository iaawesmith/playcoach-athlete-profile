---
id: ADR-0008
title: Validation triggers instead of CHECK constraints for time-based or external-state validations
status: accepted
date: 2026-04-26
deciders: workspace
related_risks: []
related_findings: []
supersedes: []
superseded_by: []
---

# ADR-0008 — Validation triggers over CHECK constraints

## Context

Postgres `CHECK` constraints must be **immutable** — they cannot reference `now()`, other rows, or any non-immutable function. Common validations like "expire_at > now()" or "value within plausibility range relative to another column at insert time" cannot be expressed as CHECK constraints without immutability errors at table creation, or they create restoration failures during database snapshots/restores when the constraint re-evaluates.

The Supabase / managed-Postgres environment treats CHECK constraint violations during restore as fatal — a single time-based CHECK on any table can prevent the entire database from being restored.

## Decision

For any validation that:

- References `now()` or other time functions, OR
- References other rows / other tables, OR
- May plausibly need to evolve (relax/tighten) without a destructive migration,

**use a `BEFORE INSERT OR UPDATE` trigger** (`SECURITY DEFINER` if needed) that raises a clear exception. Reserve `CHECK` for truly immutable invariants (e.g., `score BETWEEN 0 AND 100`).

Triggers used for validation:

- Live in the same migration as the table they protect.
- Are named `validate_<table>_<purpose>` for the function and `<table>_validate_<purpose>` for the trigger.
- Raise `EXCEPTION` (not `NOTICE` or `WARNING`) on validation failure with a message starting with `[validation]`.

## Consequences

- **Positive:** restores never fail due to time-based constraint re-evaluation.
- **Positive:** validation logic can evolve via `CREATE OR REPLACE FUNCTION` without dropping/re-adding constraints.
- **Negative:** triggers are slightly slower than CHECK and not visible in `\d` table descriptions — discoverability suffers. Mitigated by naming convention.
- **Negative:** trigger errors are not as cleanly surfaced through PostgREST as CHECK violations. Caller code must parse the `[validation]` prefix.

## Cross-links

- `cloud-project-info` directive: "Use Validation Triggers Instead of Check Constraints."
