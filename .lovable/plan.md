

## Add 40% Opacity Placeholder to UniversitySearchCard Input

The `UniversitySearchCard` input (used for the Opponent field) is missing the `placeholder:text-on-surface/40` class that all other inputs use. This means its placeholder text ("Search schools...") renders at full opacity instead of the muted 40%.

### Change in `src/features/builder/components/IdentityForm.tsx`

**Line 462**: Add the placeholder opacity class to the input.

Change:
```
className="w-full bg-transparent text-on-surface text-sm font-normal outline-none"
```
To:
```
className="w-full bg-transparent text-on-surface text-sm font-normal outline-none placeholder:text-on-surface/40"
```

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

