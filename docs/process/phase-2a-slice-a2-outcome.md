---
slice_id: PHASE-2A-SLICE-A2
title: Calibration ppy estimator CLI (tape_measure / yard_line / bbox_cross_check)
date_shipped: 2026-06-03
status: shipped
related_risks: []
related_findings: [F-SLICE-B-1, F-CALIB-1]
related_adrs: [ADR-0004]
---

# PHASE-2A-SLICE-A2 — `calibration_estimate_ppy.ts`

## Goal

Replace per-clip improvisation with a deterministic CLI tool that, given a scale reference and pixel measurement from a new candidate clip, emits an append-ready YAML fragment for the `measurement_methodology` list in `docs/reference/calibration/ground-truth.yaml`. Success criterion: an operator running the runbook (PHASE-2A-SLICE-A1) can complete Step 3 — true-ppy estimation — by typing one command per methodology, with the YAML fragment passing the `_schema.md § Append workflow` "do not round, do not reformat" rule by construction.

## What shipped

- [`scripts/verification/calibration_estimate_ppy.ts`](../../scripts/verification/calibration_estimate_ppy.ts) — CLI estimator with the canonical `VERIFIES:` / `RECIPE:` / `BACKLINKS:` header. Supports the three methodologies the runbook declared first-class:
  - `tape_measure` — `ppy = pixel_span_px / length_yd` (accepts `length_ft` convenience input, converts internally).
  - `yard_line` — `ppy = pixel_span_px / distance_yd`, with optional `marking_pair` recorded for auditability.
  - `bbox_cross_check` — produces a `ppy_low` / `ppy_high` range (not a point) based on `pixel_height_px`, `real_height_ft`, and posture-compression bounds; defaults compression to 15–25% for non-upright postures per the n=1 entry's documented compression envelope, 0% for `upright`.
- Output is **stdout-only**. The script does not mutate `ground-truth.yaml`. Per [`docs/reference/calibration/_schema.md` § Append workflow](../reference/calibration/_schema.md), the operator pastes the fragment, preserving every numeric value verbatim. This intentional separation prevents tooling from silently breaking the "no rounding / no reformatting" rule.
- Halt semantics:
  - Exit 1 on unknown method, missing required input field, non-positive numeric where positivity is required, or inverted compression range.
  - Exit 2 on malformed `--inputs` JSON.

## What didn't ship

- The A3 threshold script (`scripts/verification/calibration_dataset_threshold.ts`) — explicitly the next Track A slice.
- Any new ground-truth entry. This slice is tooling. `entries:` is still n=1.
- Auto-population of `measurement_confidence`. Per the runbook, confidence is upgraded `low → medium` only by **independent method convergence**, which is a human judgment about whether two methods' uncertainty envelopes actually overlap on the same clip. Encoding that as a script would conceal the judgment.

## Verification

| Check | Method | Outcome |
|---|---|---|
| Three methodologies match the runbook table verbatim | Cross-reference `calibration-clip-intake.md § Scale-reference methodologies supported` against `estimate()` switch arms | ✅ |
| Output is YAML-fragment-only; no file mutation | Read script — `process.stdout.write` is the only output path; no `writeFileSync` import | ✅ |
| Defensive against bad inputs | `requirePositive` enforces positive finite numbers; JSON parse failure exits 2; method allowlist check before dispatch | ✅ |
| `bbox_cross_check` correctly emits a range, not a point | Reproduce n=1 entry math: pixel_height=800, real_height=6ft (=2yd), compression 15–25% → ppy_low = 800/(2*0.85)=470.59, ppy_high = 800/(2*0.75)=533.33, brackets the entry's recorded 485–495 convergence | ✅ |
| Schema append-workflow contract honored by separation | Script writes nothing to disk; operator paste step preserves "no rounding / no reformatting" rule | ✅ (by construction) |

End-to-end against a real new clip is deferred until the first clip actually arrives (process slice, not a code slice).

## Findings surfaced

None new.

## Decisions deferred

- **Posture-compression defaults for non-upright postures other than the n=1 case.** The 15–25% envelope is recorded in the n=1 entry's `posture_compression` note specifically for "mid-cut, leaning." For other postures (jumping, sprinting upright, stationary), the script falls back to the same 15–25% range when `posture != "upright"`, which is a conservative over-estimate of compression for some postures. Re-decide if a future clip shows the envelope is wrong for its posture; that would be a `bbox_cross_check` methodology refinement, not a new methodology.
- **AR-tag / fiducial-marker methodology.** Not in scope for A2. If a future clip uses an AR tag of known size, add it as a fourth case alongside the runbook table update, per the script's `MAINTENANCE` header.

## Cross-links

- Plan: Phase 2a kickoff.
- [`scripts/verification/calibration_estimate_ppy.ts`](../../scripts/verification/calibration_estimate_ppy.ts) — the script.
- [`docs/process/calibration-clip-intake.md`](calibration-clip-intake.md) § Step 3 — runs this script.
- [`docs/reference/calibration/_schema.md`](../reference/calibration/_schema.md) — append-workflow contract.
- [`docs/process/phase-2a-slice-a1-outcome.md`](phase-2a-slice-a1-outcome.md) — runbook this script implements Step 3 for.
- ADR-0004 — the B2 calibration decision this dataset growth unblocks.
