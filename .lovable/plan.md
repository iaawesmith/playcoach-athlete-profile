
Build a cross-node Recent Test Runs history view inside the Admin Reference Testing section so admins can inspect and compare real pipeline runs for the fixed test athlete without changing Run Analysis itself.

### What will be added

1. Extend the AthleteLab service layer for admin history
   - Add a new history fetcher in `src/services/athleteLab.ts` scoped to the fixed test athlete ID already used by Run Analysis.
   - Query `athlete_uploads` as the base dataset, ordered by `created_at desc`, limited to 25 by default.
   - Join in:
     - `athlete_lab_nodes` for node name
     - `athlete_lab_results` primarily by `upload_id`
   - Keep a fallback lookup for older records lacking `upload_id` using athlete/node plus nearest `analyzed_at` ordering.
   - Normalize each row into a UI-friendly shape with:
     - upload metadata
     - node name/version
     - aggregate score / phase scores / metric results
     - confidence flags / detected errors / feedback
     - derived calibration summary from the first metric containing calibration metadata

2. Add dedicated history types
   - Extend `src/features/athlete-lab/types.ts` with admin history-specific types rather than overloading the Run Analysis result type.
   - Include:
     - history row model
     - filter option types
     - sort option types
     - parsed calibration summary fields
   - Ensure optional/missing context fields are handled safely so absent values render as `N/A` or blank instead of causing runtime issues.

3. Add a Recent Test Runs section to Admin Reference
   - Update `src/features/athlete-lab/components/AdminReferencePanel.tsx`.
   - Keep the existing Manual Test Upload tool intact.
   - Add a second block below it titled something like `RECENT TEST RUNS`.
   - Keep styling aligned with the current AthleteLab admin aesthetic:
     - dark surface hierarchy
     - ghost borders only
     - Material Symbols only
     - no dashboard/chart treatment

4. Build filters and sort controls
   - Add controls above the table for:
     - Node: defaults to `All Nodes`
     - Date range: default to `Last 7 Days`
     - Calibration source: `All / Dynamic / Body Based / Static / None`
     - Status: `All / Complete / Failed`
     - Sort: `Newest`, `Oldest`, `Aggregate Score ↑`, `Aggregate Score ↓`, `Node Name A–Z`
   - Implement filtering/sorting client-side on the fetched result set.
   - Populate node options dynamically from returned runs.

5. Build the history table
   - Use the project table primitive from `src/components/ui/table.tsx`, but restyle with the project’s dark admin palette instead of default shadcn presentation.
   - Columns:
     - Date/Time
     - Node Name
     - Node Version
     - Status
     - Video
     - Athlete Height
     - Athlete Wingspan
     - Camera Angle
     - Route Direction
     - Calibration Source
     - Calibration Confidence
     - Aggregate Score
   - Default ordering: newest first.
   - Failed runs stay visible in the same list with stronger error styling.

6. Add expandable row detail for debugging
   - Make each row expandable/collapsible inline.
   - Expanded content will show:
     - full `metric_results`
     - metric `detail` objects
     - calibration detail block
     - confidence flags
     - detected errors
     - phase scores breakdown
     - feedback text in a nested collapsible area
     - upload status and `error_message`
   - Reuse presentation patterns already established in `TestingPanel.tsx` for:
     - score badges
     - calibration summaries
     - confidence/error sections
     - JSON detail formatting

### Display and parsing rules

- Date filter default: `Last 7 Days` on initial render.
- Video identifier:
  - first try filename extraction from `video_url`
  - if that fails, show truncated URL tail like `…last-20-characters`
  - if URL is missing/unusable, fall back to upload ID
- Missing context fields:
  - display `N/A` or blank gracefully for fields like route direction, wingspan, or camera angle when absent
  - never assume all nodes populate all context keys
- Calibration summary:
  - derive from the first metric whose detail includes calibration metadata
  - expose source, confidence, pixels-per-yard, and nested calibration details when present

### Files to update

- `src/services/athleteLab.ts`
  - add fetcher, joining/fallback logic, normalization helpers, and display helpers
- `src/features/athlete-lab/types.ts`
  - add admin history row/filter/sort/calibration types
- `src/features/athlete-lab/components/AdminReferencePanel.tsx`
  - add Recent Test Runs UI, filters, table, expandable details, loading/empty/error states

### Validation after implementation

1. Recent runs for the fixed test athlete appear across all nodes.
2. Default view shows only the last 7 days.
3. Most recent runs appear first by default.
4. Node column clearly identifies which skill was tested.
5. Node/date/calibration/status filters work correctly.
6. Sort controls reorder the visible rows correctly.
7. Expanding a row reveals full metric, calibration, confidence, error, feedback, and phase detail.
8. Failed runs remain visible and show `error_message`.
9. Missing analysis context fields render safely as `N/A` or blank.
10. Video identifier never dumps a full long URL when filename parsing fails.
