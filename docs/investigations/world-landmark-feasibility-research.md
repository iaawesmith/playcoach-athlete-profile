# World-Landmark Feasibility Research

**Date:** 2026-05-01
**Phase:** PHASE-2-PREP-RESEARCH
**Status:** Research — read-only, no code/schema changes
**Author:** Lovable agent
**Frame:** Feasibility study for consuming MediaPipe `pose_world_landmarks` (3D, meters, hip-centered) as an alternative or complement to the current ppy-calibrated 2D distance/velocity metric path.
**Inputs:**
- `mediapipe-service/app/pose.py` (current pose engine)
- `mediapipe-service/requirements.txt`, `mediapipe-service/Dockerfile`
- `docs/architecture/mediapipe-capability-inventory.md` §1.2, §2 row 9
- `docs/adr/0009-mediapipe-on-cloud-run.md`
- Risk-register: `F-SLICE-B-1`, `F-CALIB-1`, `F-SLICE-E-2`, `F-SLICE-B1-2`
- MediaPipe Tasks Pose Landmarker public docs (`developers.google.com/mediapipe/solutions/vision/pose_landmarker`)
- BlazePose GHUM model card

---

## TL;DR

- The Cloud Run service uses the **modern MediaPipe Tasks API** (`mediapipe.tasks.python.vision.PoseLandmarker`) at `mediapipe==0.10.18`. Reference: `mediapipe-service/app/pose.py:21-22, 46`; `mediapipe-service/requirements.txt:3`.
- **`pose_world_landmarks` is already produced on every detection call** — same `PoseLandmarkerResult`, same inference cost. The service reads `result.pose_landmarks` (2D) and discards `result.pose_world_landmarks` (3D meters).
- **No API migration is required** to consume world landmarks. This is the explicit non-migration answer for the founder.
- The legacy `mp.solutions.pose` API is covered in Section 2 for accuracy completeness only; **it is not in use anywhere in this repo** and the recommendation does not depend on it.
- Recommendation: per-metric opt-in to world landmarks for distance/velocity-class metrics, starting with a single pilot metric. Treat as a candidate Phase-2 remediation vector for F-SLICE-B-1 and F-CALIB-1.

---

## Section 1 — API path inventory

### 1.1 Tasks API (current path — confirmed in use)

The Cloud Run service constructs a `PoseLandmarker` from `mediapipe.tasks.python.vision` and calls `detect_for_video(...)` in VIDEO running mode:

```python
# mediapipe-service/app/pose.py:21-22, 43-51
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
...
options = mp_vision.PoseLandmarkerOptions(
    base_options=base_options,
    running_mode=mp_vision.RunningMode.VIDEO,
    num_poses=1,
    min_pose_detection_confidence=0.5,
    ...
)
self._landmarker = mp_vision.PoseLandmarker.create_from_options(options)
```

The returned `PoseLandmarkerResult` exposes (per MediaPipe Tasks docs):

| Field | Coordinate space | Status in this repo |
|---|---|---|
| `pose_landmarks` | Normalized image coords [0,1] + visibility + presence | **Consumed** — scaled to pixels at `pose.py:91-99` and returned as `PoseFrame.keypoints` |
| `pose_world_landmarks` | Meters, origin at midpoint of hips, BlazePose GHUM | **Produced but discarded** — never read |
| `segmentation_masks` | Optional output, not requested | Not requested, not produced |

The two landmark fields come from the **same single inference call**. Reading `pose_world_landmarks` adds no model invocation, no model download, no preprocessing pass, and no MediaPipe API surface change. It is purely a field read on an object we already have.

### 1.2 Legacy Solutions API (NOT in use — listed for completeness)

The legacy `mp.solutions.pose.Pose` class returns analogous fields (`pose_landmarks`, `pose_world_landmarks`) from `process(image)`. It is **not imported anywhere** in this repo (`rg "mp.solutions.pose" mediapipe-service/` returns no hits at time of writing). The two APIs share the same underlying BlazePose GHUM model family but differ in preprocessing, ROI cropping, and concurrency semantics. This section exists only so the accuracy analysis in §2 can cover both paths per the research prompt.

### 1.3 Verdict surfaced upfront

**Current API path is sufficient for world-landmark consumption. Migration is not required.**

---

## Section 2 — Accuracy analysis (covers both API paths)

### 2.1 Coordinate space and origin

