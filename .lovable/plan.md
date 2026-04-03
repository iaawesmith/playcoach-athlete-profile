

## Replace Publish Button with Icon-Based 2-State System

### Concept
Replace the flashing amber "PUBLISH" button with a clean icon button that toggles between two states. Update the preview column subtext to guide the user.

### TopNav Changes (`src/features/builder/components/TopNav.tsx`)

**State 1 — Unpublished changes (or never published):**
- Icon button: `publish` Material Symbol (looks like an upload/send icon), 20px
- Icon color: `text-on-surface-variant` (neutral, not distracting)
- Clickable — calls `publishProfile` on click
- No text label, no pulse animation — just a clean icon button (same style as link/notification icons)

**State 2 — Live, no pending changes:**
- Icon: `cell_tower` Material Symbol (broadcast/live icon), 20px
- Icon color: `#00e639` (Performance Green)
- Not clickable — just a status indicator
- No border pill, no text — the green icon alone signals "live"

Both states use the same `w-8 h-8 rounded-full flex items-center justify-center` container as the link icon beside it.

### Preview Column Subtext (`src/features/builder/BuilderLayout.tsx`, lines 50–62)

Replace the current Draft/Live subtext logic:
- **When live**: `"Live"` with white dot (keep as-is)
- **When draft/unpublished changes**: Subtext becomes `"Publish changes via the icon above"` — white, italic, 0.65rem

### Files modified
- `src/features/builder/components/TopNav.tsx`
- `src/features/builder/BuilderLayout.tsx`

