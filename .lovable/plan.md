

## Hide "Enter Brand HQ" Until After Apply

### Change
In `src/features/onboarding/steps/ProfilePreview.tsx`, conditionally render the "Enter Brand HQ →" button only when `autoFill.status === "done"`.

**Line 370-377** — Wrap the CTA button:
```tsx
{autoFill.status === "done" && (
  <button
    onClick={handleComplete}
    className="w-full py-3.5 rounded-full font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-200"
    style={{ backgroundColor: "#50C4CA", color: "white" }}
  >
    Enter Brand HQ →
  </button>
)}
```

### Files Modified
- `src/features/onboarding/steps/ProfilePreview.tsx`

