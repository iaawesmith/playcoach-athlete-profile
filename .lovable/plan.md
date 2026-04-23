
Implement a focused export-audit pass for Athlete Lab so every tab’s copy output and the full node export reflect the current editable fields.

### Audit findings

Current export coverage is out of sync with the editor in several places:

- Scoring tab: `scoring_rules` is editable but not exported in `generateScoring()`
- Metrics tab: metric `description` and `keypoint_mapping.body_groups` are editable but not exported
- Checkpoints tab: checkpoint `description` is editable but not exported
- Reference tab:
  - `reference_filming_instructions` is editable but not exported
  - tab-specific `skill_specific_filming_notes` is stored in `camera_guidelines` and currently appears under Camera export instead of Reference
- Copy All Node currently inherits those same omissions because it reuses the tab generators
- Full node export also omits `knowledge_base` / tab help content even though it is stored on the node; this should be explicitly decided during implementation rather than left accidental

### What will change

1. Build a field-to-export audit matrix
   - Compare each editable tab against its generator in `src/features/athlete-lab/utils/nodeExport.ts`
   - Use the visible NodeEditor tab sections plus sub-editors as source of truth
   - Mark each field as:
     - exported correctly
     - exported in wrong tab
     - missing from tab export
     - intentionally excluded

2. Align each tab export with the tab UI
   - Basics: confirm current coverage is complete
   - Videos: confirm current coverage is complete
   - Overview: confirm current coverage is complete
   - Phases: confirm current coverage is complete
   - Mechanics: confirm current coverage is complete
   - Metrics: add missing metric description and body group output
   - Scoring: add scoring formula description and preserve current confidence/band settings
   - Errors: confirm current coverage is complete
   - Reference: add missing fallback filming instructions and move/reference skill-specific filming notes so the Reference copy reflects what the user sees on that tab
   - Camera: keep only camera-owned settings and avoid duplicating Reference-owned copy unless useful as a cross-reference
   - Checkpoints: add missing checkpoint description
   - Prompt: confirm current coverage is complete
   - Badges: expand export if needed so operator/custom-condition details are unambiguous
   - Training Status: confirm current coverage is complete

3. Fix full node export consistency
   - Update `generateFullNodeMarkdown()` so it automatically includes the corrected tab outputs
   - Ensure the full export is complete for audit purposes without losing readability
   - Add a dedicated final section for intentionally non-tab data if needed

4. Decide and handle associated non-visual node fields
   - Review whether `knowledge_base` should appear in Copy All Node
   - If included, add a clearly labeled “Admin Guidance / Knowledge Base” section grouped by tab
   - If excluded, document that exclusion in the export header so audit users know it is intentional

5. Preserve copy button behavior
   - Keep `NodeEditor` copy-tab behavior unchanged in UX
   - Keep `NodeReadinessBar` “Copy Node” behavior unchanged in UX
   - Only improve underlying markdown completeness and correctness

### Files to update

- `src/features/athlete-lab/utils/nodeExport.ts`
- Possibly `src/features/athlete-lab/components/NodeEditor.tsx` only if a small label/help tweak is needed after the audit
- Possibly `src/features/athlete-lab/components/NodeReadinessBar.tsx` only if the full-export description should clarify included sections

### Technical details

Audit source-of-truth mapping will be based on these editor surfaces:

- `NodeEditor.tsx`
- `KeyMetricsEditor.tsx`
- `CheckpointsEditor.tsx`
- `CameraEditor.tsx`
- `LlmPromptEditor.tsx`
- `BadgesEditor.tsx`

Primary implementation work will be in:

- `generateMetrics()`
- `generateScoring()`
- `generateReference()`
- `generateCheckpoints()`
- `generateFullNodeMarkdown()`

### Validation

1. For every tab except Run Analysis, click Copy Tab and verify every editable field on that tab appears in the markdown
2. Click Copy Node and verify the combined export contains all tab fields with no missing sections
3. Confirm Reference vs Camera ownership is clear and no field is silently dropped
4. Confirm the markdown stays readable for audit/review use, not just technically complete
5. Confirm no tab copy throws and no copy button UX changes regress
