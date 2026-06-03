---
slice_id: PHASE-2A-SLICE-A2
title: Calibration ppy estimator CLI (tape_measure / yard_line / bbox_cross_check)
date_shipped: null  # code-complete 2026-06-03; verification pending — see Verification §
date_code_complete: 2026-06-03
status: code-complete-verification-pending
related_risks: []
related_findings: [F-SLICE-B-1, F-CALIB-1, F-OPS-6]
related_adrs: [ADR-0004]
---

> **Status note (amended 2026-06-03):** originally marked Shipped. Re-classified to **code-complete-verification-pending** during Phase 2a remediation. The only numerical check (the `bbox_cross_check` math reproducing the n=1 entry) ran against the **n=1 dataset — the very inadequacy Track A exists to remediate**. This is a different face of the same failure mode as B1/B2 ([F-OPS-6](../risk-register/F-OPS-6-verification-deferral-across-slice-boundaries.md)): the verification didn't defer into a future slice literally, it deferred into a dataset state that hasn't been reached yet (n≥3 across ≥2 contexts). Same shape, different boundary.
>
> The verification bar for A2 has three distinct fields. They are not interchangeable. The interim bar can flip A2's status flag; it cannot discharge the full bar or the surviving ADR-0005 obligation.
>
> **Interim bar — within-clip cross-methodology check (±5% envelope).** Methodology cross-check on any single clip that admits ≥2 independent scale references. May be addressable now via re-inspection of the canonical Slant clip — if a yard-line marker is visible elsewhere in frame even though not the original measurement frame, a `yard_line` estimate can be cross-checked against the existing `bbox_cross_check` result, with convergence within the documented ±5% inter-methodology envelope. Operator to inspect and report. This bar is **interim** by name and by intent: it exists to unblock A2's status flag without pretending the dataset gap is closed. Clearing it permits flipping A2 to Shipped; it does not permit closing either of the two fields below.
>
> **Full bar — multi-clip cross-methodology convergence.** 3-methodology cross-check on the first clip from intake that has tape-measure or yard-line plus athlete height in frame. Convergence within the documented ±5% inter-methodology envelope. Owed by A2 regardless of whether the interim bar was cleared. Owner: this slice (A2). Trigger: first qualifying clip lands via the calibration-clip-intake runbook.
>
> **Surviving obligation — ADR-0005 cross-clip determinism (±1%, n≥3 across ≥2 contexts).** This is a **categorically different bar** from either A2 verification field above. The interim and full bars are *within-clip cross-methodology* checks at a ±5% envelope; ADR-0005 is *cross-clip determinism* of the pipeline output at a ±1% envelope. Flipping A2 to Shipped under the interim bar does not discharge this obligation, and clearing the full bar does not discharge it either — ADR-0005 measures a different surface (pipeline reproducibility across distinct clips) at a tighter tolerance. Owner: A3 (calibration dataset threshold script) + first intake clips reaching n≥3 across ≥2 contexts. Status: open and owed independent of A2's flag state.

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
