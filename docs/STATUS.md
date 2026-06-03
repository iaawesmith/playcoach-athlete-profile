# STATUS — Resume Here

**Purpose:** Single file a returning operator (or fresh agent) reads first to know where to pick up. Updated at the close of every slice per [`agents/workflows.md` § Drafting a slice outcome → step 5](agents/workflows.md). When this file disagrees with `roadmap.md`, **`roadmap.md` wins on phase narrative; this file wins on what to do next.**

**Last updated:** 2026-06-03 (post-Phase-2a-remediation)

---

## Current phase

**`PHASE-2A` — Calibration robustness and world-landmark activation** (in progress, mid-remediation)

Two parallel tracks plus a closure slice. Track A grows the calibration ground-truth dataset from n=1 toward the ADR-0004 re-open threshold (n≥3 across ≥2 filming contexts). Track B activates BlazePose `pose_world_landmarks` as an alternative coordinate space available to metric definitions. Tracks are independent; neither resolves ADR-0004 alone (per feasibility research, world landmarks lose to a well-calibrated ppy frame on lateral motion). See [`roadmap.md` § 2a](roadmap.md).

---

## Code-complete, verification pending

These slices have landed code but have **not** cleared their shipping bar. They are not "shipped" per [`agents/testing-philosophy.md`](agents/testing-philosophy.md) §4. All three are instances of [F-OPS-6 — Verification deferral across slice boundaries](risk-register/F-OPS-6-verification-deferral-across-slice-boundaries.md).

