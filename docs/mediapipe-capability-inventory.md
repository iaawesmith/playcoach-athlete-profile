# MediaPipe Capability Inventory

**Date:** 2026-04-25
**Phase:** 1c.0 — Foundation
**Sequence:** Document 1 of 3 (Capability Inventory → End-State Architecture → Risk Register)
**Frame:** Source-of-truth audit of what MediaPipe Pose Landmarker can do, what we expose to admins, and where the two have drifted apart.
**Inputs:** `docs/athlete-lab-architecture-audit.md` (parts 1+2), `mediapipe-service/app/{pose,calibration,auto_zoom,video,main,schema}.py`, `supabase/functions/analyze-athlete-video/index.ts`, `src/features/athlete-lab/types.ts`, training-status MediaPipe trace findings (incorporated in §1.3 since not saved to disk).

Tagging convention:
- **REAL** — MediaPipe honors this; pipeline behavior changes when the value changes
- **THEATER** — accepted by the request shape, logged, or read into context but ignored downstream
- **HARDCODED-EXPOSABLE** — MediaPipe exposes a knob that we hardcode in `pose.py`; could be admin-configurable
- **AVAILABLE-UNUSED** — capability exists in the MediaPipe SDK but the pipeline doesn't use it at all

---

## §1 — Field-by-field inventory

### 1.1 Currently-used capabilities (REAL)

These are the only knobs where changing the admin field demonstrably changes pipeline behavior.

| Admin field | DB column | Where consumed | What it does |
|---|---|---|---|
| Detection frequency (resolved) | `det_frequency` (+ `_solo`/`_defender`/`_multiple` overrides) | edge: `analyze-athlete-video/index.ts:1111-1141` resolves a single int from scenario. Service: `pose.py:run_with_skip` runs detector every Nth frame and forward-fills. | Real frame-skip throttle. Trades latency vs. temporal resolution. |
| Video URL + clip window | `athlete_uploads.video_url`, `start_seconds`, `end_seconds` | `video.download_to_tmp` → `video.decode_window` (`mediapipe-service/app/video.py:21,48`) | Defines the only window MediaPipe sees. Hard-capped at 3.0s by `MAX_WINDOW_SECONDS` in `main.py:28`. |
| Decoded fps | (not admin-set) `TARGET_FPS=30` in `video.py:14` | Drives timestamp interval and `det_frequency` denominator | Real, but not configurable. |
| Reference calibrations (per-camera ppy) | `reference_calibrations[]` | edge `index.ts:742, 1170` — used as static fallback when body-based fails | Real fallback path; rarely drives metrics post body-based fix (per architecture audit Tab 8). |
| Reference fallback behavior | `reference_fallback_behavior` | edge `index.ts:742` — `'pixel_warning'` vs `'disable_distance'` | Real switch over distance-metric handling when calibration is missing. |
| Scoring config | `confidence_handling`, `min_metrics_threshold`, `scoring_renormalize_on_skip` | edge `index.ts:3043-3057` | Real downstream of MediaPipe — controls metric aggregation, not pose detection. |
| LLM prompt + system + max words | `llm_prompt_template`, `llm_system_instructions`, `llm_max_words` | edge `index.ts:3231-3269` | Real for Claude (note: system-param substitution bug already documented). |

Everything else marked REAL elsewhere in the architecture audit (key_metrics, phase_breakdown, common_errors, score_bands) operates on the keypoint stream **after** MediaPipe — they don't change what MediaPipe does, they interpret its output.

### 1.2 Available-but-unused MediaPipe capabilities

Capabilities exposed by `mp_vision.PoseLandmarkerOptions` or by the Tasks SDK that the admin can never reach today.

