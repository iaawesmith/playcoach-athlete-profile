

## Session 1 — Foundation Scaffold (Revised Plan)

### Overview
Convert the HTML source into 6 React components under `src/features/builder/`. Static render only — no state, no handlers, no Cloud calls.

### Files to Create

**1. `src/features/builder/components/TopNav.tsx`**
- Fixed top bar, **h-16 (64px)**, `glass-card`, `border-b border-white/10`, `z-50`
- Left: PlayCoach logo + "PERFORMANCE EDITORIAL" text badges
- Center: three tab links (Identity / Stats / Media) with active underline using `var(--team-color)`
- Right: `notifications` + `account_circle` Material Symbols icons

**2. `src/features/builder/components/SideNav.tsx`**
- Fixed left column, **w-64 (256px)**, `bg-surface`
- Header block: "Athlete Profile" title, "Elite Status" subtitle, strength bar at 84% (segmented)
- Five nav items with Material Symbols icons: Identity, Stats, Media, Performance, Settings
- Identity item active with **left border in `var(--team-color)`**
- **No "Live Rendering" or "PREVIEW DECK"** — those belong in the main content area

**3. `src/features/builder/components/ProCard.tsx`**
- **`aspect-[3/4] max-w-sm`** sizing, **`rounded-[12px]`**, overflow hidden
- Glow via **`.team-glow` CSS class** (not inline box-shadow)
- **Single badge: top-right only** — hardcoded "UGA", background `var(--team-color)`, white text, `font-black tracking-widest uppercase italic`, small padding
- **No "COLLEGE" badge**
- Empty-state photo area with camera icon placeholder
- "Marcus Sterling" name, "Wide Receiver / #84" with **text color `var(--team-color)`**
- Stat row: Speed 98, Agility 94, Power 88
- **Above the card** in the left column: "Live Rendering" label + "PREVIEW DECK" heading
- Below card: "Publish Profile" primary CTA (kinetic-gradient) + share icon button

**4. `src/features/builder/components/IdentityForm.tsx`**
- "Core Identity" section: first name, last name, bio textarea — hardcoded Marcus Sterling data
- "Asset Library Bin" section: two upload slots with **`border border-white/5`** (solid, not dashed)
- "Technical Specs" section: position chip selector (WR/QB/RB), jersey number, class year
- **Section header accent lines** (`w-8 h-[1px]`) use **`var(--team-color)`** via inline style
- **`focus-within` border** on input cards uses **`var(--team-color)` at 50% opacity** via inline style
- Bottom: "Discard Changes" secondary + "Save Identity" primary CTA

**5. `src/features/builder/components/MobileNav.tsx`**
- Sticky bottom bar, visible only below `md` breakpoint
- Three items: Identity (fingerprint), Stats (leaderboard), Media (grid_view)

**6. `src/features/builder/BuilderLayout.tsx`**
- Composes TopNav + SideNav + left column (Live Rendering label, PREVIEW DECK heading, ProCard) + right column (IdentityForm)
- Sets `--team-color: #00e639` on root div
- Responsive: lg+ three-column, md two-column (hide ProCard column), below md single-column + MobileNav

### Files to Modify

- **`src/App.tsx`** — Replace Index route with `BuilderLayout` at `/`
- **`src/index.css`** — Add `--team-color: #00e639` to `:root`. Confirm `.kinetic-gradient` is `linear-gradient(135deg, #00e639 0%, #006714 100%)` (green only). Confirm `.team-glow` uses green glow.

### Confirmed Style Details

- `--team-color: #00e639` on `:root`
- `.kinetic-gradient`: `linear-gradient(135deg, #00e639 0%, #006714 100%)` — green, no teal
- `.team-glow`: `filter: drop-shadow(0 0 30px rgba(0,230,57,0.3))`
- Upload slot borders: `border border-white/5` (solid)
- Accent lines: inline `style={{ backgroundColor: 'var(--team-color)' }}`
- Focus-within borders: inline style with `var(--team-color)` at 50% opacity
- No shadcn/ui, no lucide-react, Material Symbols only, Lexend font only

