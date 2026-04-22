
Build the camera-angle infrastructure around the existing per-node `reference_calibrations` and `reference_fallback_behavior` model, so each node can express angle support, skill-specific filming notes, and per-angle calibration guidance without hardcoding skill text into shared UI.

### What will be built

1. Extend the node data model used by AthleteLab admin:
   - Add a per-angle `status` field to each reference calibration entry with values:
     - `primary`
     - `supported`
     - `not_supported`
   - Add a per-angle free-text `calibration_notes` field on each reference calibration entry
   - Add a node-level free-text field for `skill_specific_filming_notes`

2. Update the Reference/Camera admin UI so:
   - Each camera angle card shows and edits its own support status
   - Each camera angle card includes a node-specific calibration notes textarea
   - The node has a dedicated skill-specific filming notes field
   - Existing shared/default angle instructions remain available only as generic fallback content, clearly labeled as overridden by node-specific notes when present

3. Update fallback behavior handling:
   - Confirmed current state: `reference_fallback_behavior` is already per-node, not global
   - Change the existing Slant node from `pixel_warning` to `disable_distance`
   - Keep the infrastructure per-node so future nodes can choose their own fallback behavior independently

4. Update downstream consumers so the new fields are preserved and visible wherever node configuration is summarized/exported.

### Current state confirmed

- Camera-angle calibration is already stored per node in `athlete_lab_nodes.reference_calibrations` (JSON), one object per angle.
- Fallback behavior is already per node via `reference_fallback_behavior`.
- The current Slant node is set to `pixel_warning`.
- The current UI uses:
  - `reference_filming_instructions` at node level
  - `filming_instructions` inside each angle calibration
  - `camera_guidelines` JSON for camera-tab filming instructions
- Some generic/shared defaults are currently embedded in `NodeEditor.tsx`, especially for endzone and behind-QB cards.

### Implementation approach

#### 1) Extend the frontend types to support scalable per-angle metadata
Update the AthleteLab TypeScript types so each calibration entry can carry:
- `status`
- `calibration_notes`

Add a node-level field for:
- `skill_specific_filming_notes`

Because `reference_calibrations` is already JSON-backed, this can be introduced without changing database schema structure.

#### 2) Reframe the Reference tab around node-specific overrides
Update `ReferenceCalibrationEditor` in `NodeEditor.tsx` so each angle card includes:
- Support status selector/badge
- Existing calibration fields
- New calibration notes textarea
- Existing per-angle filming instructions textarea, relabeled so admins understand it is generic fallback unless node-specific notes are provided elsewhere

The cards remain skill-agnostic in layout and labels. Only admin-entered text becomes skill-specific.

#### 3) Move skill-specific filming guidance into a dedicated node field
Add a dedicated node-level textarea for `Skill-Specific Filming Notes` in the admin flow and use it as the primary editable source of skill guidance.

Planned behavior:
- If node-specific filming notes exist, they are treated as the primary instructions
- Existing shared/generic card copy is preserved as fallback only
- No existing note content is deleted during this pass

This preserves current content while enabling gradual migration by admins.

#### 4) Clarify generic fallback copy
Where the UI currently shows baked-in angle guidance, revise labels/help text so it reads as generic fallback guidance rather than skill-specific truth.

Examples of wording changes:
- “Generic fallback instructions”
- “Node-specific notes override this guidance”

No skill-specific examples or route language will be added to shared infrastructure.

#### 5) Update exports/derived summaries
Update the node export/summary logic so it includes:
- angle support status
- calibration notes
- node-level skill-specific filming notes
- fallback behavior

This keeps docs/export output aligned with the new admin model.

#### 6) Apply the fallback-behavior data change
Since fallback behavior is confirmed per-node, update only the Slant node’s `reference_fallback_behavior` from:
- `pixel_warning` → `disable_distance`

This is a data/config update, not a schema change.

### Files likely to change

- `src/features/athlete-lab/types.ts`
- `src/features/athlete-lab/components/NodeEditor.tsx`
- `src/features/athlete-lab/components/CameraEditor.tsx`
- `src/features/athlete-lab/utils/nodeExport.ts`
- `src/services/athleteLab.ts` only if helper typing needs adjustment
- one backend data update for the existing Slant node record

### Validation plan

After implementation, verify:

1. Per-angle status
   - Each of the three angle cards can be set independently to Primary / Supported / Not Supported
   - Status persists per node

2. Node-level filming notes
   - A dedicated skill-specific notes field exists
   - Existing content is not removed
   - Shared/generic copy is clearly marked as fallback

3. Per-angle calibration notes
   - Each angle card accepts its own free-text notes
   - Notes persist and appear in export/summary output

4. Fallback behavior
   - The UI still reflects fallback behavior per node
   - Slant node now reads `Disable Distance Metrics`

5. No forbidden regressions
   - No skill-specific text is hardcoded into shared infrastructure
   - No existing content is deleted before migration
   - Card layout remains reusable for future nodes and future skills

### Technical notes

- No table migration is required for the new angle metadata if it is stored inside the existing `reference_calibrations` JSON structure and a new node-level text field is mapped onto existing node JSON/text storage.
- A schema migration is only necessary if you want `skill_specific_filming_notes` as a dedicated database column instead of storing it within existing node text/JSON fields.
- The safer first implementation is:
  - keep per-angle additions inside `reference_calibrations`
  - map the new node-level filming-notes UI onto existing node-level filming guidance storage
  - preserve backward compatibility for existing nodes with missing new fields
