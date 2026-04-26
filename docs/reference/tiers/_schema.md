# Tiers — schema (scaffolding)

> **Pass 5a scaffolding.** This directory will hold tier definitions for the athlete-lab scoring rollup. Phase 1c.2 has no canonical tier set yet; the only historical reference is "Elite Tier" in [`../../glossary.md`](../../glossary.md), which is explicitly **deprecated** in favour of milestone-driven badges.
>
> This schema fixes the contract so future tier definitions land consistently. No tier files exist at scaffold time; first additions are tracked in [`docs/process/phase-1c3-prep-backlog.md`](../../process/phase-1c3-prep-backlog.md).

## Purpose

A *tier* is a coarse classification bucket assigned to an athlete (or to a single metric reading) based on threshold ranges. Tiers exist to give viewers a fast comparative read; they are **not** authoritative scores.

## File layout

- One file per tier system: `<system-slug>.md` (e.g., `release-speed.md`, `mechanics-composite.md`).
- Tier *systems* are scoped per metric or per metric-bundle; do not create a single global tier file.
- Each file MUST start with the frontmatter contract below.

## Frontmatter contract

```yaml
---
system_id: <kebab-slug, immutable>           # e.g., release-speed
title: <one-line summary>
metric_basis: <metric_id from docs/reference/metrics/, OR composite formula reference>
unit: <SI or domain unit, verbatim — e.g., "m/s", "deg", "score-0-100">
status: draft | active | deprecated
introduced_in: <slice id, e.g., 1c.3 or post-1c>
related_adrs: []
related_entries: []                          # R-/F- IDs from docs/risk-register/
last_updated: YYYY-MM-DD
---
```

## Body shape

After the frontmatter:

1. **Tier table** with columns: `tier_id`, `label`, `lower_bound`, `upper_bound`, `bound_inclusive` (`[..)`, `(..]`, `[..]`), `notes`.
2. **Derivation source** — link to the source-of-truth dataset or experiment that justified the thresholds (calibration ground-truth, athlete-lab DB query, external benchmark).
3. **Validation status** — explicit "validated against N samples on YYYY-MM-DD" or "thresholds proposed; not yet validated."

## Anti-patterns

- Do **not** invent thresholds without a derivation source; mark `status: draft` and leave bounds empty until validated.
- Do **not** reuse the deprecated "Elite Tier" naming.
- Do **not** mix multiple metric bases in one tier file; split into per-metric files.
