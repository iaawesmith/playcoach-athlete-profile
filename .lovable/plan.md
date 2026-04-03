

## Set Date Input to 40% Opacity When Empty

**`src/features/builder/components/IdentityForm.tsx` — `DateInputCard` (line 217)**

Change the `<input type="date">` className to conditionally apply `text-on-surface/40` when `value` is empty, and `text-on-surface` when a date is selected — matching the dropdown treatment.

```tsx
className={`w-full bg-transparent text-sm font-normal outline-none [color-scheme:dark] ${
  value ? "text-on-surface" : "text-on-surface/40"
}`}
```

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

