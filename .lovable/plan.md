

## Combined: IdentityPreview + Hide Badges + Move Go Live to Top

Three changes rolled into one pass.

### 1. New File: `src/features/builder/components/IdentityPreview.tsx`

Renders the full Identity section below ProCard, all reading from `useAthleteStore()`:

- **Measurables Grid** — 2×3 grid: HT, WT, 40-YD, VERTICAL, WINGSPAN, HAND SIZE. Tiles: `bg-surface-container`, ghost border, teamColor label, bold value. Empty: muted "—".
- **Recruiting Block** — Star rating (filled/unfilled `star` icons), national rank, position rank, commitment status badge (teamColor bg for Committed, outline for others). Empty ranks: "Not ranked".
- **Eligibility Block** — Years remaining, transfer eligible badge, redshirt status. Compact row.
- **Upcoming Game Card** — Full-width, teamColor left border. Opponent, date, time, network, location. Null state: muted "No upcoming game scheduled" with `event` icon.
- **Bio + Quote** — Bio body text. Quote italic with `border-l-2` in teamColor. Empty: muted prompts.
- **Hometown + High School** — Single muted line. Empty: "Add your hometown".

All blocks: `max-w-sm w-full`, `space-y-6`.

### 2. Remove Badges from `ProCard.tsx`

Delete the "Badge Strip" section (lines 131–154) — the "Earned Badges" label and the two hardcoded badge pills.

### 3. Move Go Live + Share to Preview Header in `BuilderLayout.tsx`

Remove the "Below Card — CTAs" section from `ProCard.tsx` (lines 156–181) — the Go Live/Published button and Share icon.

Add them to the preview column header row in `BuilderLayout.tsx`, next to the section label and status indicator:

```
┌─── max-w-sm mx-auto ──────────────────────┐
│ IDENTITY PREVIEW          [Go Live] [Share]│
│ ● Draft                                    │
└────────────────────────────────────────────┘
```

- Go Live button: smaller — `h-8 px-4 text-[10px]` kinetic-gradient pill, same `publishProfile` action
- When live: small "Published" pill (glass-card, check_circle icon) + Share icon button (`w-8 h-8`)
- Both always visible at top regardless of scroll position
- Share button enabled only when live (same logic as current)

### 4. Wire `BuilderLayout.tsx` Preview Column

- Make the left column scrollable: `overflow-y-auto`
- When `activeSection === "identity"`: render `<ProCard />` then `<IdentityPreview />`
- Import `publishProfile`, `hasBeenPublished`, `profileStatus` from store for the header CTAs

### Files modified
- `src/features/builder/components/IdentityPreview.tsx` (new)
- `src/features/builder/components/ProCard.tsx`
- `src/features/builder/BuilderLayout.tsx`