| Capability | Where it would live | Status |
|---|---|---|
| `min_pose_detection_confidence` | hardcoded `0.5` in `pose.py:39` | **HARDCODED-EXPOSABLE** |
| `min_pose_presence_confidence` | hardcoded `0.5` in `pose.py:40` | **HARDCODED-EXPOSABLE** |
| `min_tracking_confidence` | hardcoded `0.5` in `pose.py:41` | **HARDCODED-EXPOSABLE** |
| `num_poses` | hardcoded `1` in `pose.py:38` | **HARDCODED-EXPOSABLE** — multi-person detection structurally impossible while this is 1. |
| Pose Landmarker model variant (Lite / Full / Heavy) | `POSE_MODEL_PATH` env in `pose.py:24`; defaults to Full | **HARDCODED-EXPOSABLE** — env-only, no admin or per-node selection |
| World landmarks (3D meters) | Not requested. `pose_world_landmarks` is on the result but `detect()` reads only 2D `pose_landmarks` (`pose.py:91-99`) | **AVAILABLE-UNUSED** — eliminates ppy calibration for distance/velocity metrics |
| Segmentation mask | `output_segmentation_masks=False` (default) | **AVAILABLE-UNUSED** — not needed for v1 |
| Visibility vs. presence | Only `visibility` is mapped to `scores` (`pose.py:96`); `presence` discarded | **AVAILABLE-UNUSED** — could harden confidence gating |
| LIVE_STREAM running mode | Forced to `VIDEO` (`pose.py:35`) | **AVAILABLE-UNUSED** — would enable true streaming, not relevant for batch clips |
| Auto-zoom tunables (`SAMPLE_COUNT`, `FILL_THRESHOLD`, `TARGET_FILL`, `MAX_FACTOR`, `POST_PROBE_MIN_FACTOR`) | `auto_zoom.py:34-43`; only `AUTOZOOM_SAMPLE_COUNT` env-overridable | **HARDCODED-EXPOSABLE** — could be admin-tuned per node |
| Body-based calibration constants (`SHOULDER_YARDS=0.45`, `HIP_YARDS=0.32`, `MIN_VISIBILITY=0.7`) | `calibration.py:14-16` | **HARDCODED-EXPOSABLE** — could be position-aware (WR vs OL anthropometry differ) |
| Movement direction | hardcoded `"stationary"` in `main.py:185` (motion.py removed) | **AVAILABLE-UNUSED** — direction-aware metrics in `key_metrics` rely on admin-supplied context, not detected motion |

### 1.3 Theater fields (accepted, ignored)

These are sent to Cloud Run or written to DB but produce **no** observable change in MediaPipe behavior. Findings here incorporate the in-flight training-status MediaPipe trace per your instructions.

| Field | DB column | Sent to service? | What service does with it | Verdict |
|---|---|---|---|---|
| Solution class | `solution_class` | Yes — `index.ts:656`, schema `schema.py:15` | Schema-validated then dropped. Logged only in `main.py:71` | **THEATER** — MMPose-era solver selector; MediaPipe has one solver |
| Performance mode | `performance_mode` (`performance`/`balanced`/`lightweight`) | Yes — `index.ts:657`, `schema.py:16` | Echoed in log line, not consumed | **THEATER** — would map to model-variant selection, but `POSE_MODEL_PATH` is env-only |
| Tracking enabled | `tracking_enabled` | Yes — `index.ts:659`, `schema.py:18` | Echoed in log line | **THEATER** — VIDEO running mode + `num_poses=1` already implies tracking; toggling has no effect |
| `det_frequency_defender` / `_multiple` | columns | Resolved by `index.ts:1111,1116` | Selects which scenario value becomes `det_frequency` | **REAL via resolution, but practically THEATER for multi-person** because `num_poses=1` makes "defender" and "multiple" scenarios meaningless — only one person is ever returned |
| Segmentation method | `segmentation_method` (`proportional`/`checkpoint`) | Edge-only; not in Cloud Run schema | Drives phase-window math in `index.ts` | **REAL for phases, THEATER for MediaPipe** — listed here only because admins often confuse it with pose segmentation |
| Reference object specs | `reference_object`, `reference_object_name`, `known_size_yards` etc. | Edge-only fallback metadata | Used only when static-ppy path runs | **MOSTLY THEATER post body-based fix** — see audit Tab 8 |
| Athlete wingspan (context) | `analysis_context.wingspan_inches` | Edge-only | Never read by any consumer per Lovable trace cited in audit Pattern 2 | **THEATER (athlete-side)** |
| Skill-specific filming notes | inside `camera_guidelines` JSON | Athlete-facing string | Never reaches MediaPipe or Claude | **THEATER for pipeline; product surface for athlete UI (earmark)** |

### 1.4 Hardcoded but should-be-exposed (subset of §1.2 promoted to admin)

The strongest candidates for being exposed to admins in a future phase, ranked by expected value-per-complexity:

1. **Pose Landmarker model variant** (Lite/Full/Heavy) — already env-overridable. One Cloud Run knob; large quality/latency tradeoff. (⭐ highest leverage)
2. **`min_pose_detection_confidence`** — direct admin-meaningful gate; aligns with how admins already think about "confidence handling."
3. **`min_tracking_confidence`** — relevant when athletes leave/re-enter frame.
4. **Body-based calibration anthropometric constants per position** — WR shoulder ≠ OL shoulder; today everyone is treated as a 6′ generic athlete.
5. **Auto-zoom `FILL_THRESHOLD` / `TARGET_FILL`** — would let nodes that frame tight (e.g., release mechanics) skip zoom, and nodes that frame wide (e.g., 40-yd) zoom more aggressively.
6. **World-landmark mode** (per-metric opt-in) — eliminates calibration for distance/velocity metrics. Requires schema change but unlocks Phase 3+ correctness.

