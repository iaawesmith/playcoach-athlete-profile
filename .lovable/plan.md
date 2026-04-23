

# Simplify Slant Node — Safe & Reversible Plan

Reduce visible complexity in AthleteLab to exactly the 4 core metrics and the essential tabs, while preserving every existing record, field, and linkage in the database. Nothing gets deleted. A new "Show Advanced Tabs" toggle lets us flip everything back on instantly.

---

## What stays exactly the same

- **All database tables, columns, RLS policies, and edge functions** — no migrations, no schema changes.
- **Every metric object on the Slant node** — Head Snap Timing and Post-Catch YAC Burst remain in `key_metrics` JSONB with all keypoint mappings, phase IDs, bilateral settings, confidence thresholds, temporal windows, etc. intact.
- **All 5 phases** in `phase_breakdown` with their IDs (so existing metric→phase links stay valid).
- **All checkpoints, errors, calibrations, badges** — untouched in the DB.
- **Pipeline behavior** for the 4 active metrics — unchanged. The Cloud Run + edge function pipeline continues to consume `key_metrics` as it does today.

---

## Change 1 — Introduce a non-destructive `active` flag on metrics

**File:** `src/features/athlete-lab/types.ts`

Add one optional field to `KeyMetric`:

```ts
active?: boolean;   // default true when missing
```

This is purely additive. Existing metrics with no `active` field are treated as active (backward compatible). Setting `active: false` deactivates a metric without deleting it.

---

## Change 2 — Filter inactive metrics out of UI + scoring (but keep them stored)

**File:** `src/features/athlete-lab/components/NodeEditor.tsx`

- In the `metrics` tab, pass only `active !== false` metrics to `KeyMetricsEditor` for display, but write back the full list (active + inactive merged) on change.
- Add a small "Hidden metrics (2)" expandable row at the bottom of the metrics tab listing the deactivated ones with a "Reactivate" button — so they're never lost from view.
- Update the **completeness check** (`checkCompleteness`) and `NodeReadinessBar` to evaluate weights/keypoints **only on active metrics** (active weights must sum to 100, min 4 active).

**File:** `src/features/athlete-lab/components/KeyMetricsEditor.tsx`

- Add a "Deactivate" action (eye-slash icon) on each metric card that sets `active: false` instead of deleting.
- Existing Delete still works but is left as-is.

**Pipeline safety:** The edge function (`supabase/functions/analyze-athlete-video/index.ts`, `calculateAllMetrics` at line ~2063) will receive the full `key_metrics` array including inactive ones. To guarantee the pipeline only scores the 4 core metrics, we'll filter `active !== false` **once** at the top of `calculateAllMetrics` (single 1-line change). This keeps the data intact while making sure scoring matches the UI.

---

## Change 3 — Seed the Slant node to the 4-core configuration

**One-time migration via the migration tool** (data-only, fully reversible by flipping the flags back):

For the Slant node only:
- Set `active: true` on:
  - **Break Angle** → weight `25`
  - **Release Speed** → weight `20`
  - **Hands Extension at Catch** → weight `15`
  - **Separation Distance** → weight `15`
- Set `active: false` on:
  - **Head Snap Timing**
  - **Post-Catch YAC Burst**
- The 4 active weights total **75%**. Per your instruction the active set is exactly these 4 metrics — readiness will flag "weights must sum to 100" until you adjust. Two clean options (please pick one when approving):

```text
Option A — keep your exact percentages, raise readiness to allow <100:
   Treat 75% as the new "100% of active scoring" (renormalize internally).

Option B — auto-rescale the 4 weights to sum to 100:
   Break Angle 33 / Release Speed 27 / Hands Extension 20 / Separation 20
```

Default if you don't pick: **Option A** (preserves your stated weights verbatim; renormalization already exists via `scoring_renormalize_on_skip`).

- Set `segmentation_method = 'proportional'` on the Slant node (already the case — confirmed in code default, will just persist explicitly).
- **No phases changed.** All 5 stay. Metric→phase IDs preserved.

---

## Change 4 — Fold Mechanics content into Phase descriptions

**File:** `src/features/athlete-lab/components/NodeEditor.tsx` (UI hide only)

The current `pro_mechanics` field is JSON: `MechanicsSection[]` where each section has `phase_id` + `content`.

