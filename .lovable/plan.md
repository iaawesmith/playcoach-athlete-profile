

## Set Dropdown Placeholder Text to 40% Opacity

**`src/features/builder/components/IdentityForm.tsx`** — `SelectCard` component (line 188–189)

When `value` is empty (`""`), the displayed text is "Select..." — this should render at 40% opacity to match all other placeholder styling.

Change the `<select>` className to conditionally apply `text-on-surface/40` when value is empty, and `text-on-surface` when a value is selected:

```tsx
className={`w-full bg-transparent text-sm font-normal outline-none appearance-none cursor-pointer ${
  value ? "text-on-surface" : "text-on-surface/40"
}`}
```

Also apply the same treatment to the AM/PM dropdown in `TimeInputCard` (line ~252) — when `period` is empty, use 40% opacity.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

