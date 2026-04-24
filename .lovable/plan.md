

## Phase 0 — Codebase Cleanup & Reset for MediaPipe Transition (Build)

Executing the approved plan: Option A (TypeScript-only `pose_engine`), Training Status hidden behind Advanced Tabs, Data Dictionary keys untouched.

---

### Execution order

1. **Delete** `playcoach-rtmlib-service/` folder (all files).
2. **Replace** `src/constants/keypointLibrary.json` with MediaPipe Pose 33-landmark schema (same JSON shape).
3. **Add** `pose_engine?: "mediapipe" | "rtmlib"` to `TrainingNode` in `src/features/athlete-lab/types.ts`.
4. **Modify** UI components — engine-neutral copy, Training Status moved to `ADVANCED_TAB_KEYS`:
   - `NodeEditor.tsx` — tab subtitles, Metrics helper text, comment out RTMlib `pipelineCode` block, add `training_status` to `ADVANCED_TAB_KEYS`.
   - `NodeReadinessBar.tsx` — engine-neutral labels for Training Status category.
   - `CameraEditor.tsx` — strip RTMlib references in tooltips.
   - `CheckpointsEditor.tsx` — confidence-score tooltip rewording.
   - `AnalysisLog.tsx` — section heading "Pose Engine Output", local `poseEngineLog` alias.
   - `AdminReferencePanel.tsx` — seed link + briefing prompt copy.
   - `ImplementationDocsTab.tsx` — card title to MediaPipe (Phase 1).
   - `PipelineSetupTab.tsx` — section name to "CLOUD RUN POSE SERVICE (MediaPipe — Phase 1)", placeholder items preserved.
   - `DataDictionaryTab.tsx` — pill tooltip to "engine reference"; keep field key.
   - `KeyMetricsEditor.tsx` — add yellow info banner about MediaPipe + remap notice.
5. **Modify** `src/features/athlete-lab/utils/nodeExport.ts` — `deriveRequiredSolutionClass` returns "MediaPipe Pose" when `maxIdx <= 32`, falls back to legacy mapping otherwise.
6. **Modify** `docs/data-dictionary/fields.json` — top-level `description`/`definitions` strings only; keep per-field keys.

---

### Files modified / deleted

| File | Action |
|---|---|
| `playcoach-rtmlib-service/` | **Delete entire folder** |
| `src/constants/keypointLibrary.json` | Replace with MediaPipe 33-landmark schema |
| `src/features/athlete-lab/types.ts` | Add `pose_engine?: "mediapipe" \| "rtmlib"` |
| `src/features/athlete-lab/components/NodeEditor.tsx` | Copy edits + add `training_status` to `ADVANCED_TAB_KEYS` + comment RTMlib pipeline code sample |
| `src/features/athlete-lab/components/NodeReadinessBar.tsx` | Engine-neutral copy |
| `src/features/athlete-lab/components/CameraEditor.tsx` | Engine-neutral tooltips |
| `src/features/athlete-lab/components/CheckpointsEditor.tsx` | Confidence tooltip copy |
| `src/features/athlete-lab/components/AnalysisLog.tsx` | `poseEngineLog` alias + heading |
| `src/features/athlete-lab/components/AdminReferencePanel.tsx` | Engine-neutral seed copy |
| `src/features/athlete-lab/components/ImplementationDocsTab.tsx` | Card title update |
| `src/features/athlete-lab/components/PipelineSetupTab.tsx` | Section name + Phase 1 placeholders (keep `item_id`s) |
| `src/features/athlete-lab/components/DataDictionaryTab.tsx` | Tooltip copy only |
| `src/features/athlete-lab/components/KeyMetricsEditor.tsx` | Add MediaPipe banner |
| `src/features/athlete-lab/utils/nodeExport.ts` | MediaPipe-aware `deriveRequiredSolutionClass` |
| `docs/data-dictionary/fields.json` | Top-level metadata strings only |

---

### What stays untouched

- `supabase/functions/analyze-athlete-video/index.ts` and all edge functions.
- `supabase/migrations/` — no new migration.
- `athlete_lab_nodes` table, every row, every JSONB column.
- `TrainingNode` legacy fields (`solution_class`, `performance_mode`, `det_frequency*`, `tracking_enabled`, `reference_calibrations`, etc.).
- Slant node's saved `key_metrics`, `phase_breakdown`, `reference_calibrations`, status.
- `StatusModal`, readiness gate, Live/Draft logic.
- Per-field `mmpose_status` / `rtmlib_reference` keys in `fields.json`.

---

### Post-cleanup state

- Default tabs (Advanced OFF): Basics, Phases, Mechanics, Metrics, Scoring, Errors, Reference, Camera, Prompt, Badges, Run Analysis.
- Advanced ON: adds Checkpoints + Training Status.
- Slant node loads, edits, saves identically. Metric friendly names will read "off" against MediaPipe indices until Phase 1 remap (banner warns admins).
- `pose_engine` available on the type; defaults to `"mediapipe"` via `node.pose_engine ?? "mediapipe"` at read sites.
- Run Analysis still hits the existing edge function — no runtime change.

