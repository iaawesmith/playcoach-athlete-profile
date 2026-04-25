# Athlete Lab End-State Architecture

**Date:** 2026-04-25
**Phase:** 1c.0 — Foundation
**Sequence:** Document 2 of 3 (after `mediapipe-capability-inventory.md`, before `migration-risk-register.md`)
**Frame:** Define the target shape of the Athlete Lab admin surface after the Phase 1c cleanup. Every field that exists today is either kept (with possible reshaping), modified, deleted in 1c.2, or earmarked for future surface (athlete-facing, ops-only, Phase 3+). Nothing is silently dropped.
**Inputs:** `docs/athlete-lab-architecture-audit.md` (parts 1+2), `docs/mediapipe-capability-inventory.md` (sibling doc), code paths cited in those docs.

Per your defaults:
- **Default A:** No new athlete UI in Phase 1c. Athlete-facing-only fields with no current consumer get **DEPRECATE in 1c.2** and an **earmark** for a future athlete-UI phase, so we don't lose product surface as a deletion.
- **Default B:** Hard delete in 1c.2 with a backup table. Backup retention is **indefinite until explicitly archived** (rollback buffer, not time-boxed).

---

## §1 — End-state tab structure

Today: 12 admin tabs (Basics, Videos, Mechanics, Phases, Metrics, Errors, LLM Prompt, Reference, Filming Guidance, Checkpoint, Training Status, Scoring).

End state (post-1c): **8 tabs.**

| # | Tab | Sourced from today's | Disposition |
|---|---|---|---|
| 1 | Basics | Basics | KEEP, add editable Position field |
| 2 | Videos | Videos | KEEP, consolidate Type+Reference |
| 3 | Phases | Phases + Mechanics | MERGE (Mechanics deprecates into Phases as `coaching_cues` per phase) |
| 4 | Metrics | Metrics | KEEP, MediaPipe landmark name display + plausibility bounds (P2) |
| 5 | Errors | Errors | KEEP, structured conditions + clarify Auto-detectable |
| 6 | LLM Prompt | LLM Prompt | KEEP, fix system-param substitution + expand variables |
| 7 | Calibration | Reference + Filming Guidance | MERGE — collapsed to a "static fallback + filming copy" tab; most fields earmarked for athlete UI |
| 8 | Pipeline Config | Training Status + Scoring + (subset of) Checkpoint | MERGE — single home for `det_frequency`, scoring config, segmentation method |

**Eliminated tabs:** Mechanics, Reference (folded), Filming Guidance (folded), Checkpoint (folded into Phases for `phase_transition_role` checkpoints; into Pipeline Config for `segmentation_method`), Training Status (folded), Scoring (folded). Net: 12 → 8.

---

## §2 — Field-level migration map

Notation:
- **KEEP** — stays in its tab (possibly renamed)
- **MOVE → X** — relocates to tab X (no semantic change)
- **MERGE → X** — folded into an existing field on tab X (semantic consolidation)
- **DELETE 1c.2** — hard-deleted in migration 1c.2 after backup to `athlete_lab_nodes_phase1c_backup`
- **EARMARK athlete-UI** — has no current consumer but is product surface; do not lose track
- **EARMARK Phase 3+** — capability inventory flagged for future activation

