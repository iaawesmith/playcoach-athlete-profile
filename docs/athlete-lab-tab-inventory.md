# Athlete Lab — Tab Inventory (Post-Slice-E)

**Captured:** 2026-04-26
**Source:** `src/features/athlete-lab/components/NodeEditor.tsx` `TABS` array (lines 60–78)
**Purpose:** Documentation input for Phase 1c.3 tab consolidation planning. Captures the 14-tab structure as it stands at the close of Phase 1c.2, including the now-hidden Mechanics tab.
**Disposition predictions** are working hypotheses for 1c.3 scope discussion — not approved decisions.

Legend for **Disposition (1c.3 prediction)**:
- **preserve** — tab stays as a top-level tab, content unchanged in spirit.
- **consolidate-into-X** — tab's contents merge into another tab and the standalone tab is removed.
- **delete** — tab and its underlying component are removed entirely (content already migrated, deprecated, or never depended on).

---

## 1. BASICS

- **Display label:** Basics
- **Internal identifier:** `basics`
- **Description:** Sets the node's identity (name, slug, icon), athlete-facing description, position/skill metadata, and upload constraints; also surfaces the publish/draft `status` toggle that controls whether athlete uploads trigger automatic analysis.
- **Fields/sections:** node name, slug, icon upload, description, position scope, allowed video durations / file constraints, lifecycle `status`.
- **Disposition (1c.3 prediction):** **preserve.** Identity surface — every node needs it.

## 2. VIDEOS

- **Display label:** Videos
- **Internal identifier:** `videos`
- **Description:** Adds elite reference videos with clip timestamps, camera angle, and type; one video must be flagged as the Reference shown to athletes alongside their results.
- **Fields/sections:** elite_videos list (URL, start/end timestamps, camera angle, type, reference flag), video guide (collapsible).
- **Disposition (1c.3 prediction):** **preserve.** Reference media is core admin input; no obvious consolidation target.

## 3. PHASES

- **Display label:** Phases
- **Internal identifier:** `phases`
- **Description:** Defines and sequences movement phases; each phase carries proportion weights, descriptions, and (post-Slice-2) per-phase coaching cues that drive Claude's prompt context.
- **Fields/sections:** phase_breakdown list (name, description, proportion, coaching_cues), segmentation_method selector, `CoachingCuesMigrationBanner` (suppressed when status=`confirmed`).
- **Disposition (1c.3 prediction):** **preserve, plus absorb.** Strong consolidate-into target — likely receives Mechanics-derived content (already migrated) and possibly knowledge_base sub-keys (`mechanics`, etc., per R-12).

## 4. MECHANICS *(hidden post-Slice-E, scheduled for component deletion in 1c.3)*

- **Display label:** Mechanics
- **Internal identifier:** `mechanics`
- **Description:** Historically defined coaching cues per phase via the `pro_mechanics` JSON column; superseded by Slice-2 migration to `phase_breakdown[].coaching_cues`.
- **Fields/sections:** `MechanicsEditor` rendering `pro_mechanics` sections linked to phase ids.
- **Status (2026-04-26):** Hidden from `TABS` and removed from `ADVANCED_TAB_KEYS` after Slice E.5 first-attempt crash (F-SLICE-E-4). Underlying column dropped in migration `20260426025918`.
- **Disposition (1c.3 prediction):** **delete.** Content fully migrated to Phases; `MechanicsEditor.tsx` and `pro_mechanics`-typed plumbing (TrainingNode field, draft state, knowledge_base.mechanics key) all retire together.

## 5. METRICS

- **Display label:** Metrics
- **Internal identifier:** `metrics`
- **Description:** Defines what the pose engine measures in each phase and how scores are calculated; each metric maps body keypoints to a calculation type. Direct instruction set for the analysis pipeline.
- **Fields/sections:** `ActiveMetricsSection` — key_metrics list (name, type, keypoints, weight, active flag, phase association, scoring config).
- **Disposition (1c.3 prediction):** **preserve.** Highest-cardinality data on the node and pipeline-critical; no consolidation candidate.

## 6. SCORING

- **Display label:** Scoring
- **Internal identifier:** `scoring` (also in `ADVANCED_TAB_KEYS`)
- **Description:** Configures Mastery Score calculation, low-confidence keypoint handling, score-band copy, and skip-renormalization behavior.
- **Fields/sections:** scoring_rules, confidence_handling, min_metrics_threshold, score_bands (Elite/Varsity/Developing/Needs Work), scoring_renormalize_on_skip.
- **Disposition (1c.3 prediction):** **consolidate-into-METRICS.** Scoring config is structurally a tail on metrics — same audience, often edited together. Candidate for fold-in to reduce tab count. Open question: `score_bands` orphan status (R-11) — may need consumer wiring before consolidation makes sense.

## 7. ERRORS

- **Display label:** Errors
- **Internal identifier:** `errors` (also in `ADVANCED_TAB_KEYS`)
- **Description:** Defines common mistakes with severity levels and auto-detection conditions so the pipeline can confirm errors from metric output.
- **Fields/sections:** `CommonErrorsEditor` — common_errors list (label, severity, auto-detect rules referencing metric ids).
- **Disposition (1c.3 prediction):** **consolidate-into-METRICS.** Error definitions reference metric output; tightly coupled. Could become a sub-section under metrics rather than a dedicated tab.

## 8. REFERENCE

