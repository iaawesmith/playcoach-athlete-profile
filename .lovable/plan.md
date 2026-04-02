

## Fix ProCard Height Format + Wingspan Decimal

Two small fixes in `ProCard.tsx`.

### 1. Format height from total inches to `X'Y"` on the card

Add a helper that converts `"74"` → `6'2"`, same as `IdentityPreview.tsx` already does. Apply it to the HEIGHT value in the `physicals` array.

### 2. Wingspan decimal display

The store default for wingspan is `"80"` (inches). This is correct — it's 80 inches. If the issue is that the user expects to see `80.0` or a different value, the real fix is ensuring the store default reflects the intended measurement. Wingspan for Marcus Sterling should be `"80"` (6'8" armspan = 80 inches). The decimal will show when the user enters one (e.g. `79.5`). No code change needed here unless we want to always show one decimal place — but that would show `80.0` which looks odd.

**However**, if the user means the wingspan *input* is stripping decimals, that's an `IdentityForm.tsx` issue in the `NumericInputCard` regex. Need to verify the regex allows `.` — it should since it uses `[^\d.]`.

### Changes — `src/features/builder/components/ProCard.tsx`

In the `physicals` array (line 27), format height:

```ts
const formatHeight = (val: string) => {
  const total = parseInt(val, 10);
  if (!total) return "—";
  return `${Math.floor(total / 12)}'${total % 12}"`;
};

const physicals = [
  { label: "HEIGHT", value: formatHeight(height) },
  { label: "WEIGHT", value: weight.replace(/\s*lbs?/i, "") },
  { label: "40-YD", value: fortyTime },
];
```

### Files modified
- `src/features/builder/components/ProCard.tsx`

