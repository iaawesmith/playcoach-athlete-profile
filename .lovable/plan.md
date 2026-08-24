# Phase 2a — Athlete Lab smoke testing with the new 20-clip set

## Where we actually are

Verified against the repo just now (nothing has moved since 2026-06-03):

- `ground-truth.yaml` — **n=1** (one entry, soccer training facility). Needs n≥3 across ≥2 contexts to re-open ADR-0004.
- `determinism-drift.csv` — only the 5 historical seed rows. No `baseline`/`postship` rows, so B1/B2 are still verification-pending.
- A1 shipped (intake runbook). A2 code-complete/verification-pending. B1+B2 code-complete/verification-pending. A3, B3, C blocked.
- Repo connection intact; `docs/STATUS.md` is still the resume-here file and gets updated at every slice close.

Your new clips unblock **Track A** directly. They do not unblock B1/B2 — that still needs a pre-B1 Cloud Run revision deployed alongside HEAD.

## Answers to your three questions

**Do we run all 20 through the pipeline?** No — not for calibration. Calibration ppy is a property of camera geometry, not route variety. Twenty clips of the same static rig in the same facility give roughly one calibration data point repeated twenty times, plus 20× Cloud Run cost and 20× dimension-confusion surface. Recommendation: **3 clips for calibration intake**, then the remaining 17 become the Phase 3 metric-regression corpus once calibration is trusted.

**Which 3?** The **side-angle** clips only, from 3 different routes. Behind-the-QB angles are the wrong surface for calibration and for distance/velocity metrics generally — lateral break distance is foreshortened toward the optical axis, so a yard-line ppy measured on a behind angle doesn't transfer. Behind angles stay valuable for a different question (break timing, hip/shoulder orientation from world landmarks in B3) and get logged as such, not discarded.

**Google Drive?** Not directly into the pipeline. The Drive connector can read the folder, but the analyze pipeline reads from the private `athlete-videos` bucket, and the runbook explicitly requires the **master file** as the analysis target (the n=1 entry's dimension-confusion footnote is exactly this failure). Drive commonly serves a transcoded preview. Path: pull the 3 masters via the Drive connector, verify pixel dimensions match the source, upload to `athlete-videos/test-clips/`, then run them. I'll record source Drive file IDs and dimensions in each ground-truth entry.

## The sequence, in order

**1. Clip selection + intake prep (no pipeline cost)**
Link the Drive connector, list the folder, and pick 3 side-angle clips from 3 distinct routes. Verify each master's dimensions and that a yard-line pair is legible in the measurement frame. Halt per the A1 runbook if a chosen clip has no legible marking pair.

**2. A2 interim-bar verification — replaces the n=1 re-inspection**
Your clips are a strictly better interim bar than re-inspecting `slant-route-reference-v1.mp4`, because a football field with yard lines gives `yard_line` as a *primary* methodology rather than a scavenged secondary one. On clip 1, run `calibration_estimate_ppy.ts` twice — `yard_line` (yard-line pair) and `bbox_cross_check` (athlete height). Convergence within the documented ±5% envelope clears A2's **interim bar** and flips A2 to Shipped.

The A2 doc's three named obligation fields stay as written: the **full bar** (3-methodology convergence) and the **surviving ADR-0005 obligation** (cross-clip determinism, ±1%, n≥3 across ≥2 contexts) both remain owed. I will not quietly fold them into this.

**3. Track A intake ×3**
Run each of the 3 clips through the A1 runbook end to end: upload against the published slant-route node, confirm the `calibration_audit` row is written (F-OPS-5 pre-flight, F-CALIB-1 — read the audit row, never top-level shadow values), estimate ppy per methodology, append entries verbatim per `_schema.md`.

Result: **n=4 across 2 filming contexts** (soccer facility + indoor football field). Both ADR-0004 thresholds satisfied.

**4. `PHASE-2A-SLICE-A3` — threshold gate**
Write `scripts/verification/calibration_dataset_threshold.ts`: reads `ground-truth.yaml`, applies `min_entries_for_b2_decision` and `min_filming_contexts_for_b2_decision`, exits non-zero when unmet. Running it green is what formally makes ADR-0004 eligible for re-open. A3 is currently blocked on B1/B2 drift-band corroboration (cross-track dependency), so step 5 has to land first — or you explicitly waive the dependency, which I'd rather you decide than assume.

**5. Unblock B1/B2 (your side, parallel — start now)**
Needs infrastructure moves I can't make from the sandbox: check out pre-B1 SHA **`2bcff8e`**, deploy `mediapipe-service` at that SHA as a parallel Cloud Run revision, keep HEAD (`7e4b403`) live too. Once both revision URLs exist, run baseline×10 and postship×10 against the canonical slant clip, append to `determinism-drift.csv`, hand me the finished CSV. I run `--check`. On exit 0: B1+B2 flip to Shipped, A3 and B3 unblock. On halt: first diagnostic is N more baseline runs at `2bcff8e` (mode undersampling), not a B1 investigation — per the ratified decision matrix.

**6. Phase 3 corpus registration (cheap, no runs)**
Register the remaining 17 clips as the metric-regression corpus: route, angle, Drive file ID. No analysis runs. This is what makes the 20-clip set pay off after calibration is trusted, instead of burning it now.

## Technical notes

- Nothing in this plan touches athlete-facing tables or ships athlete-facing UI. No schema changes proposed.
- No new database tables. Ground truth stays in `ground-truth.yaml` (append-only, git-tracked) — that's deliberate per ADR-0013.
- Every slice closes with outcome doc + `roadmap.md` + `docs/STATUS.md` in the same commit, per the workflows checklist. F-OPS-6 applies: if a slice's verification can't run in-slice, the slice halts rather than deferring.
- Clip selection and dimension verification happen before any upload, so no Cloud Run spend on a clip that can't anchor a methodology.

## Open decision for you

**A3 ordering.** A3 is formally blocked on the B1/B2 drift band. Steps 1–3 are independent and can run immediately either way. Do you want A3 to wait for the drift band to clear (strict, preserves the registered dependency), or should I treat the Track A threshold gate as independent of Track B and unblock it once n=4 lands? Strict is my default.