- **Display label:** Reference
- **Internal identifier:** `reference` (also in `ADVANCED_TAB_KEYS`)
- **Description:** Defines per-camera-angle reference objects (e.g., yard markers, athlete height, props) so the pipeline can convert pixel distances to real-world yards. Required for Distance and Velocity metrics. Currently shows `pixels_per_yard=80` for sideline on Slant.
- **Fields/sections:** `reference_calibrations` per camera angle, fallback config, calibration notes.
- **Disposition (1c.3 prediction):** **preserve, but pending B2.** Tab is essential while calibration remains a configurable concept. F-SLICE-B-1 contemplates moving to MediaPipe world coordinates which would obsolete this entire tab — but that is Phase 2+ work (analysis quality / world-coordinates redesign per revised phase ordering), not 1c.3.

## 9. FILMING GUIDANCE

- **Display label:** Filming Guidance
- **Internal identifier:** `camera`
- **Description:** Athlete-facing filming requirements (FPS, resolution, distance, visible body parts) that set expectations so uploads produce reliable keypoint detection.
- **Fields/sections:** `CameraEditor` — per-angle camera_settings (status, instructions, completeness).
- **Disposition (1c.3 prediction):** **consolidate-into-REFERENCE.** Filming guidance and reference calibration are both per-camera-angle concerns; admins setting one almost always set the other. Strong merge candidate — could become a single "Camera & Reference" tab keyed by angle.

## 10. CHECKPOINTS

- **Display label:** Checkpoints
- **Internal identifier:** `checkpoints` (also in `ADVANCED_TAB_KEYS`)
- **Description:** Defines frame-level body position events that trigger phase boundaries; used when Phases tab's Segmentation Method is set to `checkpoint-triggered`.
- **Fields/sections:** `CheckpointsEditor` — checkpoints list (keypoint, condition, target phase boundary).
- **Disposition (1c.3 prediction):** **consolidate-into-PHASES.** Checkpoints are a configuration mode of phases; only relevant when `segmentation_method='checkpoint-triggered'`. Belongs as a conditional sub-section inside Phases rather than a peer tab. Already advanced-only.

## 11. LLM PROMPT

- **Display label:** LLM Prompt
- **Internal identifier:** `prompt`
- **Description:** Coaching feedback template Claude uses to generate athlete results, with a variable registry for injecting analysis data into the prompt.
- **Fields/sections:** `LlmPromptEditor` — llm_prompt_template, llm_system_instructions, phase_context_mode toggle (compact/full/names_only), llm_max_words, variable registry helper.
- **Disposition (1c.3 prediction):** **preserve.** Distinct surface (prompt engineering ≠ data definition); consolidation would dilute clarity.

## 12. BADGES

- **Display label:** Badges
- **Internal identifier:** `badges`
- **Description:** Defines achievements athletes earn by hitting performance milestones; badges appear on athlete profiles and provide motivation to improve.
- **Fields/sections:** `BadgesEditor` — badges list (name, criteria expression referencing metrics, icon, copy).
- **Disposition (1c.3 prediction):** **preserve.** Distinct domain (athlete-facing rewards) with its own editor; low coupling to other tabs.

## 13. TRAINING STATUS

- **Display label:** Training Status
- **Internal identifier:** `training_status` (also in `ADVANCED_TAB_KEYS`)
- **Description:** Configures the pose-estimation engine settings for this node — parameters passed to the analysis service that determine which model runs and how. Post-Slice-E this tab no longer surfaces `solution_class` selection (column dropped); admins observed an unselected radio state during E.5 smoke.
- **Fields/sections:** det_frequency_solo / det_frequency_defender / det_frequency_multiple, performance_mode (dropped), tracking_enabled (dropped), solution_class (dropped), pose model toggles.
- **Disposition (1c.3 prediction):** **consolidate-into-BASICS or PHASES, or rename.** Post-drop the tab carries only the per-scenario `det_frequency_*` triplet. Either fold into Basics as "Pipeline Config" or rebrand to make scope honest. Open: per-scenario column collapse (F-SLICE-E-1) may further reduce content before 1c.3 lands.

## 14. RUN ANALYSIS

- **Display label:** Run Analysis
- **Internal identifier:** `test`
- **Description:** Tests the node configuration with sample videos and reviews AI output (the `TestingPanel` — admin-only Cloud Run trigger).
- **Fields/sections:** `TestingPanel` — sample upload selector, run trigger, calibration_audit display, result browser.
- **Disposition (1c.3 prediction):** **preserve.** Indispensable admin verification surface; not editorial — operates on saved state. No consolidation candidate.

---

## Summary table

| # | Tab | Internal key | Advanced? | Disposition prediction |
|---|---|---|---|---|
| 1 | Basics | `basics` | — | preserve |
| 2 | Videos | `videos` | — | preserve |
| 3 | Phases | `phases` | — | preserve, plus absorb |
| 4 | Mechanics *(hidden)* | `mechanics` | — | **delete** |
| 5 | Metrics | `metrics` | — | preserve |
| 6 | Scoring | `scoring` | ✓ | consolidate-into-METRICS |
| 7 | Errors | `errors` | ✓ | consolidate-into-METRICS |
| 8 | Reference | `reference` | ✓ | preserve (pending B2) |
| 9 | Filming Guidance | `camera` | — | consolidate-into-REFERENCE |
| 10 | Checkpoints | `checkpoints` | ✓ | consolidate-into-PHASES |
| 11 | LLM Prompt | `prompt` | — | preserve |
| 12 | Badges | `badges` | — | preserve |
| 13 | Training Status | `training_status` | ✓ | consolidate or rename |
| 14 | Run Analysis | `test` | — | preserve |

**If predictions hold:** 14 tabs → 8 tabs (Basics, Videos, Phases [+Checkpoints], Metrics [+Scoring +Errors], Reference [+Filming], LLM Prompt, Badges, Run Analysis), with Mechanics deleted and Training Status either folded or rebranded. Matches End-State Architecture's "12 → 8" target band cited in R-05.
