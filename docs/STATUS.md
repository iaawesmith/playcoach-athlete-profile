# STATUS — Resume Here

**Purpose:** Single file a returning operator (or fresh agent) reads first to know where to pick up. Updated at the close of every slice per [`agents/workflows.md` § Drafting a slice outcome → step 5](agents/workflows.md). When this file disagrees with `roadmap.md`, **`roadmap.md` wins on phase narrative; this file wins on what to do next.**

**Last updated:** 2026-06-03

---

## Current phase

**`PHASE-2A` — Calibration robustness** (in progress)

Two parallel tracks plus a closure slice. Track A grows the calibration ground-truth dataset from n=1 toward the ADR-0004 re-open threshold (n≥3 across ≥2 filming contexts). Track B activates BlazePose `pose_world_landmarks` as an opt-in second coordinate space for metric definitions. See [`roadmap.md` § 2a](roadmap.md) for the full phase narrative.

---

## Last shipped

| Slice | Date | Outcome |
|---|---|---|
| `PHASE-2A-SLICE-A1` | 2026-06-03 | Calibration clip intake runbook (slant-route probe node, 3 scale-reference methodologies, halt conditions). [Outcome doc](process/phase-2a-slice-a1-outcome.md). |
| `PHASE-2A-SLICE-A2` | 2026-06-03 | `scripts/verification/calibration_estimate_ppy.ts` — CLI estimator supporting tape_measure / yard_line / bbox_cross_check, emits append-ready YAML fragments. [Outcome doc](process/phase-2a-slice-a2-outcome.md). |
| `PHASE-2A-SLICE-B1` | 2026-06-03 | `pose_world_landmarks` captured in `PoseFrame` (meters, hip-centered); zero inference-cost add. [Outcome doc](process/phase-2a-slice-b1-outcome.md). |
| `PHASE-2A-SLICE-B2` | 2026-06-03 | `world_keypoints` plumbed through Cloud Run `AnalyzeResponse`; always-on, no gating (Supabase Edge Function response limit researched and documented — Max Response: no documented limit per supabase/supabase#28053). [Outcome doc](process/phase-2a-slice-b2-outcome.md). |

---

## Next queued

| Slice | Track | What to do |
|---|---|---|
| `PHASE-2A-SLICE-A3` | A — data growth | Build `scripts/verification/calibration_dataset_threshold.ts` — mechanically gate ADR-0004 re-open on `len(entries) >= 3 AND len(unique filming_contexts) >= 2`. Pre-condition: A2 estimator now in place; intake runbook can route new clips to YAML entries. |
| `PHASE-2A-SLICE-B3` | B — world landmarks | Add `coordinate_space: "pixel" \| "world"` (default `"pixel"`) to metric definitions in node configs and the metric registry. Pre-condition: B2 plumbing now ships `world_keypoints` to the edge function, so an opt-in metric has a real source to read. |
| `PHASE-2A-SLICE-C` | Closure | Update ADR-0004 and `roadmap.md` once dataset thresholds are met (or deferral renewed). |

---

## Open halt conditions

None active. If A3 is run and any of the following are true, **do not** call ADR-0004 ready for re-open:

- `len(entries) < 3`
- Fewer than 2 distinct filming contexts represented (`notes.filming_context` distinct values)
- All entries are `measurement_confidence: low` (see runbook caveat — low-confidence-only dataset is a weak basis even at n≥3)

Per the runbook ([`process/calibration-clip-intake.md` § Halt conditions](process/calibration-clip-intake.md)), the following pause intake entirely:

- Slant route node becomes unpublished or modified mid-phase.
- Analyze pipeline fails to write a `calibration_audit` row (re-check F-OPS-5 silent-fail and F-CALIB-1 shadow-value before re-running).
- Dimension confusion between preview and master file.
- No scale reference in frame **and** athlete height unknown.

---

## How to use this file

- **Coming back after a break:** read top to bottom, then open the doc linked under "Next queued" for the slice you intend to start with. That's all you need.
- **Closing a slice (agent):** rewrite "Last shipped" and "Next queued" in the same commit that ships the outcome doc + roadmap update. STATUS is part of the slice-close checklist; a slice is not shipped until STATUS reflects it.
- **Conflict with roadmap:** roadmap wins on phase narrative (why this phase exists, sub-phase scope summaries, decision lineage). STATUS wins on what's next.

---

## Cross-links

- [`roadmap.md`](roadmap.md) — phase narrative + sub-phase scope.
- [`reference/phases.md`](reference/phases.md) — canonical slice ID registry.
- [`agents/workflows.md`](agents/workflows.md) — slice-close checklist (this file is step 5).
- [`adr/0004-calibration-defer-b2-decision.md`](adr/0004-calibration-defer-b2-decision.md) — the deferred decision Phase 2a unblocks.
