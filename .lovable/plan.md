

## Add 40% Opacity Placeholder to Time Input

### Change in `src/features/builder/components/IdentityForm.tsx`

**Line 247**: Add the placeholder opacity class to the time input inside `TimeInputCard`.

Change:
```
className="w-full bg-transparent text-on-surface text-sm font-normal outline-none"
```
To:
```
className="w-full bg-transparent text-on-surface text-sm font-normal outline-none placeholder:text-on-surface/40"
```

This matches all other input fields in the form.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