| Slice | Date code-complete | What's missing | Path to ship |
|---|---|---|---|
| `PHASE-2A-SLICE-A2` | 2026-06-03 | Numerical verification ran against n=1; cross-clip convergence (the property A2 enables) was not exercised. | Methodology cross-check on the first clip with ≥2 usable references. May be addressable now via re-inspection of the n=1 clip for a second reference (yard-line visible elsewhere in frame); otherwise waits on intake. |
| `PHASE-2A-SLICE-B1` | 2026-06-03 | Structural check holds (additive field, no consumer, cannot perturb 2D landmarks). Drift-band Option D corroboration was deferred to B2 and never ran. | Run [`scripts/verification/slice2a_b1_drift_band.ts`](../scripts/verification/slice2a_b1_drift_band.ts) per its RECIPE header: N=10 pre-B1 SHA, N=10 post-B1 HEAD, append to [`reference/determinism-drift.csv`](reference/determinism-drift.csv), verify post-B1 distribution stays inside pre-B1 envelope. |
| `PHASE-2A-SLICE-B2` | 2026-06-03 | Same drift-band corroboration as B1 covers B2 (B2 only adds serialization on top of B1's capture). | Same script run covers both. |

---

## Already shipped

| Slice | Date | Outcome |
|---|---|---|
| `PHASE-2A-SLICE-A1` | 2026-06-03 | Calibration clip intake runbook (slant-route probe node, 3 scale-reference methodologies, halt conditions). [Outcome doc](process/phase-2a-slice-a1-outcome.md). |

---

## Blocked

| Slice | Track | Blocked on |
|---|---|---|
| `PHASE-2A-SLICE-A3` | A — data growth | `PHASE-2A-SLICE-B1`/`B2` drift-band corroboration completing (cross-track dependency: A3 builds the threshold gate that consumes the per-clip pipeline B1/B2 just touched). |
| `PHASE-2A-SLICE-B3` | B — world landmarks | `PHASE-2A-SLICE-B1`/`B2` drift-band corroboration. B3 also re-opens the shipping bar — Option D was set for additive-field, no-consumer slices; B3 introduces the first real `world_keypoints` consumer, which needs its own ground-truth check, not just band corroboration. |
| `PHASE-2A-SLICE-C` | Closure | Both tracks reaching their ship state. |

---

## Next operator action

1. **Pre-B1 baseline:** check out the commit immediately before `pose.py` gained `world_keypoints` (search for the first commit touching `mediapipe-service/app/pose.py` with `world_keypoints` in the diff and back up one). From that SHA, run `slice2a_b1_drift_band.ts --label baseline` 10 times against the canonical slant clip. The script appends to `reference/determinism-drift.csv`.
2. **Post-B1 corroboration:** return to HEAD. Run `slice2a_b1_drift_band.ts --label postship` 10 times against the same clip.
3. **Verify the band:** the script's `--check` mode reads the CSV and applies the decision matrix. Categoricals exact across all 20 runs, post-B1 distribution inside the pre-B1 envelope (no mean shift > 0.1%, no widened variance > 1.5×, no new hash absent from pre-B1 set).
4. **On pass:** amend [`process/phase-2a-slice-b1-outcome.md`](process/phase-2a-slice-b1-outcome.md) §Verification with the actual numbers and CSV row references. Flip both B1 and B2 status to `Shipped` in `roadmap.md` and this file in the same commit. Unblock A3 and B3.
5. **On halt for new mode:** the first diagnostic is N more baseline runs at the pre-B1 SHA, not a B1 investigation — undersampling of the F-SLICE-E-2 mode distribution is the more likely cause and is cheaper to rule out. Only escalate to "B1 added variance" once the baseline mode set is stable.
6. **On halt for mean shift or widened variance at stable mode set:** that is a real F-SLICE-B-* finding. Open it, B1/B2 stay code-complete, A3/B3 stay blocked, decide whether to investigate or revert.

---

## Open halt conditions

- **F-OPS-6 active across A2, B1, B2.** Until the verification steps above clear, no further Track A or Track B slices may ship. A1 stayed clean because its verification was the runbook itself.
- **F-SLICE-E-2 floor (~0.78% bimodal drift).** Already accounted for in the Option D bar; not a new halt, but the reason hash-exact is unavailable as a primary proof.

Per the runbook ([`process/calibration-clip-intake.md` § Halt conditions](process/calibration-clip-intake.md)), the following pause Track A intake entirely:

- Slant route node becomes unpublished or modified mid-phase.
- Analyze pipeline fails to write a `calibration_audit` row (re-check F-OPS-5 silent-fail and F-CALIB-1 shadow-value before re-running).
- Dimension confusion between preview and master file.
- No scale reference in frame **and** athlete height unknown.

---

## How to use this file

- **Coming back after a break:** read top to bottom, then open the "Next operator action" list. That's all you need.
- **Closing a slice (agent):** rewrite the relevant section (Code-complete / Shipped / Blocked / Next operator action) in the same commit that ships the outcome doc + roadmap update. STATUS is part of the slice-close checklist; a slice is not shipped until STATUS reflects it.
- **Conflict with roadmap:** roadmap wins on phase narrative (why this phase exists, sub-phase scope summaries, decision lineage). STATUS wins on what's next.

---

## Cross-links

- [`roadmap.md`](roadmap.md) — phase narrative + sub-phase scope.
- [`reference/phases.md`](reference/phases.md) — canonical slice ID registry + name-collision warning.
- [`agents/workflows.md`](agents/workflows.md) — slice-close checklist (this file is step 5) + F-OPS-6 no-cross-slice-deferral rule.
- [`adr/0004-calibration-defer-b2-decision.md`](adr/0004-calibration-defer-b2-decision.md) — the deferred decision Track A unblocks (distinct from `PHASE-2A-SLICE-B2`; see name-collision warning in `phases.md`).
- [`adr/0005-determinism-tolerance-1pct.md`](adr/0005-determinism-tolerance-1pct.md) — the Option D bar B1/B2 must clear.
- [`risk-register/F-OPS-6-verification-deferral-across-slice-boundaries.md`](risk-register/F-OPS-6-verification-deferral-across-slice-boundaries.md) — the process failure mode this remediation registered.
