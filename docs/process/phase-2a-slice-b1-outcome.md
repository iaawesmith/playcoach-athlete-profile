---
slice_id: PHASE-2A-SLICE-B1
title: Capture pose_world_landmarks in PoseFrame
date_shipped: null  # code-complete 2026-06-03; verification pending — see Verification §
date_code_complete: 2026-06-03
status: code-complete-verification-pending
related_risks: []
related_findings: [F-SLICE-B-1, F-CALIB-1, F-SLICE-E-2, F-SLICE-E-3, F-OPS-6]
related_adrs: [ADR-0004, ADR-0005, ADR-0009]
---

# PHASE-2A-SLICE-B1 — Capture `pose_world_landmarks` in `PoseFrame`

> **Status note (amended 2026-06-03 during Phase 2a remediation):** originally marked Shipped. Re-classified to **code-complete-verification-pending** after the user surfaced that the runtime drift-band corroboration was deferred to B2, B2 never ran it either, and per [`agents/testing-philosophy.md`](../agents/testing-philosophy.md) §4 verification is constitutive of shipping. This is the surfacing instance of [F-OPS-6](../risk-register/F-OPS-6-verification-deferral-across-slice-boundaries.md). The structural-check half of verification stands; the runtime half is captured in the operator-run script linked below.

## Goal

Extend the Cloud Run pose engine's per-frame result to capture BlazePose GHUM 3D world landmarks (meters, hip-centered) alongside the existing 2D pixel landmarks, so subsequent slices (B2 plumbing, B3 metric opt-in) have a stable in-process source for world-coordinate values. Success criterion: world landmarks are read from `PoseLandmarkerResult` on every detection, exposed on `PoseFrame`, and do not change pixel-keypoint output or perturb the post-resolver numeric distribution beyond the established F-SLICE-E-2 noise floor.

## What shipped (code)

- [`mediapipe-service/app/pose.py`](../../mediapipe-service/app/pose.py)
  - `PoseFrame` gains a `world_keypoints: list[list[float]]` field (33×3, default zero-filled), with a doc-comment citing `docs/investigations/world-landmark-feasibility-research.md` §2.1 for coordinate space and origin.
  - `PoseEngine.detect(...)` now reads `result.pose_world_landmarks` defensively (guards against missing attribute / empty list / shorter-than-33 returns) and pads/truncates to `LANDMARK_COUNT` for shape stability.
  - On a non-detection frame the field defaults to zero-filled 33×3 — same convention as the existing 2D fields.

No changes to `mediapipe-service/app/schema.py` (B2 plumbs the field through `AnalyzeResponse`). No changes to any edge function, metric definition, or athlete-facing surface.

## What didn't ship

- `AnalyzeResponse` payload extension — explicitly B2.
- Any metric switch to world coordinates — explicitly B3.

## Decisions made

**`world_keypoints` ships always-on, no gating, no request-param opt-in.** (Decision originally made in B2; moved here during 2026-06-03 remediation because it concerns the field this slice introduces, and B2 should reference back rather than restate.)

Payload cost is ~70 KB per 3 s clip, dominated by 33 landmarks × 3 floats × ~90 frames. The actual tradeoff is **bytes-on-the-wire for a field with no current consumer (B3 has not landed) versus the maintenance cost of a gating query parameter and the per-call branching that surrounds it**. 70 KB per clip is negligible against the analyze-response baseline; gating would add an opt-in surface, a serialization-conditional path, and a documentation watchpoint, all for no meaningful saving.

The 256 MB worker-memory ceiling and 5 GB request cap researched during B2 are **not the constraint that drove this decision** — they were never tight at this payload size. Recording them as the decision rationale would frame an answer to a question that was never asked. The honest constraint is the maintenance cost of conditional serialization. Revisit if a future slice materially expands per-frame payload (e.g. segmentation masks would put the memory ceiling back in play).

Cross-link: B2's outcome doc carries the supabase response-limit research (5 GB request, no documented response cap, 256 MB worker memory) as background on the transport layer; that research stands and is useful, but it is not the reason `world_keypoints` is always-on.

## Verification

### Structural check (the additive-field proof)

| Check | Method | Outcome |
|---|---|---|
| `pose_world_landmarks` is part of the existing `PoseLandmarkerResult` (no API migration required) | Cross-reference `docs/investigations/world-landmark-feasibility-research.md` §1.1, §1.3 | ✅ |
| Inference cost unchanged | Single `detect_for_video` call returns both fields from the same `PoseLandmarkerResult`; no additional model invocation added | ✅ (by inspection) |
| Shape stability on non-detection frames | `PoseFrame(detected=False)` default-factories `world_keypoints` to a 33×3 zero list | ✅ |
| Defensive against older mediapipe builds | `getattr(result, "pose_world_landmarks", None) or []` guards missing attribute | ✅ |
| 2D pixel-keypoint output unchanged | Existing `kps`/`scs` derivation, padding, and truncation untouched; field ordering in `PoseFrame` unchanged | ✅ |
| No code path reads `world_keypoints` | `rg "world_keypoints" supabase/functions/` returns zero matches; the field is captured and serialized but no consumer exists yet | ✅ |