Plan:
1. **Append** each mechanics section's `content` to the matching phase's `description` in `phase_breakdown`, prefixed with `\n\n— Coaching cues —\n` so it's clear in the Phases tab.
2. **Keep `pro_mechanics` JSON in the DB exactly as-is** (untouched). If the Mechanics tab is ever re-shown, it still works.
3. Hide the Mechanics tab from the tab row (see Change 5).

This is fully reversible: if you re-enable Mechanics, the original sections are still there.

---

## Change 5 — Hide tabs (preserve all data) + add "Show Advanced Tabs" toggle

**File:** `src/features/athlete-lab/components/NodeEditor.tsx`

- Add UI state `showAdvancedTabs` (persisted to `localStorage` as `athleteLab.showAdvancedTabs`, default `false`).
- Add a small toggle in the node title bar (next to the Save button): `⚙ Advanced Tabs`.
- Define two tab sets:

```text
CORE_TABS (always visible):
  Basics · Videos · Overview · Phases · Metrics · Camera ·
  LLM Prompt · Training Status · Badges · Run Analysis

ADVANCED_TABS (hidden unless toggled):
  Mechanics · Errors · Checkpoints · Reference (full calibration) · Scoring
```

- The `TABS` array stays intact; rendering filters by toggle.
- If a user is on a hidden tab when toggling off, jump back to `basics`.
- All existing tab editors and data flows are untouched.

Note on **Reference**: Your spec says "basic info stays in Camera tab." The Camera tab already surfaces calibration basics via `parseCameraSettings` / `skill_specific_filming_notes`. We only hide the full `ReferenceCalibrationEditor` tab — the underlying `reference_calibrations` JSONB stays in the DB and remains editable when Advanced Tabs is on.

---

## Files to be modified

| File | Change |
|---|---|
| `src/features/athlete-lab/types.ts` | Add optional `active?: boolean` to `KeyMetric` |
| `src/features/athlete-lab/components/NodeEditor.tsx` | Tab visibility filter, Advanced Tabs toggle, completeness check uses active-only metrics, pass active-only to `KeyMetricsEditor` |
| `src/features/athlete-lab/components/KeyMetricsEditor.tsx` | Add Deactivate action + "Hidden metrics" reactivation row |
| `src/features/athlete-lab/components/NodeReadinessBar.tsx` | Evaluate readiness on active-only metrics |
| `supabase/functions/analyze-athlete-video/index.ts` | One-line filter `metrics.filter(m => m.active !== false)` at the top of `calculateAllMetrics` |
| **DB migration** (data only) | Set `active` flags on the Slant node's 6 metrics; persist `segmentation_method='proportional'`; append mechanics content into matching phase descriptions |

---

## Files explicitly NOT changed

- `supabase/functions/athlete-lab-analyze/index.ts` — node-config introspection only, no scoring path.
- `src/integrations/supabase/types.ts`, `src/integrations/supabase/client.ts` — auto-generated.
- `MechanicsEditor`, `CheckpointsEditor`, `CommonErrorsEditor`, `ReferenceCalibrationEditor`, `ScoringEditor` — code stays so Advanced Tabs still works.
- All other nodes (only Slant gets the data flag changes).

---

## Safety guarantees

1. **No DELETE statements anywhere.** Only `UPDATE` of JSONB fields adding `active` flags.
2. **All metric→phase IDs preserved** (we don't touch phase IDs or metric `keypoint_mapping.phase_id`).
3. **Backward compatible:** any node without `active` flags behaves exactly as today.
4. **Reversible in one click:** flip Advanced Tabs on → re-activate hidden metrics → original 6-metric configuration is fully restored, with original weights and mappings intact.
5. **Pipeline parity:** the same active metrics shown in the UI are the exact ones scored by the edge function — no drift.

---

## Approval checkpoint before build

Please confirm:
1. **Weight strategy** — Option A (keep 25/20/15/15 = 75% and let renormalization handle it) or Option B (auto-rescale to sum to 100)?
2. **Mechanics fold-in** — append to phase `description` (recommended) or replace?
3. Anything to add/remove from the visible tab list above?

Once you approve, I'll switch to Build mode and execute exactly the changes above.

