# Node field audit (read-only) and removal plan

Nothing has been changed. Evidence comes from the code and from the LIVE rows in the database (Slant WR v12 and Wheel v1, which are both LIVE).

## 1. Headline findings

- **Measurement window mismatch (fix first).** The editor, readiness and Analysis Log read the metric's top-level `temporal_window`. The calculations read `keypoint_mapping.temporal_window`, which is empty on every Slant metric, so they fall back to hardcoded defaults (`index.ts` 2840-2878):
  - Release Speed is set to 10 but runs on 3.
  - Hip Stability is set to 15 but runs on 10.
  - Speed into the break is set to 5. It runs on 5, but only because that number is hardcoded.
  - Plant Leg Extension (angle) ignores the window entirely (midpoint ±2).

  The Analysis Log line "Release 10" therefore reports a setting the math never used. Fixing this changes Release Speed and Hip Stability scores, so it's a decision for you, not a removal.
- **Both Slant and Wheel are LIVE**, not just Slant.
- **3 of Slant's 5 error rules can never fire:**
  - "Head Snap Timing < 1" and "Post-Catch YAC Burst < 3.0" point at inactive metrics.
  - "Catch Efficiency < 70" points at a metric that doesn't exist.
  - All three return `metric_unavailable` (`quality.ts` 70-96). Wheel has one error with an empty condition.
- **`{{phase_context}}` / "Phase context mode" is advertised but not implemented.** The prompt editor says "Full sends every phase description and coaching cue". The analyzer never loads `phase_context_mode` and never defines the variable. Slant's template doesn't use it, so nothing leaks today.

## 2. Suspicions: confirmed or refuted

| Suspicion | Verdict | Evidence |
|---|---|---|
| Solution class, performance mode, tracking, compatibility check, pipeline reference code unused by the pose service | **Confirmed** | The payload is only `video_url, start/end_seconds, det_frequency` (`index.ts` 3974-3999). The service schema still accepts the old trio and only logs it (`schema.py` 13-17, `main.py` 82-88). |
| Detection frequency unused | **Partly refuted** | It is sent, but the service forces every frame for clips of 120 frames or fewer (`main.py` 131-153). Clips are capped at 3 s, so in practice it has no effect. |
| Segmentation method has one working value | **Confirmed** | The runtime always uses movement-anchored proportional windows (`index.ts` 1162-1177). "checkpoint" only changes readiness. |
| Checkpoints exist | **Yes, as data and UI only** | Slant has 9. There is an editor, a readiness check and an export. Nothing triggers them. |
| Phase descriptions, coaching cues, error descriptions/corrections, severity and non-detected errors aren't sent to Claude | **Confirmed** | Only triggered error *names* and each scored metric's first description sentence reach the prompt (`index.ts` 3835-3856, `prompt.ts` 50-101). |
| Camera min FPS, min resolution, frame-size reject and confidence reject aren't enforced | **Confirmed** | Preflight checks duration, the 3 s cap and LIVE status only (`index.ts` 1414-1442). The `auto_reject_*` values in Slant's JSON are leftovers; the editor drops them on save. |
| Reference fields beyond pixels-per-yard unused; no field-line detection | **Confirmed** | `camera_angle` picks the card and `pixels_per_yard` is the scale. The rest is display only. `calibration.py` is body-based only; "estimate_field_lines" is a label. |
| Bilateral and Direction Override duplicate each other | **Confirmed** | Both feed the same side decision. The override wins, then bilateral, then the route rule (`index.ts` 3615-3692). |
| Depends On and Body groups don't affect scoring | **Confirmed** | Depends On is display only. Body groups only filter the keypoint picker in the editor. |
| Max Feedback Length is unused | **Refuted (weakly used)** | It only sets the model's token cap (~2× words) and a log line. The real word rule is a fixed 120-140 target with rejection above 160 (`prompt.ts` 147-203). Slant's value of 150 contradicts that rule. |
| Required visible body parts include inactive metrics | **Confirmed** | `CameraEditor.tsx` 178 and `nodeExport.ts` 256-271 don't filter on active. |
| Error conditions pointing at missing or inactive metrics | See Section 1 | |

## 3. Field inventory (by category)

- **Scoring:**
  - Metric fields: keypoint_indices, calculation_type, phase_id, end_before_phase_id, eliteTarget, tolerance, target_direction, weight, active, requires_catch, unit (no-scale gate), confidence_threshold (0 turns into 0.70), bilateral / bilateral_override, side_rule, min_pass_ratio, and the nested temporal_window (currently empty).
  - Phase fields: id, sequence_order, proportion_weight, frame_buffer.
  - Node settings: confidence_handling, min_metrics_threshold (this is actually the maximum skipped %), scoring_renormalize_on_skip, reference camera_angle and pixels_per_yard, reference_fallback_behavior.
- **Coaching:** llm_prompt_template, llm_system_instructions, coaching_provider and coaching_model, node name, position, metric name and first description sentence, phase names, triggered error names, llm_max_words (token cap only).
- **Gate:**
  - At run time: status (LIVE), clip_duration_min / clip_duration_max.
  - Readiness only: phase weight sum, metric weight sum, prompt present, segmentation/checkpoint pairing, camera fields filled in, top-level temporal_window, Reference calibration (warning).
