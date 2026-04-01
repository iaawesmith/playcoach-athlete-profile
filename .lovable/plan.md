

## Center Preview Label with Card, Status Below

The label row currently stretches the full column width (`p-8` padding) while the ProCard is constrained to `max-w-sm` (384px) and centered via `items-center` on its parent. This makes the label feel disconnected and off-center relative to the card.

### Change — `src/features/builder/BuilderLayout.tsx`

1. **Wrap label + status in a centered container matching the card width**: Add a `w-full max-w-sm mx-auto` wrapper around the label and status so they align exactly with the ProCard edges.

2. **Stack label and status vertically**: Instead of side-by-side (`justify-between`), place the section label on top and the Draft/Live status indicator directly below it with a small gap (`mt-1.5`).

3. **Bump label size**: Change from `text-sm` to `text-base` for a slightly larger, more anchored heading feel. Keep `font-bold uppercase tracking-widest text-on-surface-variant`.

4. **Apply same centering to placeholder panels** (non-identity sections): The placeholder already centers its content, so it stays as-is. The label above it gets the same `max-w-sm mx-auto` treatment for consistency.

### Result

```text
        ┌─── max-w-sm ───┐
        IDENTITY PREVIEW
        ● Draft
        ┌────────────────┐
        │                │
        │    ProCard      │
        │                │
        └────────────────┘
```

### Files modified
- `src/features/builder/BuilderLayout.tsx`

