

## Replace AM/PM Toggle Buttons with a Dropdown

The screenshot confirms the PM button visibility issue persists despite prior fixes. A dropdown is simpler, more intuitive, and avoids the contrast problem entirely.

### Approach

**`src/features/builder/components/IdentityForm.tsx`** — Replace the two toggle buttons in the `TimeInputCard` component (lines 249–262) with a `<select>` dropdown containing three options: blank (default), AM, PM.

The dropdown will:
- Use three options: `""` (blank/unset), `"AM"`, `"PM"`
- Style: `bg-surface-container-highest text-on-surface-variant rounded-lg border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1`
- Default to blank (`""`) matching the empty `timePeriod` default
- When blank is selected, time stores without a period suffix

The `handlePeriodChange` function (line 458) already handles empty period — `timePeriod ? ... : val` — so no store changes needed.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

