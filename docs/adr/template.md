---
id: ADR-NNNN
title: <One-line decision summary>
status: proposed   # proposed | accepted | rejected | superseded | deprecated
date: YYYY-MM-DD
deciders: <person | team | workspace>
related_risks: []      # list of R-NN IDs from migration-risk-register / risk-register/
related_findings: []   # list of F-* IDs
supersedes: []         # list of ADR-NNNN IDs this replaces
superseded_by: []      # list of ADR-NNNN IDs that replace this (set when superseded)
---

# ADR-NNNN — <Decision title>

## Context

What forced this decision. What constraints exist. What was considered.
Cite the source decision context (slice outcome, investigation, prior ADR)
verbatim with file path so future readers can reach the underlying material.

## Decision

The decision itself, in clear language. State what we are doing and what
we are explicitly **not** doing.

## Consequences

- **Positive:** what becomes easier / safer / cheaper.
- **Negative:** what becomes harder / more expensive / riskier.
- **Operational:** any standing rules this ADR creates (e.g., "all new X
  must Y").

## Cross-links

- Risk-register entries this ADR mitigates or creates.
- Prior ADRs this builds on or supersedes.
- Investigation / slice outcome / source-of-truth doc that established the
  context.
- Implementation surfaces (file paths, tables, edge functions).

---

> **Superseding an existing ADR?** See the **ADR supersession convention** in [`docs/agents/conventions.md`](../agents/conventions.md#adr-supersession-convention) for the required frontmatter, banner, cross-reference, and INDEX updates on both the new and the old ADR.