### 2.1 Basics
| Field | Disposition |
|---|---|
| `name` | KEEP |
| `position` | KEEP — **add edit UI** (audit P0 #2) |
| `clip_duration_min/max` | KEEP |
| `status` | KEEP |
| `node_version` | KEEP |
| `icon_url` | KEEP |
| `overview` | KEEP — **wire to Claude** as `{{node_overview}}` (audit P1 #2 implication) |

### 2.2 Videos
| Field | Disposition |
|---|---|
| `elite_videos[].url`, `start_seconds`, `end_seconds` | KEEP |
| `elite_videos[].camera_angle` | KEEP — tighten binding to athlete-upload angle |
| `elite_videos[].video_type` ∪ `is_reference` | MERGE → single 3-value field on `elite_videos[]` |
| `elite_videos[].label` | KEEP |

### 2.3 Phases (absorbs Mechanics)
| Field | Disposition |
|---|---|
| `phase_breakdown[].name`, `sequence_order`, `proportion_weight` | KEEP |
| `phase_breakdown[].description` | KEEP — split semantically into "biomechanical description" |
| `pro_mechanics` (Mechanics tab) | MERGE → new `phase_breakdown[].coaching_cues` per phase, then **DELETE 1c.2** at root level |
| `phase_breakdown[].frame_buffer` | KEEP for now; **EARMARK Phase 5+** for dynamic detection (audit Tab 4) |
| Auto-summary "Metrics measured here" | KEEP, **fix bug** (excludes inactive metrics from weight totals) |

Both `description` and `coaching_cues` get wired into Claude via `{{phase_context}}` (audit P0 #3).

### 2.4 Metrics
All `key_metrics[]` sub-fields KEEP per audit Tab 5. Additions (P2):
- Plausibility bounds per metric
- Scoring curve choice
- Landmark name display in admin UI (uses existing `keypointLibrary.json`)
- Bilateral mode inferred from `keypoint_indices`

No deletions.

### 2.5 Errors
| Field | Disposition |
|---|---|
| `common_errors[].error`, `correction` | KEEP |
| `common_errors[].severity` | KEEP — wire to Claude prompt (P1) |
| `common_errors[].auto_detection_condition` | MODIFY — replace free-text with structured (metric dropdown + operator + threshold) |
| `common_errors[].auto_detectable` | MODIFY — clarify or **DELETE 1c.2** if it has no enforced meaning |

### 2.6 LLM Prompt
| Field | Disposition |
|---|---|
| `llm_prompt_template` | KEEP, expand template variables |
| `llm_system_instructions` | KEEP, **fix substitution bug** (audit P0 #1) |
| `llm_max_words` | KEEP |
| `llm_tone` | **DELETE 1c.2** — confirmed dead by Lovable trace |

### 2.7 Calibration (absorbs Reference + Filming Guidance)
| Field | Disposition |
|---|---|
| `reference_calibrations[].camera_angle` | KEEP |
| `reference_calibrations[].pixels_per_yard` | KEEP — minimal static fallback (audit Tab 8 Option A) |
| `reference_calibrations[].reference_object_name`, `known_size_yards`, `known_size_unit`, `placement_instructions` | **DELETE 1c.2** — MMPose-era reference-object workflow no longer driven by code; back up to rollback table |
| `reference_calibrations[].filming_instructions`, `calibration_notes` | **DELETE 1c.2** + **EARMARK athlete-UI** — athlete-facing copy with no current consumer |
| `reference_object` (root column) | **DELETE 1c.2** + **EARMARK athlete-UI** |
| `reference_filming_instructions` (root) | **DELETE 1c.2** + **EARMARK athlete-UI** |
| `reference_fallback_behavior` | KEEP (real switch in `index.ts:742`) |
| `camera_guidelines` JSON (incl. `skill_specific_filming_notes`) | **DELETE 1c.2** + **EARMARK athlete-UI** — pure athlete-facing copy, no pipeline read |

### 2.8 Pipeline Config (absorbs Training Status + Scoring + part of Checkpoint)
| Field | Disposition |
|---|---|
| `det_frequency` | KEEP — single integer, scenario picker collapses |
| `det_frequency_solo` | MERGE → becomes `det_frequency` |
| `det_frequency_defender` | **DELETE 1c.2** — `num_poses=1` makes scenario meaningless (capability inventory §1.3) |
| `det_frequency_multiple` | **DELETE 1c.2** — same reason |
| `solution_class` | **DELETE 1c.2** — THEATER (capability inventory §1.3) |
| `performance_mode` | **DELETE 1c.2** — THEATER |
| `tracking_enabled` | **DELETE 1c.2** — THEATER |
| `confidence_handling` | KEEP |
| `min_metrics_threshold` | KEEP |
| `scoring_renormalize_on_skip` | KEEP |
| `scoring_rules` (free text) | KEEP — **EARMARK** to wire into Claude as `{{scoring_rules}}` |
| `score_bands` | KEEP + **EARMARK athlete-UI** (currently rendered in admin only) |
| `segmentation_method` | KEEP |
| `form_checkpoints` | KEEP **only when `segmentation_method='checkpoint'`**; checkpoints with `phase_transition_role` move under Phases tab visually but stay in same DB column |

### 2.9 Earmarked-but-deleted summary (the "don't lose track" register)

These are deleted from the admin surface in 1c.2 but their text content is preserved in `athlete_lab_nodes_phase1c_backup` (see Doc 3 risk R-04). Each represents a future product surface, not waste:

1. `reference_object` (root) — athlete UI: "what to use for calibration" tip
2. `reference_filming_instructions` (root) — athlete UI: "how to film this skill"
3. `camera_guidelines.skill_specific_filming_notes` — athlete UI: per-skill camera tip
4. `reference_calibrations[].filming_instructions` — athlete UI: per-angle filming tip
5. `reference_calibrations[].calibration_notes` — admin/athlete: per-angle gotchas
6. `reference_calibrations[].placement_instructions` — athlete UI: where to put a marker
7. (Already KEEP-but-earmarked) `score_bands` — athlete UI: result-page band labels
8. (Already KEEP-but-earmarked) `scoring_rules` — Claude prompt context

Items 1–6 are **deleted** from `athlete_lab_nodes` in 1c.2; their text is restorable from the backup table indefinitely. Items 7–8 are **kept** in schema but flagged as not-yet-consumed.

---

## §3 — Field count

| Bucket | Today | End state |
|---|---|---|
| Admin tabs | 12 | 8 |
| Distinct admin-editable fields (root + JSON sub-fields) | ~74 | ~52 |
| Fields KEEP | — | 47 |
| Fields MODIFY | — | 5 |
| Fields DELETE 1c.2 (root columns) | — | 7 (`solution_class`, `performance_mode`, `tracking_enabled`, `det_frequency_defender`, `det_frequency_multiple`, `reference_object`, `reference_filming_instructions`) |
| Fields DELETE 1c.2 (JSON sub-fields) | — | 5 (reference_object_name, known_size_yards, known_size_unit, placement_instructions, filming_instructions, calibration_notes inside `reference_calibrations[]`; plus `skill_specific_filming_notes` inside `camera_guidelines`) |
| Fields EARMARK athlete-UI | — | 8 (per §2.9) |
| Fields EARMARK Phase 3+ (capability) | — | 1 (world-landmark mode per metric) |
| Tabs eliminated | — | 4 (Mechanics, Reference, Filming Guidance, Training Status) plus Scoring + Checkpoint folded |

Net reduction: ~30% of admin field surface, ~33% of tabs. Aligns with the audit's "roughly 40% of the admin surface is candidate for simplification" estimate.

---

## §4 — Order of operations preview (detail in Doc 3)

1. **1c.1 (functional fixes, no deletions yet):** P0 items from audit — system-param substitution, Position editor, `{{phase_context}}` wiring, Mechanics → Phases content migration in app code.
2. **1c.2 (hard deletion + backup):** create `athlete_lab_nodes_phase1c_backup`, copy text-bearing columns/JSON sub-fields, then `ALTER TABLE ... DROP COLUMN` and JSON pruning.
3. **1c.3 (UI consolidation):** collapse 12 tabs to 8 in `NodeEditor.tsx`. No DB changes — purely UI.

This sequencing means the database is the last thing to change irreversibly, and only after the new admin UI is verified against the same data.

---

## §5 — Closing summary

- **Tabs:** 12 today → **8** end-state.
- **Fields (admin-editable):** ~74 today → **~52** end-state.
- **Hard deletions in 1c.2:** 7 root columns + 6 JSON sub-fields, all backed up indefinitely.
- **Earmarked product surface (do-not-lose):** 8 items, none of which silently disappear — each has either a future athlete-UI consumer or a future Claude-prompt consumer documented.
- **Strongest single consolidation:** Training Status tab collapses entirely into the new Pipeline Config tab as one integer (`det_frequency`), removing four THEATER fields and three scenario-variant columns whose `num_poses=1` premise makes them meaningless.
- **Next document (Risk Register):** enumerate what could go wrong in 1c.1 → 1c.2 → 1c.3 sequencing, especially around the backup table contract and the Mechanics → Phases content migration.