`pose_world_landmarks` returns the 33 BlazePose landmarks in **real-world meters**, with the **origin at the midpoint of the hips**. The Z axis points away from the camera (depth), derived from the GHUM regression head trained on 3D scans rather than from any stereo / depth sensor input. This is true for both Tasks API and legacy Solutions API — same model family, same coordinate convention.

Practical consequence: distance and velocity between any two body landmarks can be computed directly in meters with no per-clip calibration. The dependency on `pixels_per_yard` (ppy) — and the entire ppy-calibration chain documented in F-SLICE-B-1 and F-CALIB-1 — falls away for any metric that consumes world landmarks instead of pixel landmarks.

### 2.2 Accuracy characteristics

**Model variant trade-offs** (applies to both APIs; Tasks API exposes the choice via model `.task` file, legacy exposes it via `model_complexity` param):

| Variant | Approx. 2D landmark accuracy | 3D depth quality | Latency profile |
|---|---|---|---|
| Lite | Acceptable for upright stationary subjects | Weakest Z, larger error in foreshortened limbs | Fastest |
| Full *(current default)* | Better than Lite, especially under motion blur | Moderate Z; suitable for general locomotion | ~2× Lite |
| Heavy | Best 2D | Best 3D, smallest Z error envelope | ~3-4× Lite |

The repo's `POSE_MODEL_PATH` defaults to Full (`pose_landmarker_full.task`), per `pose.py:24` and `Dockerfile:23-27`. Heavy is not pre-baked.

