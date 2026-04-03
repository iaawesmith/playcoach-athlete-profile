

## Align Height Input Values With Other Numeric Cards

**Problem**: The Height card uses `text-center` on its inputs and `gap-2` between all elements, so the "0" values don't left-align with the "0.0" in 40 Time and Wingspan below. The NumericInputCard uses left-aligned text with no gap — the value sits flush left.

**Fix in `src/features/builder/components/IdentityForm.tsx` (lines 151–168)**:

Replace the height input row layout:

```tsx
<div className={`flex items-center ${isEmpty ? "border-b border-dashed border-outline-variant/30" : ""} pb-0.5`}>
  <input
    className="bg-transparent text-on-surface text-sm font-normal outline-none placeholder:text-on-surface/40"
    style={{ width: `${Math.max(String(feet || "").length || 1, 1) * 0.6 + 0.4}em` }}
    value={totalInches > 0 ? String(feet) : ""}
    onChange={(e) => handleFeetChange(e.target.value)}
    inputMode="numeric"
    placeholder="0"
  />
  <span className="text-on-surface-variant text-sm font-normal shrink-0 ml-1.5">ft</span>
  <input
    className="bg-transparent text-on-surface text-sm font-normal outline-none placeholder:text-on-surface/40 ml-3"
    style={{ width: `${Math.max(String(inches || "").length || 1, 1) * 0.6 + 0.4}em` }}
    value={totalInches > 0 ? String(inches) : ""}
    onChange={(e) => handleInchesChange(e.target.value)}
    inputMode="numeric"
    placeholder="0"
  />
  <span className="text-on-surface-variant text-sm font-normal shrink-0 ml-1.5">in</span>
</div>
```

Key changes:
- Remove `text-center` and fixed `w-12` from both inputs — use dynamic width like NumericInputCard
- Remove `gap-2` from the flex container — use `ml-1.5` on suffixes and `ml-3` between the ft/in pairs
- Values now left-align flush with the container edge, matching 40 Time and Wingspan

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

