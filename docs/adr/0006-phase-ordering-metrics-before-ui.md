---
id: ADR-0006
title: Phase ordering — metric quality (Phase 2) before athlete UI (Phase 3)
status: accepted
date: 2026-04-26
deciders: workspace
related_risks: []
related_findings: [F-SLICE-B-1, F-SLICE-B1-2, F-SLICE-E-2]
supersedes: []
superseded_by: []
---

# ADR-0006 — Metric quality before athlete UI

## Context

The original Phase 2 / Phase 3 ordering had **athlete UI (consume metrics in the public Athlete Profile)** scheduled before **metric quality (verify metrics are correct, fix calibration, characterize noise)**. The implicit assumption was that an MVP athlete UI could ship against the existing metrics, and quality work would happen in parallel.

Phase 1c.2 work surfaced three findings that invalidate that assumption:

- **F-SLICE-B-1** — both calibration paths are off by 1.7–6.9× on the only ground-truth clip. Any metric surfacing distance, speed, or pixel-derived measurement is currently wrong by an unknown factor in production.
- **F-SLICE-B1-2** — Release Speed metric correctness on `slant-route-reference-v1.mp4` is unverified against a known-speed clip.
- **F-SLICE-E-2** — `calibration_audit` shows ~0.78% non-deterministic drift on identical inputs (sev-2). The underlying pipeline is not yet repeatable.

Shipping athlete-facing UI on top of metrics that are known-wrong, unverified, or non-deterministic would either:

- **Burn athlete trust** if athletes notice their stats change between viewings, or
- **Lock the wrong metric** as ground truth in athlete expectation if they don't notice, making future correction visible-as-regression.

## Decision

Reorder phases:

- **Phase 2 (now):** metric quality. Resolve calibration (re-open ADR-0004 once ground-truth threshold met). Verify Release Speed against a known-speed clip. Investigate F-SLICE-E-2 root cause. Establish a stable metric registry (Pass 5.2 of this cleanup builds the scaffold).
- **Phase 3 (after Phase 2 closes):** athlete UI. Build the public Athlete Profile, surface metrics with proper confidence/uncertainty disclosure, ship coach/scout views.

The Brand HQ admin builder (the surface this project's UI currently shows) is not gated by this ordering — it is the build-side workflow, not the athlete-consumption side.

## Consequences

- **Positive:** athletes never see wrong-but-confidently-rendered metrics in the consumption surface.
- **Positive:** the metric registry (Pass 5.2) becomes the contract athlete UI builds against, not a moving target.
- **Negative:** athlete-facing release pushed back by the duration of Phase 2. Acceptable because Phase 3 is the public-launch surface and trust there is unrecoverable if broken.
- **Negative:** workstream pressure to "ship something visible" may push back on this ordering. The ADR is the canonical justification when that pressure surfaces.

## Cross-links

- F-SLICE-B-1, F-SLICE-B1-2, F-SLICE-E-2 — the three findings that drove the reorder.
- ADR-0004 (calibration deferral) — its threshold gates Phase 2 closure.
- ADR-0005 (determinism tolerance) — defines the noise floor Phase 2 must investigate.
- `docs/roadmap.md` — phase-ordering visualization and rationale.
