

## Make onboarding selection cards shorter

The Role Selection and Athlete Tier cards currently use `min-h-[280px]` and `py-8` with a grid template that has extra space. The Sport Selection cards use `p-6` with flex layout and are already more compact.

### Changes

**RoleSelection.tsx and AthleteTier.tsx:**
- Reduce `min-h-[280px]` → `min-h-[180px]`
- Reduce `py-8` → `py-5`
- Tighten the grid row template from `grid-rows-[64px_28px_40px_1fr]` → `grid-rows-[48px_24px_32px_1fr]` (smaller icon area, tighter label/description rows)
- Reduce icon size from `text-5xl` → `text-4xl`

**SportSelection.tsx:**
- Reduce `p-6` → `p-4` for tighter cards

All three screens get more compact cards while keeping the same structure and content.

