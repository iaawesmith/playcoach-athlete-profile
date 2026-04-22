
Normalize `athlete_lab_nodes.phase_breakdown` to the implementation-spec shape across all rows, then update the AthleteLab codebase so the editor, exports, and pipeline all read/write the normalized fields consistently before rerunning the pipeline test.

### Confirmed code audit results

#### 1) Edge Function: `supabase/functions/analyze-athlete-video/index.ts`
Confirmed normalized-field consumers already exist here:
- `buildPhaseWindows()` uses:
  - `phase.sequence_order`
  - `phase.proportion_weight`
  - `phase.frame_buffer`
  - `phase.name`
- `formatPhaseScores()` uses:
  - `p.name`

Confirmed not using the old phase object field names:
- `calculateAllMetrics()` does **not** read `phase.phase`, `phase.weight`, or `phase.notes`
  - it only uses `mapping.phase_id` to look up a prebuilt window
- `calculateAggregateScore()` does **not** depend on `phase_breakdown` field names for scoring math
  - it groups scored metrics by `keypoint_mapping.phase_id`
  - but downstream `formatPhaseScores()` does require `phase.name`

Conclusion:
- The pipeline bug is centered in `buildPhaseWindows()`
- Once data is normalized, this function should stop producing invalid windows without needing logic changes

#### 2) AthleteLab UI still uses old phase field names
Confirmed old-field references that must be updated in code:

- `src/features/athlete-lab/types.ts`
  - `PhaseNote` currently uses:
    - `phase`
    - `notes`
    - `weight`
  - this must be changed to:
    - `name`
    - `description`
    - `sequence_order`
    - `proportion_weight`
    - `frame_buffer`

- `src/features/athlete-lab/components/NodeEditor.tsx`
  - readiness validation sums `p.weight`
  - `PhasesEditor` creates/edits phases using:
    - `p.phase`
    - `p.notes`
    - `p.weight`
  - add/edit defaults also use old keys
  - this file must be updated so the editor writes the normalized JSON shape

- `src/features/athlete-lab/components/KeyMetricsEditor.tsx`
  - phase labels currently display `phases.find(... )?.phase`
  - phase select options render `p.phase`
  - must switch to `p.name`

- `src/features/athlete-lab/components/CheckpointsEditor.tsx`
  - linked phase label uses `?.phase`
  - phase dropdown filters/renders `p.phase`
  - must switch to `p.name`

- `src/features/athlete-lab/utils/nodeExport.ts`
  - still uses:
    - `p.weight`
    - `p.phase`
    - `p.notes`
  - mechanics/checkpoint/metric summaries also map phase IDs back via `?.phase`
  - must switch to normalized fields everywhere

#### 3) Database queries
Confirmed no database query is filtering JSON by the old field names.
Current access pattern is:
- `src/services/athleteLab.ts`
  - `.select("*")`, `.insert(...)`, `.update(...)`
- `supabase/functions/analyze-athlete-video/index.ts`
  - selects raw `phase_breakdown`

Conclusion:
- No SQL query path needs JSON-key predicate changes
- But any UI save path will keep writing the old shape unless the frontend code is updated at the same time

---

### Data normalization to apply to all `athlete_lab_nodes` rows
For every object inside `phase_breakdown`:

- rename `phase` -> `name`
- rename `weight` -> `proportion_weight`
- rename `notes` -> `description`
- add `sequence_order` using current array order: `1..n`
- preserve existing `frame_buffer` when present
- otherwise set `frame_buffer: 3`
- preserve `id`

Target phase shape:
```json
{
  "id": "uuid",
  "name": "Phase Name",
  "sequence_order": 1,
  "proportion_weight": 15,
  "frame_buffer": 3,
  "description": "Phase description..."
}
```

Special handling already requested:
- keep Break’s existing `frame_buffer: 4`
- all other missing `frame_buffer` values default to `3`

---

### Implementation plan

#### Step 1 — Normalize existing backend data
Apply a data update against `athlete_lab_nodes` that rewrites every `phase_breakdown` array into the normalized structure for all rows.

Validation to run immediately after:
- every node still has the same number of phases as before
- every phase has `id`, `name`, `sequence_order`, `proportion_weight`, `frame_buffer`, `description`
- `sequence_order` is sequential per node
- proportional nodes still sum to `100`

Important note:
- this is a data migration, not a schema migration; it should be done as a table data update, not a structural schema change

#### Step 2 — Update shared TypeScript types
Update `src/features/athlete-lab/types.ts` so `PhaseNote` matches the normalized database shape.

Planned shape:
```ts
interface PhaseNote {
  id?: string;
  name: string;
  sequence_order?: number;
  proportion_weight?: number;
  frame_buffer?: number;
  description: string;
}
```

#### Step 3 — Update AthleteLab editor to read/write the new shape
Update `src/features/athlete-lab/components/NodeEditor.tsx` so:
- readiness checks sum `proportion_weight`
- phase add/edit defaults use normalized keys
- displayed labels and inputs bind to:
  - `name`
  - `description`
  - `proportion_weight`
  - `frame_buffer`
- when phases are reordered, `sequence_order` is rewritten from the current UI order before save

This keeps future saves from reverting the JSON back to the broken legacy shape.

#### Step 4 — Update dependent UI components
Update:
- `src/features/athlete-lab/components/KeyMetricsEditor.tsx`
- `src/features/athlete-lab/components/CheckpointsEditor.tsx`

So all phase label rendering and dropdowns use `p.name` instead of `p.phase`.

#### Step 5 — Update export/documentation helpers
Update `src/features/athlete-lab/utils/nodeExport.ts` to use:
- `name`
- `description`
- `proportion_weight`

Also update phase-name lookups for mechanics, metrics, and checkpoints from `?.phase` to `?.name`.

#### Step 6 — Re-run the pipeline test
After data normalization and code updates:
1. redeploy the updated `analyze-athlete-video` function and frontend code
2. create a fresh test upload using the same node/test flow
3. inspect logs for:
   - `cloud_run_response_received`
   - `phase_windows_built`
   - `metric_window_selected`
   - `metric_scored`
   - `claude_feedback_received`
   - `results_written`
   - `pipeline_completed`

#### Step 7 — Success criteria
Expected post-fix outcome:
- `phase_windows_built` shows real numeric `start` and `end` values for every phase
- no `no_phase_window` skips
- all 6 metrics compute real values
- Claude feedback is non-empty
- results row contains populated `aggregate_score`, `phase_scores`, `metric_results`, and `feedback`
- upload status ends as `complete`

### Technical note
This fix should be treated as a coordinated backend-data + frontend-type + editor-write-path change. Updating only the database will make the current AthleteLab editor incompatible with saved nodes; updating only the UI will not repair already-broken node data already stored in the backend.