Anything not in this top-6 should stay hardcoded; admin-exposing it would just expand the "configuration overflow" pattern documented in audit §Pattern 4.

---

## §2 — Capability Decision Matrix

For each MediaPipe capability, the disposition for end-state architecture (Document 2 will materialize migrations).

| # | Capability | Today | End-state disposition | Rationale |
|---|---|---|---|---|
| 1 | `det_frequency` (resolved) | REAL, scenario-driven | **KEEP, simplify** | Real knob. Collapse `_solo/_defender/_multiple` into one value once `num_poses=1` is acknowledged as permanent. |
| 2 | `det_frequency_defender`, `det_frequency_multiple` | REAL via resolution, THEATER for behavior | **DEPRECATE** | Multi-person impossible with `num_poses=1`; scenarios collapse to "solo." |
| 3 | `solution_class` | THEATER | **DEPRECATE (hard delete in 1c.2)** | MMPose-era solver picker. Single field per node, easy to back up. |
| 4 | `performance_mode` | THEATER | **DEPRECATE** | Replace with future model-variant selector if/when exposed. |
| 5 | `tracking_enabled` | THEATER | **DEPRECATE** | Toggle has no effect. |
| 6 | `min_pose_*_confidence`, `min_tracking_confidence` | HARDCODED-EXPOSABLE | **HOLD** (keep hardcoded for 1c) | Don't expose until there's a known need. Document in capability inventory only. |
| 7 | `num_poses` | HARDCODED to 1 | **KEEP HARDCODED** | Multi-person is out of scope; lifting it is a new feature, not a cleanup. |
| 8 | Model variant (Lite/Full/Heavy) | env-only | **HOLD as env knob** | Keep ops-only; revisit if a node demonstrates need. |
| 9 | World landmarks | AVAILABLE-UNUSED | **EARMARK for Phase 3+** | Listed in audit P3 #16. |
| 10 | Segmentation mask | AVAILABLE-UNUSED | **PARK** | No metric needs it. |
| 11 | Auto-zoom tunables | HARDCODED-EXPOSABLE | **KEEP HARDCODED** | Per-node tuning is premature optimization. |
| 12 | Body-based calibration constants | HARDCODED-EXPOSABLE | **EARMARK for position-aware constants** | Cheap win once `position` field is editable (audit Tab 1, P0 #2). |
| 13 | Movement direction | hardcoded `stationary` | **KEEP hardcoded; remove from response** | `motion.py` already removed; field is dead. |
| 14 | Reference object / static ppy | REAL fallback | **KEEP minimal fallback** (audit Tab 8 Option A) | Safety net; collapse the editor surface. |
| 15 | Reference filming instructions | THEATER for pipeline; athlete-facing copy | **DEPRECATE in 1c.2 / EARMARK athlete UI** | Per your Default A addition: backed up, not lost. |
| 16 | `camera_guidelines` JSON (skill-specific filming notes inside) | THEATER for pipeline; athlete-facing copy | **DEPRECATE in 1c.2 / EARMARK athlete UI** | Same. |
| 17 | `score_bands` | Renders in admin only; not in Claude prompt | **KEEP** but **EARMARK for athlete UI consumption** | Real product surface, just unused today. |
| 18 | `min_metrics_threshold`, `confidence_handling`, `scoring_renormalize_on_skip` | REAL | **KEEP** | Real scoring levers, not MediaPipe-related. |
| 19 | `segmentation_method` | REAL (phase math) | **KEEP** | Not pose, but real. |
| 20 | `form_checkpoints` | REAL only when `segmentation_method='checkpoint'` | **KEEP, audit data quality** | Conditional realness; ensure UI states match. |

---

## §3 — Closing summary

- **Total capability rows audited:** 20 (12 admin-visible MediaPipe-adjacent + 8 SDK capabilities)
- **REAL:** 7 — det_frequency (resolved), reference_calibrations (fallback), reference_fallback_behavior, scoring config trio, llm_prompt/system/max_words, segmentation_method+form_checkpoints (conditional), score_bands (admin-only today)
- **THEATER (highest impact):** 4 — `solution_class`, `performance_mode`, `tracking_enabled`, `det_frequency_defender`/`_multiple`. Removing these collapses the entire "Training Status" tab to a single field (`det_frequency`).
- **AVAILABLE-UNUSED (highest future leverage):** world landmarks (eliminates calibration for distance/velocity metrics) — earmarked for Phase 3+ per audit P3 #16.
- **HARDCODED-EXPOSABLE held intentionally:** confidence thresholds, auto-zoom tunables, model variant. Holding these prevents recreating the configuration-overflow pattern on the new admin surface.
- **Strongest single finding:** the entire Training Status tab is theater for MediaPipe except the `det_frequency` resolution path. End-state Architecture (Doc 2) should collapse it into the Pipeline Setup or Basics surface as a single integer field.
