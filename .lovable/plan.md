

## Add Sticky Editor Header Bar

**`src/features/builder/BuilderLayout.tsx` (lines 123–126)**

Replace the right column div with a flex-col layout containing a sticky header and scrollable form area:

```tsx
{/* Right Column — Editor */}
<div className="lg:col-span-7 flex flex-col overflow-hidden">
  {/* Sticky Editor Header */}
  <div className="sticky top-0 z-20 bg-surface-container-high border-b border-white/10 px-6 py-3">
    <div className="flex items-center gap-1.5">
      <span className="material-symbols-outlined text-on-surface text-sm">edit</span>
      <span className="text-on-surface font-bold uppercase tracking-widest text-xs">
        Editing {activeSection === "identity" ? "Identity" : activeSection === "performance" ? "Performance" : activeSection === "develop" ? "Develop" : activeSection === "pulse" ? "Pulse" : "Connect"}
      </span>
    </div>
    <p className="text-on-surface-variant text-[0.65rem] italic mt-0.5">
      Changes reflect instantly in preview
    </p>
  </div>
  <div className="flex-1 overflow-y-auto p-6 md:p-10">
    <IdentityForm />
  </div>
</div>
```

The outer div uses `flex flex-col overflow-hidden` so the sticky header stays pinned and only the inner form area scrolls. The section label dynamically reads from `activeSection` in the store.

### Files modified
- `src/features/builder/BuilderLayout.tsx`

