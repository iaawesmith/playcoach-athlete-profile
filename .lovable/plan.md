

## Remove "(Default)" from Team Color Field

**`src/features/builder/components/IdentityForm.tsx`**

Find the Team Color label that conditionally appends `(Default)` when the value is `#50C4CA`. Change it to always show `"Team Color (Hex)"` without any conditional suffix.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

