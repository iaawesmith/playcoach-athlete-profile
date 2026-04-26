---
id: ADR-0011
title: Material Symbols Outlined as the only icon system; Lexend as the only font
status: accepted
date: 2026-04-26
deciders: workspace
related_risks: []
related_findings: []
supersedes: []
superseded_by: []
---

# ADR-0011 — Single icon system and single font

## Context

React projects accumulate icon libraries quickly: lucide-react, heroicons, react-icons, project-specific SVGs, MUI icons. Each adds bundle weight, inconsistent stroke widths, and visual mismatch. Same problem with fonts: introducing a second font for "just headlines" silently expands to many fallbacks.

PlayCoach's "Kinetic Gallery" design philosophy depends on visual consistency at the level of stroke weight and letterform. Icon mixing breaks the editorial-quality aesthetic.

## Decision

**Icons:** Material Symbols Outlined, loaded via Google Fonts. Used everywhere as a single icon system. No `lucide-react`, no `heroicons`, no `react-icons`, no other icon font or SVG icon library. Custom one-off SVGs are permitted only when no Material Symbols equivalent exists and the icon is a brand asset (e.g., logo).

**Font:** Lexend, loaded via Google Fonts. Used for all text in the application. No fallback to system fonts other than the standard Lexend cascade. No Inter, no SF Pro, no Roboto.

Weights and tracking are intentional and codified in `PRODUCT-SPEC.md` under "Typography." Substituting a font (even temporarily, even for a single label) is forbidden.

## Consequences

- **Positive:** zero icon-style mismatch across the app.
- **Positive:** font loading is a single network request (one family).
- **Positive:** the rule is enforceable — a single grep blocks lucide/heroicon imports in code review.
- **Negative:** Material Symbols Outlined doesn't have every conceivable icon; occasionally an exact concept needs a custom SVG.
- **Negative:** Lexend has fewer weight options than some alternatives. Acceptable — the design system uses 5 weights and Lexend covers them all.

## Cross-links

- Workspace knowledge "Stack" → Icons / Font.
- Workspace knowledge "Things Lovable must never do" → "Use any icon library other than Material Symbols Outlined" / "Use any font other than Lexend."
- `PRODUCT-SPEC.md` Typography section.
