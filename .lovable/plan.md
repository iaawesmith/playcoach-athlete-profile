

## Rename Navigation Sections

Replace `highlights` → `performance` and `stats` → `pulse` across all files. No new files needed.

### Changes

**`src/store/athleteStore.ts`**
- Update `ActiveSection` type: `"identity" | "performance" | "develop" | "pulse" | "connect"`

**`src/features/builder/components/SideNav.tsx`**
- Update navItems:
  - `highlights` → `{ key: "performance", icon: "sports_score", label: "Performance" }`
  - `stats` → `{ key: "pulse", icon: "monitoring", label: "Pulse" }`

**`src/features/builder/BuilderLayout.tsx`**
- Update `sectionLabels`: rename `highlights` → `performance` ("Performance Preview"), `stats` → `pulse` ("Pulse Preview")
- Update `sectionIcons`: rename `highlights` → `performance`, `stats` → `pulse`

**`src/features/builder/components/MobileNav.tsx`**
- Replace `stats` → `{ key: "pulse", icon: "monitoring", label: "Pulse" }`

### Files modified
- `src/store/athleteStore.ts`
- `src/features/builder/components/SideNav.tsx`
- `src/features/builder/BuilderLayout.tsx`
- `src/features/builder/components/MobileNav.tsx`