**Structural-check conclusion:** reading an attribute off an already-computed `PoseLandmarkerResult` cannot back-propagate into the 2D landmarks, and the 2D serialization order is unchanged. This is genuinely sufficient for the additive-field claim; what it does not cover is the second-order possibility that adding the field nudged the F-SLICE-E-2 mode distribution via some non-obvious path (timing change, serializer reordering on field-count threshold, downstream consumer we forgot exists). That is what the drift-band corroboration below addresses.

### Drift-band corroboration (Option D per ADR-0005)

**Status:** pending operator run. Hash-exact is unavailable by construction here — F-SLICE-E-2's ~0.78% bimodal drift already propagates through the resolver into every distance/velocity metric, so two clean re-runs of the slant clip differ by sub-1% before this slice touches anything. Per [ADR-0005](../adr/0005-determinism-tolerance-1pct.md), the available branch is **categoricals-exact + numeric drift ≤ ±1%** with append to `determinism-drift.csv`.

**Bar (precedent-setting for additive-field, no-consumer slices in Track B until B3 lands):**

- N=10 runs at the pre-B1 commit SHA, label `baseline`.
- N=10 runs at HEAD (post-B1 + post-B2), label `postship`.
- Pass: categoricals exact across all 20 runs; post-B1 `body_based_ppy` / `selected_ppy` distribution inside the pre-B1 envelope (no mean shift > 0.1%, no variance widening > 1.5×); distance/velocity-derived fields stay inside pre-B1 ±1% band; no new hash absent from pre-B1 set.
- Halt on new hash: first diagnostic is N more baseline runs at the pre-B1 SHA — undersampling of the F-SLICE-E-2 7/1/1 mode distribution is the more likely cause than B1-induced variance. Only escalate to "B1 added variance" once baseline mode set is stable.
- Halt on mean shift or widened variance at stable mode set: real F-SLICE-B-* finding. Open it, B1/B2 stay code-complete, A3/B3 stay blocked.

**N=10 rationale:** F-SLICE-E-2's drift log records a ~7/1/1 mode distribution. N=5 risks missing minority modes (~10% mass each) and archiving a too-narrow band that false-halts future slices. N=10 is a one-time ~$0.50 Cloud Run cost against a baseline that becomes the permanent reference for every Track B slice after this one. Pay once.

**Script:** [`scripts/verification/slice2a_b1_drift_band.ts`](../../scripts/verification/slice2a_b1_drift_band.ts). See its RECIPE header for invocation, env, and the operator-driven git-checkout sequence (the script cannot self-checkout; the operator drives the SHA cycle).

**Result:** _to be filled in once operator runs the script_. Once filled, this section gets:

```
Run set: baseline (pre-B1 SHA <sha>)
  modes observed: <list of hashes + counts>
  body_based_ppy: mean=<>, stddev=<>, min=<>, max=<>
  CSV rows: <row range>

Run set: postship (post-B1+B2 HEAD <sha>)
  modes observed: <list of hashes + counts>
  body_based_ppy: mean=<>, stddev=<>, min=<>, max=<>
  CSV rows: <row range>

Outcome: <pass | halt-new-mode | halt-shift>
```

## Findings surfaced

- **[F-OPS-6](../risk-register/F-OPS-6-verification-deferral-across-slice-boundaries.md)** — surfacing instance. B1 deferred its drift-band check into B2; B2 inherited and skipped; both shipped before the check ran. Registered as a process failure mode with a new no-cross-slice-deferral rule in [`agents/workflows.md`](../agents/workflows.md).

## Cross-links

- Plan: Phase 2a kickoff + 2026-06-03 remediation conversation.
- `docs/investigations/world-landmark-feasibility-research.md` — feasibility study confirming `pose_world_landmarks` is produced for free per call.
- [ADR-0004](../adr/0004-calibration-defer-b2-decision.md) — calibration "Slice B2" decision world landmarks are a candidate remediation vector for. **Not** the same as `PHASE-2A-SLICE-B2`; see name-collision warning in `reference/phases.md`.
- [ADR-0005](../adr/0005-determinism-tolerance-1pct.md) — the Option D bar this slice must clear.
- [ADR-0009](../adr/0009-mediapipe-on-cloud-run.md) — MediaPipe on Cloud Run (the host this slice modifies).
- [`mediapipe-service/app/pose.py`](../../mediapipe-service/app/pose.py) — the file modified.
- [`scripts/verification/slice2a_b1_drift_band.ts`](../../scripts/verification/slice2a_b1_drift_band.ts) — operator-run drift-band verification.
- [`process/phase-2a-slice-b2-outcome.md`](phase-2a-slice-b2-outcome.md) — B2 (response-limit research lives there; emission-gating decision lives here).