- **Athlete-facing:** none of the node fields is shown in an athlete view yet, because no athlete screen exists. Intended for athletes: the teach-tape video, filming instructions, overview.
- **Admin display only:** overview, icon, internal_documentation, depends_on_metric_id, body_groups, score_bands, scoring_rules (free text, explicitly not parsed), error severity and correction, phase description and coaching_cues, calibration notes/object/instructions, camera min/max distance, min FPS, min resolution, knowledge_base, coaching_cues_migration_status, node_version, checkpoints (all 10 sub-fields), segmentation_method.
- **Dead:**
  - Node settings: phase_context_mode, `auto_reject_*` camera keys, det_frequency_defender / _multiple (overridden in practice), pose_engine (type only).
  - Pose service: the solution_class, performance_mode and tracking_enabled settings it still accepts.
  - Unbacked fields: legacy pro_mechanics, skill_specific_filming_notes.
  - Videos tab: the hidden video camera_angle / video_type.

## 4. Leftover rtmlib / COCO-WholeBody code

- **Dead or legacy, safe to remove:**
  - `PoseEngine "rtmlib"` type and the `pose_engine` field.
  - The "Solution Class / Model" rows in the Analysis Log.
  - The "rtmlib Documentation" placeholder in the admin reference panel.
  - The Data Dictionary "rtmlib Reference" pill and its MMPose metadata.
  - The `"Catch Efficiency (wholebody)"` preset in the metrics editor.
  - Stale comments in NodeReadinessBar, NodeEditor and index.ts (1078, 1518, 2297).
  - `result_data.rtmlibSummary` in the verification script.
  - The pose-service schema fields for solution class, performance mode and tracking.
- **On the live path, rename only (behavior must not change):**
  - `RTMLIB_FALLBACK`, the `RTMLIB_URL` env fallback, `rtmlibBase` / `rtmlibUrl` and `rtmlibResult`.
  - The `logData.rtmlib` namespace, read by the overlay, export, Analysis Log, Testing Panel and tests.
  - The pipeline-health URL lookup and the `wholebody_tested` checklist ID.
  - Renaming `logData.rtmlib` would break stored runs, so keep the key and add an alias at most.

## 5. Knowledge-base sections that are wrong

Slant's knowledge base has sections under badges, basics, metrics, phases, prompt, reference, test and videos. They contain:

- **Removed features:** Solution Class, Performance Mode (RTMW variants, ONNX), Tracking (rtmlib IoU tracker), Mechanics tab, Checkpoints tab and checkpoint-triggered segmentation. Also "Hand keypoints require Wholebody" and the "Minimum resolution required for Wholebody" table rows.
- **Wrong landmark indices:**
  - "integer indices in the COCO-WholeBody 133-keypoint array".
  - "valid 0-132, 133 is out of bounds" (the real range is 0-32).
  - "Any index 91-132 triggers solution class validation".
  - "Break Angle [11, ...]" written in COCO terms.
- **False claims about what reaches Claude:**
  - "checkpoint description is sent to Claude".
  - Mechanics notes, reference videos and overview described as AI context.
  - `{{score}}` instead of `{{mastery_score}}`.
  - `{{athlete_name}}` without noting that the model only sees "Athlete".
  - The test section telling admins to tweak mechanics notes.
- **Wrong pipeline claims:**
  - "Videos supply clip timestamps to rtmlib".
  - "Confidence auto-reject after rtmlib processes the first sample".
  - "FPS validated from metadata before processing".
  - "Distance metrics return pixels" (they are skipped with `no_scale`).

## 6. Removal plan in batches

Each batch is checked by rescoring c6fa0895 from stored data with the metrics fingerprint unchanged. Saved values are preserved in the database: fields are hidden, never wiped.

1. **Camera:**
   - Remove the min FPS / min resolution inputs and the leftover auto-reject keys.
   - Keep the distance range, filming instructions, and the required body parts (filtered to active metrics).
   - Change the readiness copy "validates upload quality".
2. **Methodology / Pipeline Setup:**
   - Remove segmentation method, the Checkpoints editor and its readiness check, and detection frequency for defender/multiple.
   - Keep solo detection frequency, shown as "overridden for clips of 3 s or less".
   - Drop solution class, performance mode and tracking from the pose-service schema. The service tests must stay at 17 passing.
3. **Metric card:**
   - Remove Depends On and Body groups (the picker stays, without the group filter).
   - Merge Bilateral and Direction Override into one "Side" control that writes both fields identically.
   - Remove internal documentation only if you don't want admin notes.
4. **Phases:**
   - Remove phase_context_mode and the `{{phase_context}}` advertisement.
   - Keep phase description and coaching cues as admin notes, labeled "not sent to the coach model". Removing them is an alternative.
5. **Errors:**
   - Keep name, condition and correction. Label correction "admin note", because neither the coach model nor the fallback summary uses it.
   - Severity becomes display only.
6. **Reference:**
   - Collapse to camera angle plus pixels-per-yard.
   - Hide object, size, placement and notes, and the "estimate field lines" option.
7. **Scoring:** remove score bands and the free-text scoring rules, or label them display only.
8. **rtmlib cleanup:** the dead items from Section 4, renames with no change to stored keys, and rewriting the knowledge-base sections from Section 5.

## 7. Fix rather than remove

- **Measurement window:** pick one source. My recommendation is to make the calculations read the top-level `temporal_window`. This changes Release Speed (3→10) and Hip Stability (10→15), so c6fa0895's fingerprint will change. The alternative is to make the editor and log show the values actually used. Your call.
- **Slant error rules:** retarget or remove the 3 dead rules. Wheel: fix the empty condition.
- **llm_max_words:** derive it from the fixed 160 cap, or drop it and use a constant token cap.
- **min_metrics_threshold:** rename the label to "Max skipped metrics %".
- **confidence_threshold:** 0 turning into 0.70 is undocumented. Treat 0 explicitly.
- **Required body parts:** filter to active metrics.
- **Speed into the break:** its window of 5 is hardcoded. Read it from the setting.
- **Pose-service detection frequency:** document that it is overridden on short clips.
