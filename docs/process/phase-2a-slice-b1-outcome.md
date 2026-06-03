---
slice_id: PHASE-2A-SLICE-B1
title: Capture pose_world_landmarks in PoseFrame
date_shipped: 2026-06-03
status: shipped
related_risks: []
related_findings: [F-SLICE-B-1, F-CALIB-1]
related_adrs: [ADR-0004, ADR-0009]
---

# PHASE-2A-SLICE-B1 — Capture `pose_world_landmarks` in `PoseFrame`

## Goal

Extend the Cloud Run pose engine's per-frame result to capture BlazePose GHUM 3D world landmarks (meters, hip-centered) alongside the existing 2D pixel landmarks, so subsequent slices (B2 plumbing, B3 metric opt-in) have a stable in-process source for world-coordinate values. Success criterion: world landmarks are read from `PoseLandmarkerResult` on every detection, exposed on `PoseFrame`, and do not change pixel-keypoint output or inference cost.

## What shipped

- [`mediapipe-service/app/pose.py`](../../mediapipe-service/app/pose.py)
  - `PoseFrame` gains a `world_keypoints: list[list[float]]` field (33×3, default zero-filled), with a doc-comment citing `docs/investigations/world-landmark-feasibility-research.md` §2.1 for coordinate space and origin.
  - `PoseEngine.detect(...)` now reads `result.pose_world_landmarks` defensively (guards against missing attribute / empty list / shorter-than-33 returns) and pads/truncates to `LANDMARK_COUNT` for shape stability.
  - On a non-detection frame the field defaults to zero-filled 33×3 — same convention as the existing 2D fields.

No changes to `mediapipe-service/app/schema.py` (B2 will plumb the field through `AnalyzeResponse`). No changes to `mediapipe-service/app/main.py` — the new field is captured but not yet serialized into the streaming response. No changes to any edge function, metric definition, or athlete-facing surface.

## What didn't ship

- `AnalyzeResponse` payload extension — explicitly B2. Per the user-provided constraint, B2 must design against Supabase's documented Edge Function response size limit, with the actual cited value in that slice's outcome doc.
- Any metric switch to world coordinates — explicitly B3.

## Verification

| Check | Method | Outcome |
|---|---|---|
| `pose_world_landmarks` is part of the existing `PoseLandmarkerResult` (no API migration required) | Cross-reference `docs/investigations/world-landmark-feasibility-research.md` §1.1, §1.3 | ✅ |
| Inference cost unchanged | Single `detect_for_video` call returns both fields from the same `PoseLandmarkerResult`; no additional model invocation added | ✅ (by inspection) |
| Shape stability on non-detection frames | `PoseFrame(detected=False)` default-factories `world_keypoints` to a 33×3 zero list | ✅ |
| Defensive against older mediapipe builds | `getattr(result, "pose_world_landmarks", None) or []` guards missing attribute | ✅ |
| 2D pixel-keypoint output unchanged | Existing `kps`/`scs` derivation, padding, and truncation untouched | ✅ |

End-to-end runtime verification against a live Cloud Run deploy is deferred to B2, when the field is observable in `AnalyzeResponse`. B1 in isolation is an in-process capture; the field cannot be inspected from outside the service yet.

## Findings surfaced

None.

## Decisions deferred

- **B2 payload shape and opt-in default.** Per kickoff direction, B2 must look up and cite Supabase's documented Edge Function response size limit before deciding whether `world_keypoints` ships always-on, gated by a query param, or downsampled. Not pre-decided here.
- **B3 coordinate-space opt-in surface.** Whether `coordinate_space: "pixel" | "world"` lives only on metric JSON definitions or also on the registry frontmatter — deferred to B3 kickoff.

## Cross-links

- Plan: Phase 2a kickoff (this conversation).
- `docs/investigations/world-landmark-feasibility-research.md` — feasibility study that confirmed no API migration is required and `pose_world_landmarks` is produced for free on every call.
- ADR-0004 — the B2 calibration decision world landmarks are a candidate remediation vector for.
- ADR-0009 — MediaPipe on Cloud Run (the host this slice modifies).
- `mediapipe-service/app/pose.py` — the file modified.
