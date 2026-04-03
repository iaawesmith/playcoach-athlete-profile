

## Move Team Color Inline with School Field

**`src/features/builder/components/IdentityForm.tsx`**

### Current layout (lines 526–549):
1. `SchoolAutocomplete` — full-width card
2. Below it: a 2-column grid with "Team Color (Hex)" input card and a separate "Preview" card containing the color swatch

### New layout:
1. **Single row** containing SchoolAutocomplete (left, flex-1) and a combined Team Color card (right, fixed width ~180px)
2. The Team Color card contains:
   - Label: "Team Color (Hex)"
   - A flex row with the hex input on the left and the color swatch preview (w-8 h-8 rounded-lg) on the right — no separate "Preview" label or card
3. Remove the standalone Preview card entirely

### Implementation (lines 526–549):

Replace:
```tsx
<SchoolAutocomplete ... />
<div className="grid grid-cols-2 gap-4">
  <InputCard label="Team Color (Hex)" ... />
  <div ...>Preview swatch</div>
</div>
```

With:
```tsx
<div className="flex gap-4">
  <div className="flex-1">
    <SchoolAutocomplete ... />
  </div>
  <div className="bg-surface-container rounded-xl p-4 transition-colors duration-200 input-card-focus" style={{ minWidth: 160 }}>
    <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">
      Team Color (Hex)
    </label>
    <div className="flex items-center gap-2">
      <input
        className="w-full bg-transparent text-on-surface text-sm font-normal outline-none"
        value={teamColor}
        onChange={(e) => setAthlete({ teamColor: e.target.value })}
      />
      <div
        className="w-8 h-8 rounded-lg border border-outline-variant/10 shrink-0"
        style={{ backgroundColor: teamColor }}
      />
    </div>
  </div>
</div>
```

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

