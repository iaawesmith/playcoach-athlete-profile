---
slice_id: <e.g., 1c.2 / Slice X>
title: <one-line outcome>
date_shipped: YYYY-MM-DD
status: shipped         # shipped | reverted | partial
related_risks: []       # R-NN from risk register
related_findings: []    # F-* from risk register
related_adrs: []        # ADR-NNNN cross-links
---

# <Slice ID> — <Title>

## Goal

What this slice was supposed to accomplish, in one paragraph. State the
success criterion verbatim from the slice plan.

## What shipped

Bullet list of concrete deliverables: code changes (file paths), migrations
(IDs), backup tables created, scripts added.

## Verification

| Check | Method | Outcome |
|---|---|---|
| <invariant 1> | <script / query / manual> | ✅ / ❌ |

Reference verification scripts at their canonical path
(`scripts/verification/<script>.ts`) and any drift-log row appended to
`docs/reference/determinism-drift.csv`.

## Findings surfaced

New `F-*` entries opened in the risk register during this slice. Link each
to its register entry.

## Decisions deferred

What was explicitly **not** decided this slice and why. Link to the ADR
(or "deferred — no ADR yet") that holds the deferral.

## Cross-links

- Slice plan / kickoff doc.
- ADRs accepted or referenced.
- Risk-register entries opened or closed.
- Drift log row(s) appended.
