# Phase 1c.1 Slice 3 — Outcome

**Status:** Shipped to test/preview. Verification 12/12 passing.

**Scope:** Expose `athlete_lab_nodes.position` (existing column, edge function
already wired) as an editable Basics-tab dropdown. Pure UI surface — no
schema, no edge, no Claude.

---

## What shipped

### 1. Expanded type system (`src/features/athlete-lab/types.ts`)

- **New const `POSITION_OPTIONS`** — readonly tuple of 11 football positions:
  `QB, RB, WR, TE, OL, DL, LB, CB, S, K, P`. Order follows the project-wide
  stat map (offense skill → line → defense → specialists).
- **New type `PositionValue`** — derived from `POSITION_OPTIONS`.
- **`TrainingNode.position` widened** from `NodePosition | null` (3 values)
  to `PositionValue | null` (11 values).
- **`NodePosition` retained** as the legacy 3-value sidebar grouper. Its
  responsibility narrowed (sidebar tabs/picker only); editor uses
  `PositionValue`.

### 2. Basics tab Identity row (`NodeEditor.tsx`)

- Top of Basics tab now renders a 2-column grid: `Route / Skill Name | Position`.
  Stacks on widths below `lg`.
- Position is a native `<select>` styled with `INPUT_CLASS` (matches existing
  Athlete Lab inputs — same approach as the existing selects on lines 1321,
  2269, 2975).
- "— None —" option writes `null`. All 11 `POSITION_OPTIONS` rendered as
  abbreviations (no descriptive secondary text — matches the stat map
  terminology used everywhere else).
- Tooltip text: *"The football position this node teaches skills for. Used
  by the prompt template (`{{position}}`) and by the sidebar position
  filter. Optional — leave unset for position-agnostic nodes."*

### 3. Save flow (`NodeEditor.save`)

- `position: draft.position` added to the `updates` payload alongside `name`,
  `overview`, etc. Standard Basics tab pattern (draft → Save Changes
  round-trip), batched with all other dirty fields in a single
  `updateNode()` call.
- Position changes flip `dirty=true` via the existing `update()` callback —
  enables the Save button, allows Discard to revert, and participates in the
  same auto-draft-on-save behavior as every other Basics field on a Live
  node.

### 4. Sidebar safety (`NodeSidebar.tsx`)

- `POSITION_COLORS` was previously typed `Record<NodePosition, string>` and
  accessed unsafely as `POSITION_COLORS[node.position]`. With the widened
  position type, a node with `position = "TE"` would have read `undefined`
  and rendered the pill with broken colors.
- Introduced `positionPillColor(pos)` that falls back to the
  `outline-variant` neutral tone when the position is outside the 3-color
  map. The pill now renders correctly for all 11 positions; designing a
  full 11-color palette + sidebar tab redesign is **out of slice 3 scope**
  and tracked as backlog.

---

## Verification summary

Mechanical suite at `scripts/verification/slice3_verify.ts`. **12/12 passing.**

```
V1 — Round-trip persistence (3 + snapshot/restore)
  ✓ V1.1 set position='TE' persists and reads back
  ✓ V1.2 set position=NULL persists and reads back
  ✓ V1.3 position writes only via save() payload (single source-level write site)
V2 — Dirty state integration (4)
  ✓ V2.1 position onChange routes through update('position', ...)
  ✓ V2.2 update callback flips dirty=true
  ✓ V2.3 Save button disabled gating uses !dirty
  ✓ V2.4 position batched with name+others in single save() payload
V3 — Edge function consumption regression (2)
  ✓ V3.1 pipeline wires nodeConfig.position into {{position}} template variable
  ✓ V3.2 TrainingNode.position widened to PositionValue | null
V4 — UI smoke (3)
  ✓ V4.1a POSITION_OPTIONS contains 11 entries
  ✓ V4.1b dropdown maps POSITION_OPTIONS + includes — None — option
  ✓ V4.2 dropdown is controlled by draft.position
```

V1 uses the Supabase JS client (table RLS = "Allow all access") for writes,
psql for reads. V2/V3/V4 are static-source assertions against the actual
files shipped (no test doubles, no mocks).

**V3.1 specifics:** the `{{position}}` substitution lives in
`supabase/functions/analyze-athlete-video/index.ts` (the production
pipeline), not in `athlete-lab-analyze` (the admin test fixture path). The
pipeline maps `nodeConfig.position` into the template variable — same
wiring slice 1 verified end-to-end against Slant. Slice 3 widening
`TrainingNode.position` from a 3-value union to an 11-value union does not
change this contract; the edge function reads the raw text column and
substitutes verbatim.

---

## Slant final state

Slant.position = **WR** ✅ (verified via psql against the live DB).

**Note on Slant pre-state:** the slice 3 plan flagged that Slant.position
was `null` per the user's understanding. When verification began, Slant was
already `WR` in the DB — likely set out-of-band between the slice 2 ship
message and slice 3 kickoff. The post-verification step ("set Slant.position
= WR via the new UI") was therefore idempotent rather than a state change;
the verification suite explicitly cycled `TE → NULL → WR` to prove the
round-trip works against a real DB write before restoring the original
value. End-state is correct either way.

---

## Out of slice 3 scope (tracked)

1. **Sport diversification** — the 11-position list is football-only. When
   PlayCoach expands beyond football, the position field needs to become
   sport-aware (probably driven off a sport column on the node). Backlog
   item flagged at user approval, comment in `types.ts`.

2. **Sidebar position-tab redesign** — the sidebar currently has 3 hardcoded
   tabs (`All / WR / QB / RB`). Nodes with non-WR/QB/RB positions are only
   visible under `All`. Designing a richer filter UI (probably a position
   group selector) is UX work, not slice 3. The pill color fallback ensures
   no crash in the meantime.

3. **`solution_class` placement** — the slice 3 plan's D1 question raised
   the eventual co-location of `solution_class` next to Name/Position once
   1c.2 deletes it from Training Status. The current Identity row is
   `Name | Position` (2-col); it can collapse or expand cleanly without
   layout rework when 1c.2 lands.

4. **`POSITION_COLORS` palette** — only 3 of 11 positions have explicit
   colors. Inheriting from the sidebar redesign (item 2 above).

---

## Files touched

- `src/features/athlete-lab/types.ts` — added `POSITION_OPTIONS` /
  `PositionValue`, widened `TrainingNode.position`.
- `src/features/athlete-lab/components/NodeEditor.tsx` — Identity row UI,
  position in save payload, import.
- `src/features/athlete-lab/components/NodeSidebar.tsx` — safe color
  lookup with neutral fallback.
- `docs/phase-1c1-slice3-outcome.md` — this file.
- `scripts/verification/slice3_verify.ts` — verification suite (committed for re-runs).

No edge function changes. No DB schema changes. No `supabase/types.ts`
changes (the column was already in the generated types from prior slices).
