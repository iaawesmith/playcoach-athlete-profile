# Metrics — schema (scaffolding)

> **Pass 5b scaffolding.** This directory will hold the canonical definitions of every metric the athlete-lab pipeline emits or consumes. At scaffold time, metric names are scattered across [`../../glossary.md`](../../glossary.md), the calibration ground-truth dataset, the determinism CSV header, and slice outcome docs. This directory is the future single source of truth.

## Purpose

Each metric file defines exactly one measurable quantity:

- Its `metric_id` (immutable, snake_case).
- Its unit, range, and computation source.
- Where it is produced (edge function, Cloud Run, derived in UI) and where it is consumed.
- Tolerance bands and the determinism / drift policy that applies to it.

## File layout

- One file per metric: `<metric_id>.md` (e.g., `body_based_ppy.md`, `release_speed.md`, `selected_ppy.md`).
- `metric_id` MUST match the column / field name used in the database, edge-function payloads, and CSV headers verbatim.

## Frontmatter contract

```yaml
---
metric_id: <snake_case, immutable>           # e.g., body_based_ppy
title: <one-line human label>
unit: <SI or domain unit, verbatim>
range: { min: <number|null>, max: <number|null>, inclusive: [true|false, true|false] }
producer: edge-function | cloud-run | client-derived | external
consumer: [list of: ui-card, athlete-lab-tab, scoring, analytics, export]
data_type: float64 | int | string | enum | bool
nullability: not_null | nullable_unconfigured | nullable_by_design
tolerance_pct: <number|null>                 # e.g., 1.0 for the ±1% determinism rule
related_adrs: []                             # e.g., [ADR-0005] for the determinism tolerance
related_entries: []                          # R-/F- IDs from docs/risk-register/
introduced_in: <slice id>
status: active | deprecated | proposed
last_updated: YYYY-MM-DD
---
```

## Body shape

1. **Definition** — one paragraph, plain English, suitable for a non-engineer.
2. **Computation** — code path or formula reference. Cite source files (`scripts/`, `supabase/functions/`) by path.
3. **Source-of-truth dataset** — link to canonical samples (calibration ground-truth YAML, determinism CSV row(s)).
4. **Drift policy** — link to ADR-0005 (1% determinism tolerance) or to a metric-specific override.
5. **Cross-references** — related metrics (e.g., `body_based_ppy` ↔ `static_ppy` ↔ `selected_ppy`).

## Anti-patterns

- Do **not** define a metric whose `metric_id` does not match the actual database column / payload key.
- Do **not** silently change `unit` or `range` after `status: active`; bump `last_updated` and explain in the body, or supersede with a new metric.
- Do **not** invent `tolerance_pct` values without an ADR backing.
