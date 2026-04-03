

## Update TopNav Publish Button to 2-State System

### Design Decision
Collapse the current 3-state publish system into 2 states. The initial "Go Live" state merges into the PUBLISH state — any time the profile isn't fully live or has pending changes, the amber button shows.

### State Logic
- **PUBLISH (amber)**: Show when `!hasBeenPublished || hasUnpublishedChanges` — covers both first-time publish and subsequent changes
- **LIVE (pill)**: Show when `hasBeenPublished && !hasUnpublishedChanges` — non-clickable status indicator

### Changes

**`src/features/builder/components/TopNav.tsx`** (lines 27–47)

Replace the 3-state conditional with 2 states:

```tsx
{/* State: needs publishing */}
{(!hasBeenPublished || hasUnpublishedChanges) ? (
  <button
    onClick={publishProfile}
    className="h-8 px-4 rounded-full bg-[#F59E0B] text-white font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-150 animate-pulse"
  >
    Publish
  </button>
) : (
  /* State: live, no changes */
  <div className="h-7 px-3 rounded-full border border-[#00e639] flex items-center gap-1.5">
    <span className="w-1.5 h-1.5 rounded-full bg-[#00e639]" />
    <span className="text-[#00e639] text-[10px] font-bold uppercase tracking-widest">Live</span>
  </div>
)}
```

No Zustand changes needed — existing `hasBeenPublished`, `hasUnpublishedChanges`, and `publishProfile` cover both states.

### Files modified
- `src/features/builder/components/TopNav.tsx`

