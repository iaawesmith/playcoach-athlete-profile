

## Update Phases Tab — Hide Checkpoint-Triggered Behind Advanced Tabs

Make "Proportional" the only visible segmentation method when Advanced Tabs is OFF. Keep all Checkpoint-triggered logic intact in the codebase so the existing toggle re-enables it instantly, with zero data loss.

---

### How it will look

**Advanced Tabs = OFF (default, current state):**
```
Segmentation Method   ⓘ
┌─────────────────────────────────────────┐
│  ●  Proportional                        │   ← single locked option
└─────────────────────────────────────────┘
Advanced segmentation coming soon when Advanced Tabs is enabled.
```
The Checkpoint-triggered button is not rendered. The current value is forced to `"proportional"` for the editor session.

**Advanced Tabs = ON:**
```
Segmentation Method   ⓘ
┌────────────────────┬────────────────────┐
│  Proportional      │ Checkpoint-triggered│   ← original two-button toggle
└────────────────────┴────────────────────┘
```
Identical to today's UI — full functionality restored.

---

### Files to be modified

| File | Change |
|---|---|
| `src/features/athlete-lab/components/NodeEditor.tsx` | (1) Pass `advancedEnabled={showAdvancedTabs}` into `<PhasesEditor>` at line 906–913. (2) Inside `PhasesEditor` (line ~1864–1879), branch the segmentation selector: when `advancedEnabled` is false, render a single locked "Proportional" pill + helper text and skip the Checkpoint button. When true, render today's two-button toggle unchanged. (3) When the editor mounts/draft loads with `advancedEnabled === false` and `segmentation_method === "checkpoint"`, normalize the in-memory draft to `"proportional"` so the UI and readiness checks stay consistent. The DB value is only overwritten if the user clicks Save (same as any other field edit). |

That's the only file touched.

---

### What stays exactly the same

- **All checkpoint code paths**: `CheckpointsEditor`, `checkCheckpointCompleteness`, `migrateCheckpoints`, the `"checkpoint"` branch inside `NodeReadinessBar.tsx`, the `nodeExport.ts` checkpoint branches — every line of logic is preserved.
- **`SegmentationMethod` type** and `onSegmentationMethodChange` prop — unchanged signatures.
- **DB column `segmentation_method`** — no schema change, no migration. Existing checkpoint nodes keep their value in the database; advanced users can flip Advanced Tabs on and continue editing them.
- **All other nodes** — same toggle applies globally; no data is touched.
- **The Checkpoints tab itself** — already hidden behind Advanced Tabs (no change needed).

---

### Default behavior for new + existing nodes

- New nodes: `segmentation_method` already defaults to `"proportional"` in the DB column default and in the type system, so they require no migration.
- Existing nodes already on `"proportional"`: no visible change at all.
- Existing nodes on `"checkpoint"` (none in current data based on the Slant migration we just shipped, but possible in the future): when a non-advanced user opens them, the editor will display "Proportional" and warn nothing breaks; they must save to persist the change. If they never save, the DB value stays `"checkpoint"`.

---

### Safety guarantees

1. **No deletions.** Zero code paths or DB fields removed.
2. **One-toggle reversibility.** Flip Advanced Tabs ON → original two-button selector returns and any node with `"checkpoint"` value resumes its checkpoint behavior.
3. **Pipeline parity.** The edge function reads `segmentation_method` directly from the saved node — whatever the user saves is what the pipeline runs.
4. **Respects the existing global toggle** added in the previous simplification pass — uses the same `showAdvancedTabs` state, same `localStorage` key (`athleteLab.showAdvancedTabs`), no new toggle introduced.

---

### Approval checkpoint

Please confirm before build:
1. **Locked-option styling** — single "Proportional" pill highlighted in primary-container green (recommended) is fine, vs. a disabled gray Checkpoint button shown alongside it?
2. **Auto-normalize draft on open** — when a non-advanced user opens a node currently saved as `"checkpoint"`, should the editor (a) silently treat it as proportional in the UI without dirtying the form, or (b) mark the form dirty so Save persists the change? Recommended: **(a)** — no surprise writes; user must explicitly edit and save.

Once you approve, I'll switch to Build mode and apply exactly the changes above.

