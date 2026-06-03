---
slice_id: PHASE-2A-SLICE-A1
title: Calibration clip intake runbook + Phase 2a slice ID registry
date_shipped: 2026-06-03
status: shipped
related_risks: []
related_findings: [F-SLICE-B-1, F-CALIB-1, F-OPS-5]
related_adrs: [ADR-0004]
---

# PHASE-2A-SLICE-A1 — Calibration clip intake runbook

## Goal

Formalize a repeatable workflow for taking a new candidate ground-truth video from "filmed" to "appended entry in `docs/reference/calibration/ground-truth.yaml`," so the Phase 2a goal of moving the dataset from n=1 to n≥3 across ≥2 filming contexts is mechanical rather than improvised. Success criterion: an operator (not the author) can execute the workflow against the existing published probe node without per-clip improvisation, and tooling slices A2/A3 have an unambiguous input contract.

## What shipped

- [`docs/reference/phases.md`](../reference/phases.md) — registered `PHASE-2A-SLICE-A1`, `-A2`, `-A3`, `-B1`, `-B2`, `-B3`, `-C` in the canonical phase-ID registry under a new "Slice ID registry (PHASE-2A)" section. Done as the first action of the slice per the registry's own §5 usage rule.
- [`docs/process/calibration-clip-intake.md`](calibration-clip-intake.md) — new living runbook. Covers probe-node identity (slant route, published), three scale-reference methodologies supported in parallel (tape measure / yard line / bbox cross-check), 4-step intake workflow, and explicit halt conditions cross-linked to F-OPS-5 and F-CALIB-1.
- [`docs/roadmap.md`](../roadmap.md) — Phase 2a section updated from "next" to "in progress" with slice status table.

## What didn't ship

- A2 estimator (`scripts/verification/calibration_estimate_ppy.ts`) — that is the next slice in Track A. The runbook references it as a forward dependency.
- A3 threshold script (`scripts/verification/calibration_dataset_threshold.ts`) — gated on A2.
- Any new ground-truth entry. This slice is process; n is still 1.

## Verification

| Check | Method | Outcome |
|---|---|---|
| Phase-2a slice IDs registered before any other A1 work | Read `docs/reference/phases.md` and confirm new section "Slice ID registry (PHASE-2A)" lists all 7 IDs | ✅ |
| Probe node decision recorded with status | Runbook §"Probe node" cites slant route as published + active + no provisioning needed | ✅ |
| Three methodologies are first-class | Runbook §"Scale-reference methodologies supported" lists `tape_measure`, `yard_line`, `bbox_cross_check` with inputs and best-for context | ✅ |
| Halt conditions are explicit | Runbook §"Halt conditions" table enumerates 4 conditions with cross-links to existing findings | ✅ |
| Append-step delegates to existing schema (no duplication) | Step 4 links to `docs/reference/calibration/_schema.md § Append workflow` rather than re-stating it | ✅ |

## Findings surfaced

None new. The runbook consumes existing findings (F-SLICE-B-1, F-CALIB-1, F-OPS-5) as pre-flight and halt-condition inputs.

## Decisions deferred

- Which methodology the operator commits to in practice — deferred to first real intake clip. Per the user-provided constraint, A2 tooling must support all three at launch.
- Whether `bbox_cross_check`-only entries should count toward `min_entries_for_b2_decision` — runbook flags this as a weak basis but does not exclude it. Re-decide if the dataset reaches n=3 with all entries low-confidence.

## Cross-links

- Plan: Phase 2a kickoff (this conversation).
- ADR-0004 — deferred B2 calibration decision this intake unblocks.
- `docs/process/calibration-clip-intake.md` — the runbook itself.
- `docs/reference/calibration/_schema.md` — append-workflow contract this runbook routes to.