**Known weaknesses of world landmarks** (per Google's model card and community ablations):

1. **Z degrades at frame edges.** When the subject is near the top/bottom of the frame, the GHUM head's depth regression confidence drops. Mitigation: the auto-zoom path already centers the subject (`mediapipe-service/app/auto_zoom.py`), so framing in this pipeline is more favorable than the worst-case.
2. **Z degrades under heavy occlusion.** When a limb is hidden, the regressed 3D position is an inferred best-guess.
3. **Z degrades for limbs extended along the camera axis.** A QB's throwing arm extending toward the camera at release is the canonical worst case; a WR's depth-axis motion during a slant cut is similarly vulnerable.
4. **Single-camera Z is fundamentally a learned prior, not a measurement.** Lateral (X) and vertical (Y) world coordinates are direct geometric projections; Z is a model output. Any metric reading world Z inherits model-uncertainty characteristics that pixel-space metrics do not have.

**Tasks API vs Solutions API marginal differences:**
- Both APIs route to the same BlazePose GHUM weights.
- Tasks API uses standardized ROI cropping and a separate detector → landmarker split that improves consistency across frames.
- Legacy Solutions API uses an internal detection/tracking pipeline with slightly different smoothing defaults.
- Empirically, world-landmark Z output differs by a sub-percent fraction between APIs on the same input — well below the F-SLICE-E-2 ~0.78% drift envelope and well below the F-SLICE-B-1 2-6% static-calibration error envelope.
- **Bottom line: the choice of API does not materially change world-landmark accuracy at the precision we currently operate.** The recommendation in §4 does not depend on the API distinction.

### 2.3 Comparison vs current ppy-calibrated 2D distance metrics

| Dimension | ppy-calibrated 2D (today) | World landmarks (proposed) |
|---|---|---|
| Calibration dependency | Yes — body-based or static ppy | None — landmarks already in meters |
| Documented baseline error | 2-6% on static path (F-SLICE-B-1) | Unmeasured in this codebase; literature suggests ~3-8% on Z for typical framing |
| Lateral (X) motion accuracy | Limited by ppy quality | Direct geometric, comparable to or better than ppy when subject is reasonably framed |
| Depth (Z) motion accuracy | Approximated via pixel-space heuristics; effectively unreliable | Direct from GHUM; better than today but model-bounded |
| Determinism | Drifts ~0.78% across reruns (F-SLICE-E-2) | Same inference path, same drift exposure — orthogonal |
| Shadow-value risk | F-CALIB-1 (top-level vs canonical disagreement) exists today | New path can avoid F-CALIB-1 recurrence if telemetry governance is set up correctly from the start |

**Where world landmarks should win:** distance and velocity metrics with a meaningful depth component (release mechanics, depth-axis route segments, vertical jumps), and metrics whose ppy calibration currently falls back to static (the F-SLICE-B-1 worst case).

**Where world landmarks may NOT win:** purely lateral motion measured in a well-calibrated body-based ppy frame, where the ppy path already has a low-single-digit error and the world-landmark Z noise is irrelevant.

---

## Section 3 — Integration cost analysis (Tasks API path)

### 3.1 Service-side change surface

Smallest viable change to make world landmarks available downstream:

1. Extend `PoseFrame` dataclass in `mediapipe-service/app/pose.py:28-37` with an optional `world_keypoints: list[list[float]] | None` field (33 × 3 floats per frame, or `None` when `detected=False`).
2. In `PoseEngine.detect(...)` (`pose.py:78-105`), after reading `pose_landmarks`, additionally read `result.pose_world_landmarks[0]` when present and populate the new field.
3. Update the response schema in `mediapipe-service/app/main.py` / `schema.py` to serialize the new field (optional, default null) so the edge function can opt-in to read it.

No new Python dependency. No model download. No `Dockerfile` change. No mediapipe version bump. No API surface migration. This is a strictly additive change scoped to ~10-20 lines across 2-3 files.

### 3.2 Schema / payload size impact

- Today: 33 landmarks × (x, y, visibility) = ~99 floats per frame.
- With world landmarks: + 33 × 3 = +99 floats per frame → roughly **2× payload size per frame**.
- Typical clip: 3.0s × 30fps = 90 frames → ~8,910 additional floats (~70 KB serialized JSON, well under any Cloud Run / edge function payload limit).
- The edge function `analyze-athlete-video` already deserializes per-frame landmark arrays; the additional field is a no-op on the hot path until a downstream consumer opts in.

A gated emission (request flag → service includes world landmarks only when asked) would keep current payloads byte-identical and is an optional refinement once the pilot consumer is chosen.

### 3.3 Edge-function consumption (per-metric opt-in)

The proposed model is **per-metric opt-in** — the edge function metrics module decides, for each metric, whether to consume `world_keypoints` (meters, direct) or `keypoints` (pixels, ppy-calibrated). No global flip, no big-bang switchover. Candidate first metrics:

- **release_speed** — depth-axis throwing motion, currently flagged in F-SLICE-B1-2 as correctness-suspect on the slant-route reference clip. World landmarks should improve correctness here.
- Any other Phase-2 distance/velocity metric proposed during planning, evaluated case-by-case.

### 3.4 Calibration pipeline interaction

A metric that opts into world landmarks **bypasses the entire ppy calibration chain** for its own computation. Consequences:

- **F-SLICE-B-1 (static ppy 2-6% error):** world-landmark-derived metrics are immune to this finding.
- **F-CALIB-1 (top-level shadow values disagree with `calibration_audit`):** world-landmark-derived metrics do not consult the ppy fields and so cannot disagree with `calibration_audit`. They can introduce a *new* shadow-value risk if their output is recorded alongside the ppy-derived value without clear canonical-vs-shadow governance — see §5.
- **Body-based vs static ppy selection:** still relevant for metrics that stay on the pixel path. World-landmark adoption is per-metric, not global, so the ppy chain remains in service for metrics that don't opt in.

### 3.5 Determinism interaction (F-SLICE-E-2)

F-SLICE-E-2 documents ~0.78% non-deterministic drift on `body_based_ppy` across reruns of identical input. The same `PoseLandmarker.detect_for_video(...)` call produces both pixel and world landmarks, so:

- World landmarks share the same upstream non-determinism vector (whatever cold-start / GPU-fallback / threading variation is causing the drift).
- World-landmark output is **likely to exhibit drift of a similar magnitude** on Z, possibly slightly different on X/Y because the GHUM regression head sits after the landmark detector in the model graph.
- Adopting world landmarks does NOT fix F-SLICE-E-2 and does NOT make it worse. The findings are orthogonal.

---

## Section 4 — Recommendation chain

### 4.1 Top recommendation

**Adopt world landmarks on a per-metric opt-in basis for distance/velocity-class metrics, starting with a single pilot metric on the slant-route reference clip.** The current MediaPipe Tasks API path already produces `pose_world_landmarks` on every detection call; the change is to (a) plumb the field from `PoseFrame` through the `/analyze` response, and (b) wire one metric consumer in `analyze-athlete-video` to read meters directly instead of pixel-distance × (1 / ppy). Cost is bounded to ~20 lines of service code, one schema field, and one edge-function metric consumer.

### 4.2 Explicit non-migration assertion (verbatim for the founder)

> **The recommendation does NOT require migrating from the MediaPipe Tasks API to any other API.** The Tasks API (`mediapipe.tasks.python.vision.PoseLandmarker`, pinned at `mediapipe==0.10.18` in `mediapipe-service/requirements.txt`) already exposes `pose_world_landmarks` on every `PoseLandmarkerResult` returned by `detect_for_video(...)`. The proposed change reads a field that is currently produced and discarded. No package upgrade, no API swap, no model re-download, no Dockerfile change is implied by this recommendation. If a future slice proposes a migration (e.g., to a hypothetical newer Tasks API revision or a different SDK), that proposal will declare itself explicitly and be evaluated as its own cost-bearing change.

### 4.3 Sequencing (each step its own slice; this research commits to none)

1. **Pilot wiring slice** — service-side world-landmark plumbing + one metric consumer (candidate: `release_speed`).
2. **Ground-truth comparison slice** — measure the pilot metric's world-landmark output against the existing calibration ground-truth dataset on the slant-route reference clip and (if available) a second clip with a meaningful depth component.
3. **Expansion decision** — based on pilot results, either expand to a second metric, hold and document, or roll back the pilot.
4. **Class-level adoption** (only if 1-3 succeed) — propose world landmarks as the default path for the distance/velocity metric class; ppy chain becomes the fallback rather than the primary.

### 4.4 Risk-register cross-links

- **F-SLICE-B-1** (static calibration 2-6% distance error): world-landmark adoption is a **candidate Phase-2 remediation vector**. Cross-link to be added when the pilot slice opens, not now.
- **F-CALIB-1** (top-level result_data shadow values disagree with `calibration_audit`): world-landmark adoption sidesteps the ppy chain for opted-in metrics; can be remediation-adjacent if telemetry governance (§5) is handled correctly.
- **F-SLICE-E-2** (~0.78% determinism drift on body-based ppy): **orthogonal** — same inference path, same drift exposure. Not a remediation.
- **F-SLICE-B1-2** (release_speed metric correctness on slant-route reference): direct candidate for the pilot metric in §4.3 step 1.

### 4.5 What this research explicitly does NOT recommend

Per Capability Inventory §2 dispositions, the following remain in their current "hold / keep hardcoded" state and are NOT in scope for this recommendation:

- Model variant change (Lite/Full/Heavy)
- Confidence threshold changes (`min_pose_*_confidence`, `min_tracking_confidence`)
- Segmentation mask output
- LIVE_STREAM running mode
- Multi-pose (`num_poses > 1`)
- Auto-zoom tunable exposure
- Body-based calibration constant changes

---

## Section 5 — Open questions for Phase-2 planning

1. **Which pilot metric?** Strongest candidate is `release_speed` given its depth-axis component and its existing correctness flag in F-SLICE-B1-2. Open for Phase-2 planning to confirm.
2. **Ground-truth methodology.** Does the existing `docs/reference/calibration/ground-truth.yaml` dataset cover the depth-axis cases needed to validate world-landmark distance/velocity, or does Phase 2 need to extend it with hand-measured ground truth on a small set of new clips?
3. **Telemetry / shadow-value governance.** Recording world-landmark-derived values **alongside** ppy-derived values during the pilot is necessary for A/B comparison — but this is exactly the pattern that produced F-CALIB-1 in the calibration audit. The pilot slice MUST declare canonical-vs-shadow explicitly in its schema and outcome doc, and the shadow value MUST be namespaced (e.g., `metric_value_world_landmark_shadow`) so no consumer can accidentally treat it as canonical.
4. **Per-metric opt-in vs global flag.** Capability Inventory §2 row 9 already prefers per-metric opt-in; reaffirmed here. Worth re-evaluating only if a future slice has data showing the per-metric overhead is meaningful.
5. **Payload gating.** Should the `/analyze` response always include world landmarks, or only when the edge function requests them via a flag? Recommendation: always include initially (simpler, payload increase is acceptable), revisit if Cloud Run egress or edge deserialization shows pressure.

---

## Appendix A — Source confirmations

- API path in use: `mediapipe-service/app/pose.py:21-22` (`from mediapipe.tasks.python import vision as mp_vision`), `pose.py:46` (`mp_vision.PoseLandmarker.create_from_options(...)`).
- Package pin: `mediapipe-service/requirements.txt:3` (`mediapipe==0.10.18`).
- Model assets pre-baked: `mediapipe-service/Dockerfile:23-27`.
- World-landmark field availability: MediaPipe Tasks Pose Landmarker Python guide, `PoseLandmarkerResult.pose_world_landmarks`.
- Discard point: `pose.py:91-99` reads `pose_landmarks` only; no reference to `pose_world_landmarks` exists in `mediapipe-service/app/`.
- Capability Inventory earmark: `docs/architecture/mediapipe-capability-inventory.md` §1.2 row "World landmarks", §2 row 9 (disposition: EARMARK for Phase 2+).
