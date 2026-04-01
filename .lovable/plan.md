

## Draft / Live Status Indicator & Publish Flow

A two-state system that tells the athlete whether their public profile reflects their current edits or not.

### Concept

Two states: **Draft** and **Live**.

- **Draft** — profile has never been published, or has unsaved changes since last publish. Amber dot, "Draft" label. CTA reads "Go Live" (first publish) or "Publish Changes" (subsequent).
- **Live** — profile matches what's publicly visible. Green pulsing dot, "Live" label. CTA becomes disabled/muted "Published" state. Share button appears fully active.

When the athlete edits any field while in "Live" state, status flips to "Draft" automatically. No manual toggle.

### Changes

**1. `src/store/athleteStore.ts`** — Add publish state

Add two fields to the store:
- `profileStatus: "draft" | "live"` (default `"draft"`)
- `publishProfile: () => void` — sets status to `"live"`
- `markDirty: () => void` — sets status to `"draft"` (called on any field edit)

Extend the existing `setAthlete` action to automatically call `markDirty` when any data changes while status is `"live"`. This keeps it automatic — no manual state management needed from form components.

**2. `src/features/builder/components/ProCard.tsx`** — Status indicator + CTA

Read `profileStatus` from the store. Update two areas:

**Status indicator (top-right of card header):**
- Draft: amber dot (`bg-amber-400`, no pulse) + "Draft" text in `text-amber-400`
- Live: green pulsing dot (`bg-primary animate-pulse`) + "Live" text in `text-primary`

**CTA button below card:**
- Draft: active kinetic-gradient button reading "Go Live" (or "Publish Changes" if previously published). Calls `publishProfile()` on click.
- Live: muted glass-card button reading "Published" with a checkmark icon, visually de-emphasized (not clickable or styled as disabled).

**Share button:**
- Draft: reduced opacity (`opacity-40`) with `pointer-events-none` — can't share what isn't live.
- Live: full opacity, interactive as current.

**3. `src/features/builder/components/IdentityForm.tsx`** — No changes needed yet

Since fields are static/uncontrolled (Session 1–2), the dirty-marking won't fire until Session 3 when we wire inputs to the store. The system is ready for it, but nothing changes here now.

### Files modified
- `src/store/athleteStore.ts`
- `src/features/builder/components/ProCard.tsx`

### What this does NOT include
- No Cloud/database persistence (Session 3)
- No actual public URL generation
- No toast/confirmation on publish
- Form fields remain static — dirty detection wires up in Session 3

