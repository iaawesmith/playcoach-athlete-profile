

## Add Helper Text + Photo Icon to School Logo Upload

Small consistency fix: match the school logo empty state to the action photo empty state.

### Change — `src/features/builder/components/IdentityForm.tsx`

Line 418: Replace the empty-state content for the school logo upload slot.

**Before:**
```tsx
<span className="material-symbols-outlined text-on-surface-variant text-3xl">school</span>
```

**After:**
```tsx
<span className="material-symbols-outlined text-on-surface-variant text-3xl">add_a_photo</span>
<span className="text-on-surface-variant/60 text-[9px]">Your logo appears on the card</span>
```

This matches the action photo pattern (camera icon + helper text) and makes it immediately clear that both slots are photo uploads. The helper text tells the athlete why it matters — the logo shows up on their ProCard.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

