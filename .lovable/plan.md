# PHASE-2-PREP-RESEARCH — World-Landmark Feasibility Study

## Confirmed grounding (pre-execution sweep)

The Cloud Run `mediapipe-service` uses the **modern MediaPipe Tasks API**:
- Import: `from mediapipe.tasks.python import vision as mp_vision` (`mediapipe-service/app/pose.py:21-22`)
- Construction: `mp_vision.PoseLandmarker.create_from_options(...)` (`pose.py:46`)
- Package: `mediapipe==0.10.18` (`mediapipe-service/requirements.txt:3`)
- Model assets: `pose_landmarker_full.task` / `pose_landmarker_lite.task` (`Dockerfile:23-27`)
- Result consumption: only `result.pose_landmarks` is read (2D normalized → pixel-scaled). `result.pose_world_landmarks` is **available on the same result object but never accessed** (`pose.py:91-99` referenced in capability inventory §1.2).

This is the path Capability Inventory §1.2 row "World landmarks" earmarked for Phase 2+. The legacy `mp.solutions.pose` API is **not** in use anywhere in the repo.

## Deliverable

A single research document: `docs/investigations/world-landmark-feasibility-research.md`

Read-only research slice. No code, schema, or config changes. No migrations.

## Document structure

### Section 1 — API path inventory (both paths, for completeness)
- **1.1 Tasks API (current path)**: `PoseLandmarker` returns `PoseLandmarkerResult` with both `pose_landmarks` (normalized 2D + visibility/presence) and `pose_world_landmarks` (3D meters, hip-centered). Same detection call produces both; consuming world landmarks requires only reading the additional field — no second inference, no model swap, no API migration.
- **1.2 Legacy Solutions API (NOT in use)**: `mp.solutions.pose.Pose` returns `pose_world_landmarks` similarly. Documented for completeness only; no code path in this repo uses it.
- **Verdict surfaced upfront**: current API path is sufficient. Migration is not required.

### Section 2 — Accuracy analysis (covers both paths per request)
- **2.1 Coordinate space and origin**: world landmarks are in meters, origin at the midpoint of the hips. Z axis depth derived from BlazePose GHUM regression head.
- **2.2 Accuracy characteristics**:
  - Lite vs Full vs Heavy model trade-offs for world-landmark depth quality
  - Known weaknesses: Z accuracy degrades at frame edges, with occlusion, and for limbs extended toward/away from camera (relevant to release-mechanics and 40-yd framing)
  - Tasks API vs Solutions API: regression head is the same GHUM model; differences are marginal and stem from preprocessing pipeline (Tasks API uses standardized ROI cropping). Note both paths for completeness; recommendation does not depend on this distinction.
- **2.3 Comparison vs current ppy-calibrated 2D distance metrics**:
  - F-SLICE-B-1 baseline: 2-6% distance error on static calibration
  - Expected world-landmark error envelope for distance/velocity metrics in our framing conditions (single-camera, athlete roughly centered, 1-3s clips)
  - Where world landmarks would improve correctness vs where they would not (e.g., depth-axis motion benefits; lateral-only motion may not justify the change)

### Section 3 — Integration cost analysis (Tasks API path, since it's current)
- **3.1 Service-side change surface**: extend `PoseFrame` dataclass with optional `world_keypoints` field; read `result.pose_world_landmarks` alongside `result.pose_landmarks` in `pose.py` detect loop. No new dependency, no model download, no Dockerfile change.
- **3.2 Schema surface**: response payload from `/analyze` grows by ~33 × 3 floats per frame. Estimate impact on response size and edge-function deserialization.
- **3.3 Edge-function consumption**: which downstream metrics in `analyze-athlete-video/index.ts` could opt-in to world-landmark-derived distance/velocity instead of ppy-calibrated 2D. Per-metric opt-in path (capability inventory §2 row 9) keeps blast radius small.
- **3.4 Calibration pipeline interaction**: world landmarks bypass the entire ppy calibration chain for any metric that opts in. Document interaction with F-CALIB-1 (shadow values) and F-SLICE-B-1 (static calibration error) — world-landmark adoption is a candidate remediation path for both.
- **3.5 Determinism**: world-landmark regression head determinism characteristics vs F-SLICE-E-2 (~0.78% drift on body-based ppy). Likely orthogonal but document expected behavior.

### Section 4 — Recommendation chain
- **4.1 Top recommendation**: per-metric opt-in to world landmarks for distance/velocity-class metrics, starting with one pilot metric on the slant-route reference clip. **No API migration required** — current Tasks API path supports this directly. Cost is bounded to: one optional field on `PoseFrame`, one additional read in `detect()`, one edge-function consumer per opted-in metric.
- **4.2 Explicit non-migration note**: Per founder request, the recommendation does NOT require migrating from Tasks API to anything else. The Tasks API already exposes `pose_world_landmarks` on every detection result; we are simply reading a field we currently discard. Founders should not infer migration from this recommendation.
- **4.3 Sequencing**: pilot metric → measurement vs ground truth → expand to second metric → consider as primary path for distance/velocity metrics class. Each step is its own slice; this research does not commit to any.
- **4.4 Risk-register cross-links**: candidate Phase-2 remediation vector for F-SLICE-B-1, F-CALIB-1; orthogonal to F-SLICE-E-2.
- **4.5 What this research does NOT recommend**: model variant change, confidence threshold change, segmentation mask, LIVE_STREAM mode, multi-pose. All remain in the "hold" disposition per Capability Inventory §2.

### Section 5 — Open questions for Phase 2 planning
- Which pilot metric? (release_speed candidate; cross-link F-SLICE-B1-2)
- Ground-truth comparison methodology — extend existing calibration ground-truth dataset or build new?
- Telemetry: how to record world-landmark-derived value alongside ppy-derived value for A/B comparison without committing to either as canonical (mirrors `calibration_audit` shadow-value pattern but with explicit governance to avoid F-CALIB-1 recurrence)

## Sources to consult during execution

- MediaPipe Tasks Pose Landmarker official docs (Python guide, result schema, world-landmark section)
- BlazePose GHUM paper / model card for accuracy envelope
- `mediapipe==0.10.18` release notes / source for any API caveats at this pin
- Existing repo references: capability inventory §1.2/§2 row 9, ADR-0009, F-SLICE-B-1, F-CALIB-1, F-SLICE-E-2

## Out of scope for this slice

- Any code change, including the trivial `PoseFrame` extension
- Any schema change to Cloud Run response or edge-function consumption
- Any pilot run on real video
- Phase 2a planning itself (this research feeds into it)
- Recommendations on confidence thresholds, model variant, auto-zoom, or any other capability inventory row

## Files created

- `docs/investigations/world-landmark-feasibility-research.md`

## Surface deliverable on completion

- Path to research doc
- Section 4.1 recommendation summary (one paragraph)
- Section 4.2 non-migration assertion (verbatim, for founder)
- List of risk-register findings cross-referenced
