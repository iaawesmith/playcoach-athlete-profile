---
id: ADR-0013
title: Prose-to-structured conversion policy for reference data
status: accepted
date: 2026-04-26
deciders: workspace
related_risks: []
related_findings: []
supersedes: []
superseded_by: []
---

# ADR-0013 — When prose docs convert to structured (CSV/YAML)

## Context

The Phase 1c.2 cleanup pass (Pass 3) converted three prose datasets into
structured artifacts:

- Calibration ground-truth values → `docs/reference/calibration/ground-truth.yaml` (130 numeric values, 31 critical preserved verbatim).
- Determinism drift table → `docs/reference/determinism-drift.csv` (9 rows, full-precision `body_based_ppy`).
- Risk register entries → `docs/risk-register/` per-entry files (Pass 4).

Each of these started life as a markdown table or inline prose embedded in
an investigation / outcome doc. Repeated retrieval, cross-referencing, and
arithmetic against the values surfaced three pain points:

1. **Precision loss** — markdown tables encouraged rounding (`200.21` vs the actual `200.21353797230793`). Re-deriving downstream calculations from rounded values produced silent disagreement.
2. **Schema drift** — prose tables added/removed columns ad-hoc; downstream readers (other docs, scripts) had no fixed contract.
3. **Tooling friction** — rg/grep over markdown tables works for text search but not for typed queries ("show all clips with `calibration_source = body_based`").

This ADR codifies the rule that should have been explicit from the start
of Phase 1c, so future investigations don't accumulate the same friction
before the next cleanup pass.

## Decision

A reference dataset MUST be converted from prose to a structured artifact
(CSV or YAML, with a sibling `_schema*.md`) when **any two** of the
following are true:

1. **Numeric precision matters** — values are used for downstream arithmetic, comparison thresholds, or determinism assertions. (Precision-sensitive values must never live only in prose.)
2. **Multiple readers** — three or more docs cross-reference the same dataset, OR a verification script reads it.
3. **Append-only growth** — new entries are added across slices/phases (e.g., new ground-truth measurements, new drift observations).
4. **Typed queries are useful** — readers ask "show all rows where X = Y" rather than narrative questions.

When converted:

- CSV for tabular row-shaped data (one row per observation, fixed columns).
- YAML for nested / heterogeneous reference data (e.g., per-clip records with optional sub-objects).
- A sibling `_schema-*.md` (CSV) or `_schema.md` (YAML) documents columns/keys, units, source of each value, and any provenance notes.
- Original prose tables become **redirect stubs** pointing to the structured artifact (R2 stubs per `docs/agents/conventions.md`).

Datasets that fail two-of-four stay in prose. Single-use illustrative
tables in investigation docs do **not** need conversion — investigation
docs are write-once narratives.

## Consequences

- **Positive:** verification scripts can parse a typed contract instead of regex-scraping markdown.
- **Positive:** precision-sensitive values are preserved verbatim; rounding becomes a presentation concern, not a storage concern.
- **Positive:** schemas are explicit and reviewable.
- **Negative:** small overhead per conversion (schema doc + redirect stub).
- **Operational:** new prose tables added during a phase that meet the two-of-four rule should be flagged in the next cleanup pass for conversion. Reviewers should call this out in PR comments.

## Cross-links

- `docs/reference/calibration/ground-truth.yaml` + `_schema.md` — Pass 3b conversion.
- `docs/reference/determinism-drift.csv` + `_schema-determinism-drift.md` — Pass 3c conversion.
- `docs/risk-register/` — Pass 4 conversion (one file per risk entry).
- `docs/agents/conventions.md` — R2 stub policy that governs the redirect stubs left behind.
- ADR-0014 — uses the structured `calibration_audit` payload that this policy makes legible.
