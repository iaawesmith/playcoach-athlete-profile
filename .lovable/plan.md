

## Dynamic Center Preview Column

Add an `activeSection` field to the Zustand store, wire SideNav clicks to change it, and conditionally render ProCard or a placeholder panel in the center column.

### 1. Add `activeSection` to `athleteStore.ts`

- New field: `activeSection: "identity" | "highlights" | "develop" | "stats" | "connect"` (default `"identity"`)
- Add to `AthleteState` interface
- Expose via `setActiveSection: (section: string) => void` action
- Exclude from `AthleteData` (not athlete data, it's UI state — does not trigger dirty marking)

### 2. Wire `SideNav.tsx` — Clickable Navigation

- Import `useAthleteStore`, read `activeSection` and `setActiveSection`
- Remove hardcoded `active: true/false` from `navItems` — derive active state by comparing `item.key` to `activeSection`
- Add a `key` field to each nav item matching the store values (`"identity"`, `"highlights"`, `"develop"`, `"stats"`, `"connect"`)
- On click, call `setActiveSection(item.key)`

### 3. Update `BuilderLayout.tsx` — Conditional Preview

- Read `activeSection` from the store
- Derive preview label: `"Identity Preview"`, `"Highlights Preview"`, etc.
- When `activeSection === "identity"`: render `<ProCard />` as now
- When any other section: render a placeholder panel with same container styling (same dimensions, same dark surface, radial gradient) with centered text: `"[Section] Preview coming soon"` — styled with `text-on-surface-variant`, `uppercase`, `tracking-widest`, `text-sm`, and a Material Symbol icon above

### 4. Wire `MobileNav.tsx` — Same Pattern

- Import `useAthleteStore`, read `activeSection` and `setActiveSection`
- Wire bottom tab clicks to `setActiveSection`

### Files modified
- `src/store/athleteStore.ts`
- `src/features/builder/components/SideNav.tsx`
- `src/features/builder/BuilderLayout.tsx`
- `src/features/builder/components/MobileNav.tsx`

