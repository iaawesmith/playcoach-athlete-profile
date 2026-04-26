---
id: ADR-0012
title: Indefinite retention for Phase 1c backup tables (Default B)
status: accepted
date: 2026-04-26
deciders: workspace
related_risks: [R-04, R-10]
related_findings: []
supersedes: []
superseded_by: []
---

# ADR-0012 — Indefinite retention for backup tables (Default B)

## Context

ADR-0007 codifies the **pattern** for backup-before-destructive-migration (snapshot to a `*_phase1c_backup` table). That ADR intentionally does not specify retention.

Three retention policies were considered:

- **Default A — TTL.** Backup rows older than N months are deleted automatically. Bounded growth, but rollback window is finite and a forgotten audit can lose data permanently.
- **Default B — Indefinite.** Backup rows are kept forever. Unbounded growth, unbounded rollback window. R-10 (`docs/migration-risk-register.md`) explicitly flags backup table growth as a risk.
- **Default C — Manual prune.** Operator decides per-row when to drop. Highest control, highest operational burden, easiest to forget.

R-04 (the original backup-completeness risk) only required that snapshots exist at migration time. R-10 surfaces the *long-tail* concern of unbounded growth.

## Decision

**Default B — indefinite retention** for Phase 1c backup tables.

Justification:

1. The data volume is small. Phase 1c migrations affect ≤ ~25 rows × ≤ ~10 columns = a few hundred rows of `text` content. Even at 100× this scale, storage cost is negligible.
2. The "I need to look at what we dropped" event is rare but high-stakes. Losing a backup row to a TTL six months after the drop, when an athlete-lab content question surfaces and references decisions made then, is a worse failure mode than carrying the storage cost.
3. R-10 mitigation is **observability, not deletion**: track row count of all `*_phase1c_backup` tables in the operations dashboard (deferred to Phase 1c.3 / Pass 5.4). If growth crosses a threshold (e.g., > 100k rows), revisit this ADR.

Future Phase 2+ migrations may adopt a different default — this ADR scopes specifically to Phase 1c.

## Consequences

- **Positive:** rollback window is unlimited.
- **Positive:** no policy logic to maintain in code or scheduled jobs.
- **Negative:** unbounded growth (mitigated by Phase 1c migration scope being naturally small).
- **Negative:** if Phase 2+ migrations adopt the same pattern at higher volumes without revisiting this ADR, growth becomes unobserved. Pass 5.4 observability + the R-10 row-count threshold is the canonical guardrail.

## Cross-links

- ADR-0007 — the pattern this ADR sets retention policy for. **These are intentionally separate decisions.** ADR-0007 = how to take the snapshot; ADR-0012 = how long to keep it.
- R-04 — original backup completeness risk (closed by ADR-0007).
- R-10 — backup-table growth risk (mitigated by this ADR's observability requirement).
- Future Pass 5.4 deliverable — operational observability for backup table size.
