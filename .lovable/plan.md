

## Merge Overview into Basics — Safe & Reversible

Move the Overview field into the Basics tab as a prominent description block, then permanently hide the standalone Overview tab. The `overview` database column and all reads/writes of it stay exactly as today — only the editor UI changes.

---

### How the Basics tab will look after the merge

```
BASICS
─────────────────────────────────────────────
Route / Skill Name                          ⓘ
[ Slant Route                              ]

────────────────────────────────────────────
Icon / Visual Diagram                       ⓘ
[icon] [ Upload / Replace ]

────────────────────────────────────────────
Description / Overview                      ⓘ          ← NEW position
Athlete-facing intro shown at the top of the
training feed before they film. 2–3 sentences.
┌──────────────────────────────────────────┐
│  The slant route is a quick inside-      │
│  breaking route used to exploit zone     │
│  coverage gaps...                        │
│                                          │   ← min-h 220px,
│                                          │     resize-y, larger
│                                          │     than today's tab
└──────────────────────────────────────────┘

────────────────────────────────────────────
Clip Duration                               ⓘ
[ Min: 5 sec ]   [ Max: 30 sec ]

────────────────────────────────────────────
Node Version  v3              Last Saved  Apr 24, 2026
```

The new field uses the same `LABEL_CLASS` heading style as siblings, with a one-line helper subtitle underneath the label so its purpose is obvious without opening the tooltip. The textarea sits at `min-h-[220px]` (slightly larger than the old standalone tab's 200px) and uses `resize-y` so coaches can expand it. Same surface and ghost-border styling as other Basics inputs.

Order in Basics, top to bottom:
1. Route / Skill Name
2. Icon / Visual Diagram
3. **Description / Overview** ← inserted here
4. Clip Duration
5. Version footer

---

### Files to be modified (UI only)

| File | Change |
|---|---|
| `src/features/athlete-lab/components/NodeEditor.tsx` | (a) Insert the Description / Overview block inside the `tab === "basics"` panel between the Icon section and Clip Duration. (b) Delete the `tab === "overview"` JSX panel (the textarea moves, not duplicated). (c) Remove the `"overview"` entry from the `TABS` array so it never renders in the tab row. (d) Remove `"overview"` from the `TabKey` union type. (e) If the persisted `tab` state ever lands on `"overview"` from an older session, fall back to `"basics"` (one-line guard in the existing tab-normalization effect, line ~438). |
| `src/features/athlete-lab/components/NodeReadinessBar.tsx` | Remove `"overview"` from the local `TabKey` union type (no other references — readiness logic never required Overview content). |
| `src/features/athlete-lab/utils/nodeExport.ts` | Remove `"overview"` from the local `TabKey` union, the `TAB_GENERATORS` map, the `TAB_LABELS` map, and the `tabOrder` array. **Keep `generateOverview()` working but inline its output into `generateBasics()`** so the exported markdown still contains the overview text under the Basics section heading — no information loss in exports. |
| `src/features/athlete-lab/components/EnhancementsTab.tsx` | Drop `"Overview"` from the `TAB_OPTIONS` list and its tag color map. (Cosmetic only — does not delete any existing enhancement records that reference "Overview"; they continue to render with a default tag style.) |
| `src/features/athlete-lab/components/DataDictionaryTab.tsx` | Drop the `Overview` entry from the local label/color map. Same cosmetic guard as above. |

No other files touched. The Save handler at line 503 (`overview: draft.overview,...`) stays exactly as-is — the field reads from and writes to `draft.overview` from its new home in Basics.

---

### What stays exactly the same

- **Database:** `athlete_lab_nodes.overview TEXT NOT NULL DEFAULT ''` — column, default, RLS, and every row's content untouched. **No migration.**
- **Type system:** `TrainingNode.overview: string` in `src/features/athlete-lab/types.ts` is unchanged.
- **Pipeline:** the edge function (`analyze-athlete-video`) and `athlete-lab-analyze` already do not depend on Overview content for scoring — no change.
- **LLM prompt variables:** `overview` continues to be available to the prompt template via the same `draft.overview` value.
- **Athlete-facing rendering:** any consumer that reads `node.overview` continues to work.
- **Show Advanced Tabs toggle:** unchanged. As required, Overview is **not** added to `ADVANCED_TAB_KEYS` — turning Advanced Tabs ON does not bring back the Overview tab. The data lives in Basics permanently.

---

### Note on "rich text"

The current Overview tab uses a plain `<textarea>` (line 863), not a rich-text editor. To honor the principle "Keep the full rich text editor functionality," the merged field preserves the same textarea contract (multi-line, unlimited length, `resize-y`) at a slightly larger default height. If you want a true rich-text editor (bold/italic/lists), say the word and I'll add it as a separate enhancement — it would be a new dependency and is intentionally out of scope here to keep this change reversible and zero-risk.

---

### Reversibility

To restore Overview as its own tab later:
1. Re-add `"overview"` to the `TABS` array, `TabKey` union, and the `nodeExport.ts` maps.
2. Move the Description / Overview JSX block from inside the `basics` panel back into a `tab === "overview"` panel.
3. The DB column and every row's text are still there — nothing to migrate.

Total revert: ~15 lines across the same files.

---

### Safety guarantees

1. **No data deleted.** No SQL, no migrations, no column drops, no row updates.
2. **Field contract preserved.** Same `draft.overview` → `update("overview", …)` → save path.
3. **Exports preserved.** `nodeExport.ts` still emits the overview text (folded under the Basics heading) so AI prompts and audit exports lose nothing.
4. **No pipeline impact.** The edge function never required the Overview tab to exist.
5. **Old sessions safe.** A user whose `tab` state is `"overview"` (from a prior session) is auto-routed to `"basics"` on next render.

---

### Approval checkpoint

Please confirm before build:
1. **Field label** — `Description / Overview` (recommended) or `Route Story`?
2. **Helper subtitle under the label** — keep the one-line helper (recommended) or icon-only tooltip like the other Basics fields?
3. **Plain textarea is fine for now** (matches today's behavior) — or do you want a true rich-text editor added in this same change?

Once you approve, I'll switch to Build mode and apply exactly the changes above.

