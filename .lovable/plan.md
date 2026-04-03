

## Tighten Unit Labels in Measurables Tiles

### Problem
The unit suffixes (ft, in, s, ") appear too far from their numbers because they're rendered as part of a single string. The screenshot shows them as inline but snug against the number values.

### Changes in `src/features/builder/components/IdentityPreview.tsx`

**1. Refactor `MeasurableTile` to accept `unit` as a separate prop**

Instead of rendering value as one string, split into number + unit displayed inline with reduced gap:

```tsx
const MeasurableTile = ({ label, value, unit }: { label: string; value: string; unit?: string }) => {
  const hasValue = value && value !== "—";
  return (
    <div className="bg-surface-container-high border border-outline-variant/20 rounded-xl p-3 flex flex-col justify-center">
      <span className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--team-color)" }}>
        {label}
      </span>
      <div className={`font-black text-xl ${hasValue ? "text-on-surface" : "text-on-surface-variant/30"}`}>
        {hasValue ? (
          <>
            <span>{value}</span>
            {unit && <span className="text-on-surface-variant text-sm font-medium ml-1">{unit}</span>}
          </>
        ) : "—"}
      </div>
    </div>
  );
};
```

**2. Update format functions to return raw numbers (no unit suffixes)**

- `formatHeight` → returns object-like structure: render as `6` + `ft` + `2` + `in` (two number-unit pairs inline)
- `formatWeight` → value stays as number string, unit = `"lbs"`
- `fortyTime` → value = the time, unit = `"s"`
- `formatInches` → return raw number, unit = `"\""`  (double-quote)

**3. Update grid from `grid-cols-3` to `grid-cols-2`** to match the screenshot layout.

**4. Height tile gets special treatment** — two number+unit pairs (`6 ft 2 in`) rendered inline with tight spacing using `ml-1` between each element.

### Files modified
- `src/features/builder/components/IdentityPreview.tsx`

