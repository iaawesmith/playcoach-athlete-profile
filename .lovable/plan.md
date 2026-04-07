

## Plan: Simplify Onboarding CoreSetup

### What changes
Remove **Position**, **Class**, and **Jersey Number** fields from `src/features/onboarding/steps/CoreSetup.tsx`. The onboarding form will collect only **First Name**, **Last Name**, and **School**. These three removed fields are already populated by the CFBD roster lookup during auto-fill.

### Changes — CoreSetup.tsx only

1. **Remove the Position pills card** (lines ~119–138) — the entire `POSITIONS` pill selector
2. **Remove the Class pills card** (lines ~141–159) — the entire `CLASS_OPTIONS` pill selector
3. **Remove the Jersey Number card** (lines ~162–165)
4. **Remove unused constants** at top: `POSITIONS` and `CLASS_OPTIONS` arrays
5. **Update `canContinue`** from `school && position && classYear && firstName && lastName` → `school && firstName && lastName`
6. **Remove `position`, `classYear`, `number`** from the destructured store values (they're no longer used in this component)

### Result
The form becomes three fields only: First Name, Last Name, School (with logo preview). Much faster onboarding — position, class, and jersey are auto-filled from CFBD after "Build My Profile."

### Files modified
- `src/features/onboarding/steps/CoreSetup.tsx`

