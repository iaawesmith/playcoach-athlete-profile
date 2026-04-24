

## Fix Live/Draft confusion in AthleteLab Node Editor

Two real problems, one clean fix.

---

### Problem 1 — Saves on a Live node sometimes leave status as "Live" when they shouldn't

Today, auto-draft on save only fires when the user edits fields routed through `updateWithCriticalTrack`. That covers Metrics, Scoring, Phase data, LLM Prompt, and Training Status. **Everything else** — Basics, Videos, Camera, Badges, phase descriptions, segmentation method, clip duration, reference calibrations, errors, checkpoints, mechanics — saves while keeping the node Live with no warning. Since most of those still affect the athlete experience or the analysis pipeline (e.g. reference videos, camera guidelines, phase narratives, clip duration, badges shown to athletes), an admin reasonably expects re-validation.

The mismatch you're seeing — sidebar shows amber while header says "Live" — is the symptom of this split: the editor `draft` and the parent `node` go out of sync briefly after save when one path auto-drafts and the other doesn't.

**Fix: any save on a Live node auto-bumps it to Draft.**

- Replace the conditional `shouldAutoDraft = node.status === "live" && criticalChanged.current` with `shouldAutoDraft = node.status === "live"`.
- Remove the `criticalChanged` ref and `updateWithCriticalTrack` wrapper entirely (replace all 20+ call sites with plain `update`). Less code, no field-by-field opt-in to track, no possibility of drift.
- Toast copy becomes: *"Saved — node moved to Draft. Review the readiness checks and re-activate when ready."*
- Sidebar amber/green dot already reads `node.status`, so once the parent `onUpdated(updated)` fires with `status=draft`, all three indicators (sidebar dot, header chip, readiness bar button) update together in the same render.

This is the safest behavior for the pipeline: a saved Live node always gets human re-confirmation before athletes upload against the new config.

---

### Problem 2 — Two status buttons doing the same thing

Both buttons call `handleStatusToggle` and open the same modal:
- **Header chip** (NodeEditor.tsx line 611): pill showing "Live"/"Draft" with a chevron.
- **Readiness bar button** (NodeReadinessBar.tsx line 299): "Set Live" / "Set to Draft" with rocket/pause icon.

**Fix: remove the header chip's toggle behavior; keep the readiness bar as the single Live/Draft control.**

- The header chip becomes a **read-only status badge** (no `onClick`, no chevron, no hover state). It still shows current status at a glance because it's always visible at the top of the editor — useful context, just not a control.
- The readiness bar button stays as the only place to flip Live/Draft. It's the right home because:
  - It already enforces the "score must hit 100% to go Live" gate (header chip didn't show that gate, leading to the second source of confusion).
  - It sits directly under the readiness checklist, so admins make the decision in context.
  - It shows the pause/rocket affordance with the correct disabled state.
- Title-bar order after the change: `[icon] [Node Name]   [status badge] [Advanced Tabs] [Save Node]`.

---

### Files modified

| File | Change |
|---|---|
| `src/features/athlete-lab/components/NodeEditor.tsx` | (a) Drop `criticalChanged` ref + `updateWithCriticalTrack`; replace ~20 call sites with `update`. (b) Simplify `save()` — auto-draft on every Live save. (c) Update toast copy. (d) Convert header status pill (line 611–622) to a read-only badge: remove `onClick`, remove `cursor-pointer hover:brightness-110 active:scale-95`, remove the `expand_more` chevron. |
| `src/features/athlete-lab/components/NodeReadinessBar.tsx` | No code change. Single source of truth confirmed for the Live/Draft control. |

---

### What stays the same

- Database `status` column, RLS, and all server-side checks — untouched.
- The `StatusModal` for go-live / go-draft / blocking — same component, same flows.
- The readiness gate (must hit 100% to go Live) — unchanged.
- The sidebar amber/green dot — unchanged; will now be in sync because every save path produces the same status.
- All field editors and their `update(...)` calls keep working; we're just removing the wrapper that tagged "critical" fields.

---

### Why this is the right call

- **One source of truth for status:** every save on a Live node returns to Draft. No more "did my edit count as critical?" guessing.
- **One button for status:** eliminates the duplicate control that's currently confusing you, without losing visibility (badge still visible up top).
- **Pipeline safety:** prevents the exact friction you flagged — saving, assuming Live, uploading a video, and the analysis running against an unintended config.
- **Reversible:** if you ever want a "minor edit, stay Live" path, we can re-introduce a single explicit "Save & keep Live" secondary action — but that's an additive future choice, not a regression.

