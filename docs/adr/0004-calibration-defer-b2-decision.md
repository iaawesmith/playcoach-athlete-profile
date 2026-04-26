---
id: ADR-0004
title: B2 calibration architecture decision deferred until ground-truth dataset has ≥3 entries / ≥2 contexts
status: accepted
date: 2026-04-26
deciders: workspace
related_risks: []
related_findings: [F-SLICE-B-1, F-SLICE-B1-2, F-SLICE-E-2]
supersedes: []
superseded_by: []
---

# ADR-0004 — Defer B2 calibration architecture decision

## Context

Athlete Lab's pose pipeline produces metrics in pixels and converts them to real-world units via a `pixels-per-yard` (ppy) calibration. Two code paths exist:

- **`static_ppy = 80`** — a hand-authored constant intended for sideline football tactical-camera framing.
- **`body_based_ppy`** — computed at runtime by `calculateBodyBasedCalibration` in the edge function, derived from athlete pixel-height vs claimed real height.

On the only ground-truth clip we have (`slant-route-reference-v1.mp4`, soccer training facility), both paths under-report ppy vs measured ground truth (~495). `body_based` is off by 1.7–2.4×; `static` is off by 5–6.9×. Two architectural options were proposed during Slice B:

- **Option A — delete one path.** Pick the less-wrong path (`body_based`), delete `static`, document the choice.
- **Option B — eliminate both paths and use world coordinates.** Re-architect to derive distances from a world-coordinate model (single homography, in-frame scale reference, or pose-derived absolute scale).

Option A was tempting because it is small. It was rejected because: (a) `body_based` is still 1.7–2.4× off — picking it codifies a known-wrong calibration, (b) the directional finding (both under-report) is established on n=1 — Option A might encode a sample-size-of-one mistake.

## Decision

**Defer the B2 architectural decision** until the calibration ground-truth dataset (`docs/reference/calibration/ground-truth.yaml`) has:

- **≥ 3 entries**, AND
- **≥ 2 distinct filming contexts** (e.g., soccer training facility + sideline football + backyard).

The decision will be made on evidence — multiple data points across contexts — not on reasoning from a single clip.

In the interim, **both calibration paths remain in code**. The edge function selects `body_based` as it does today. No `static`-deletion migration runs until the ground-truth dataset clears the threshold.

## Consequences

- **Positive:** prevents an irreversible architectural commitment based on n=1 data.
- **Positive:** the prerequisite work (collecting ground-truth clips) is documented and append-only — progress toward the decision is measurable.
- **Negative:** known-wrong calibration ships in production through Phase 1c.3 and likely Phase 2. Acceptable because Athlete Lab is admin-only pre-Phase-3, no athlete UI consumes the metric yet.
- **Negative:** the deferral is only valid as long as the ground-truth threshold is met before Phase 3 ships athlete UI that surfaces metrics. If Phase 3 approaches without enough clips, this ADR needs an explicit re-decision (defer again with new threshold? ship Option A as a stopgap? halt Phase 3 athlete UI?).

## Cross-links

- F-SLICE-B-1 (`docs/migration-risk-register.md`) — the underlying finding.
- F-SLICE-B1-2 — Release Speed metric correctness, which depends on whichever calibration path B2 ultimately picks.
- F-SLICE-E-2 — calibration noise floor (~0.78% drift on `body_based`); see ADR-0005 for tolerance.
- `docs/reference/calibration/ground-truth.yaml` — the dataset whose growth gates re-opening this ADR.
- `docs/reference/calibration/_schema.md` — append workflow.
