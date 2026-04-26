# PlayCoach — Product Specification

> **Note on this file:** This is the product/build specification — design system, component contracts, ProCard spec, color tokens, real-content standard. Lovable reads it automatically every session, regardless of conversation length.
>
> Renamed from `AGENTS.md` during Phase 1c.2 cleanup (Pass 1) to eliminate the naming collision with `docs/agents/` operational guidance. A redirect stub remains at `AGENTS.md` per the R2 stub policy ([`docs/agents/conventions.md`](docs/agents/conventions.md)).
>
> For executive narrative (mission, market, personas, messaging), see [`VISION.md`](VISION.md). This file does not duplicate that content.
>
> For agent operational guidance (how to work in this repo, conventions, workflows), see [`docs/agents/`](docs/agents/).

---

## Aesthetic Principles

Every UI decision should pass this test: "Does this feel like a premium sports broadcast or a generic SaaS app?" If the latter, revise.

- **Cinematic** — dramatic lighting, depth, layered dark surfaces
- **Editorial** — bold typography, strong hierarchy, like ESPN or The Athletic
- **Premium** — every element feels intentional and high-craft, nothing generic
- **High-performance** — fast, alive, athletic. The UI has energy.
- **Glassmorphism** — frosted glass via `.glass-card` (backdrop-filter blur), used for input cards and overlays
- **Kinetic** — typography feels in motion, buttons have mechanical press feedback (`active:scale-95`)
- **Dark mode only** — deep near-black backgrounds (`#0b0f12`), not pure black. Surfaces lift in layers.
- **Engineered** — precise spacing, `rounded-xl` (12px) max on cards, nothing soft or bubbly

The full Kinetic Gallery design philosophy is articulated in `VISION.md` § "Design Philosophy."

---

## Real Content Standard

Never use placeholder content. Always use realistic athlete data.

**Default demo athlete — use in all components:**
- Name: Marcus Sterling
- Position: Wide Receiver (WR)
- Jersey: #84
- School: University of Georgia | Abbreviation: UGA
- Class Year: 2025 | Hometown: Atlanta, GA
- Height: 6'2" | Weight: 195 lbs
- Bio: Elite wide receiver specializing in deep vertical routes. 3-year varsity starter with elite separation and explosive release.
- Quote: "Every rep is a rep toward the league."
- Stats (WR): REC 67, YDS 1,124, TD 12
- Team Color: `#CC0000` (Georgia Red) — defaults to `#00e639` if not set
- Badges: "Deep Threat", "Route Technician"

Never write "Athlete Name", "Your School Here", or any lorem ipsum.

---

## User Journey Map

**Brand HQ (athlete builds):**
Landing → Onboarding → Identity → Highlights → Development → Stats → Brand (NIL) → Publish → Athlete Profile preview

**Athlete Profile (coach/scout/brand consumes):**
Receives shared link → Hero (ProCard) → Story → Highlights → Development Lab → Stats → Recruiting → NIL → Connect

---

## Component States — Always Build All Three

- **Empty** — icon + short action-oriented prompt ("Add your action photo to bring your card to life") + CTA. Never a blank box.
- **Loading** — `animate-pulse` skeleton matching content shape. Never spinners.
- **Filled** — real content at full fidelity.

---

## Brand HQ — Builder Section Definitions

Six sections accessible via SideNav:

**Identity** — Name, position, school (full + abbreviation), class year, jersey number, hometown, height, weight, bio, personal quote, team color hex (with live swatch preview), action photo upload, school logo upload

**Highlights** — Season highlight reel, top play clips, Hudl/YouTube embed links, uploaded video files

**Development** — Drill uploads (route running, 40-yard dash, etc.), AI scores (future feature), measurables, progress tracking, badges earned. Design as a destination — not a coming-soon page.

**Stats** — Position-specific manual stat entry (3 stats per position, see stat map below). Real data only — no made-up metrics.

**Brand** — NIL availability toggle, partnership categories, current partner brand logos, contact for opportunities CTA

**Settings** — School color hex + live swatch, social links, contact preferences, profile privacy

---

## Athlete Profile — Chapter Architecture

Public page at `/:athleteSlug`. Eight full-viewport chapters (~100vh each). Render only if athlete has content for that section. Each chapter inherits teamColor as accent but has its own visual character.

1. **Hero** — ProCard full-screen center, teamColor ambient glow fills viewport, earned badge strip below card, scroll indicator. First impression — must feel cinematic.
2. **Story** — Bio and personal quote large-format, hometown, action photo as atmospheric background. Human, personal, not a form.
3. **Highlights** — Featured reel full-width with play button. Horizontal scroll gallery of tagged clips below. Film-room aesthetic.
4. **Development Lab** — AI drill scores, progress over time, position leaderboard ranking, earned badges. Placeholder for early sessions but design as a real destination, not a gray box.
5. **Stats** — Position-specific real stats visualized as bold infographics in teamColor. Season + career split. No spreadsheet tables.
6. **Recruiting** — School interest tracker, official visits, offers, status (open / considering / committed). Placeholder until 247Sports API integration.
7. **NIL** — Partner brand logos, available categories, "Contact for NIL Opportunities" CTA.
8. **Connect** — Social links with follower counts, agent/parent contact, direct inquiry form with purpose selector (Recruiting / NIL / Media / Fan). Always ends with an open door.

---

## ProCard Specification

The ProCard is the central visual element. Appears in builder center column and Athlete Profile Hero chapter.

**Dimensions:** `w-full aspect-[3/4] max-w-sm`, `rounded-[12px]`, `overflow-hidden`
**Glow:** `.team-glow` class (filter drop-shadow in teamColor)

**Structure top to bottom:**

1. **School banner** (`absolute top-0 full-width h-8 z-10`): background `var(--team-color)`. Text: school name uppercase font-black tracking-[0.25em] text-[9px] text-white/90 centered. First visual hit — establishes school identity immediately. When teamColor updates, this banner transforms.

2. **Photo area** (top 65% of card): full-bleed action photo, object-fit cover. Empty state: `bg-surface-container-high` with centered athlete silhouette SVG (white, ~7% opacity). No text, no camera icon in the card — uploads happen in the form.

3. **Gradient overlay**: `linear-gradient(to top, #0b0f12 0%, transparent 60%)` over bottom of photo.

4. **School logo** (`absolute bottom-left`, outside stats area): 40×40px, glass-card background, `rounded-lg`. Empty state: shield outline SVG in `text-on-surface-variant`.

5. **Info section** (bottom 35%, `p-4`, `padding-left 64px` to clear school logo):
   - Athlete name: `font-black italic uppercase tracking-tighter text-white text-3xl leading-none`
   - Position + jersey: `font-bold uppercase tracking-widest text-sm` color `var(--team-color)`
   - Stat row: 3 position-specific stats. Label: `text-[8px] uppercase tracking-widest text-on-surface-variant`. Value: `font-black text-white text-lg`.

---

## Position-Specific Stats (3 per position)

Shown on ProCard and Performance section.

| Position | Stat 1 | Stat 2 | Stat 3 |
|---|---|---|---|
| WR / TE | REC | YDS | TD |
| QB | YDS | TD | PCT |
| RB / FB | CAR | YDS | TD |
| OL | PBU | PEN | GRD |
| DL | TKL | SCK | TFL |
| LB | TKL | SCK | TFL |
| CB / S | INT | PBU | TKL |
| K / P | FG% | YDS | BLK |

---

## Button System

- **Primary CTA**: `kinetic-gradient` bg, `text-[#00460a]`, `rounded-full`, `font-black uppercase tracking-[0.2em] text-xs`, `h-11+`, `active:scale-95`. Examples: Publish Profile, Save Identity
- **Secondary**: `glass-card`, `border border-outline-variant/20`, `text-white`, `rounded-full`. Example: Discard Changes
- **Icon**: `rounded-full glass-card`, single Material Symbol, 44×44px. Example: Share
- **Destructive**: `bg-[#d53d18]`, `text-white`, `rounded-lg`. Example: Remove Photo

---

## Top Navigation Pattern

- **Left**: PlayCoach logo → thin vertical divider → "[First Last]" (`white font-bold`) + "BRAND HQ" (`var(--team-color)`, `tracking-widest`, `uppercase`, `text-sm`)
- **Right**: notification icon + account icon only
- **No section tabs in TopNav** — navigation lives in SideNav
- Height: `h-16` (64px), `bg-[#0b0f12]/80 backdrop-blur-xl`, `border-b border-white/10`

---

## File Structure

```
src/
  features/
    landing/            # / route
    onboarding/         # /onboarding route
    builder/            # Brand HQ — /builder routes
      components/       # TopNav, SideNav, ProCard, IdentityForm, etc.
      BuilderLayout.tsx
    profile/            # Athlete Profile — /:athleteSlug route
      chapters/         # HeroChapter, StoryChapter, HighlightsChapter, etc.
      AthleteProfile.tsx
    athlete-lab/        # Internal builder for athlete-lab nodes (NodeEditor, tabs)
  store/                # athleteStore.ts (Zustand)
  services/             # API calls — never fetch from components
  utils/
```

---

## Brand Colors

- **Performance Green** `#00e639` — default teamColor. All builder energy and accents. Used when no school color is set.
- **PlayCoach Steel** `#50C4CA` — landing page and onboarding only. Never in builder or Athlete Profile.
- teamColor is always applied via CSS variable `--team-color` set on the root container div.
- Never hardcode `#0047BA` or any school color. Always use `var(--team-color)`.

---

## Responsive Behavior

**Brand HQ (builder):**
- `lg+`: three-column (SideNav 256px + ProCard sticky + Editor flex-1)
- `md`: two-column (SideNav + Editor, ProCard hidden)
- below `md`: Editor full-width + sticky bottom tab bar

**Athlete Profile:**
- All: single column, chapter-by-chapter scroll
- `lg+`: Hero becomes two-column (ProCard left, info right), max-width 1100px

---

## Scrollbar Styling

```css
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #44484c; border-radius: 10px; }
```

---

## Zustand Store — `src/store/athleteStore.ts`

Interface `AthleteProfile`:

```ts
// Core Identity
firstName, lastName: string
position: string                  // determines which stats fields render
jerseyNumber, classYear: string
school: string                    // full name
schoolAbbrev: string              // shown on ProCard school banner
hometown, highSchool, bio, quote: string
teamColor: string                 // hex, default "#00e639"
actionPhotoUrl: string | null
schoolLogoUrl: string | null

// Physical Measurables
height, weight: string
fortyTime: string                 // "4.42"
vertical: string                  // "38.5\""
wingspan: string                  // "6'8\""
handSize: string                  // "9.5\""

// Eligibility
eligibilityYears: number
transferEligible: boolean
redshirtStatus: string            // "None", "Redshirt", "Medical RS"

// Recruiting
starRating: number                // 1–5
nationalRank: number | null
positionRank: number | null
commitmentStatus: "committed" | "uncommitted" | "portal"

// Upcoming Game
upcomingGame: {
  opponent: string
  date: string
  time: string
  network: string
  location: string
} | null

// Performance
stats: Record<string, number>     // position-specific
highlights: HighlightItem[]

// Connect
socialLinks: SocialLink[]
nilAvailable: boolean
nilCategories: string[]

// Badges + Progress
badges: Badge[]
completionPct: number             // computed, never stored manually
```

---

## Profile Completion Weights (computed, never hardcoded)

| Signal | Weight |
|---|---|
| firstName + lastName | 15% |
| position | 10% |
| school | 10% |
| bio (20+ chars) | 15% |
| actionPhotoUrl | 20% |
| schoolLogoUrl | 10% |
| teamColor changed from default | 5% |
| jerseyNumber + classYear | 5% |
| socialLinks (1+) | 5% |
| highlights (1+) | 5% |
| fortyTime / vertical / wingspan (any) | 5% |
| commitmentStatus set | 5% |
| eligibilityYears set | 5% |

---

## Tailwind Color Tokens

- `bg-background` / `bg-surface`: `#0b0f12`
- `bg-surface-container-low`: `#0f1417`
- `bg-surface-container`: `#151a1e`
- `bg-surface-container-high`: `#1b2024`
- `bg-surface-container-highest` / `bg-surface-variant`: `#21262b`
- `bg-surface-container-lowest`: `#000000`
- `text-on-surface`: `#f7f9fe`
- `text-on-surface-variant`: `#a8abaf`
- `text-primary`: `#3bfe4f`
- `primary-container`: `#00e639`
- `outline-variant`: `#44484c`
- `error-dim`: `#d53d18`

---

## Build Sequence

- Sessions 1–2: no Cloud, no auth, no database. Visual foundation, all data hardcoded or local state.
- Session 3: Lovable Cloud active — auth, database, file storage. Wire Zustand to Supabase.
- Sessions 4–5: Athlete Profile public view (`/:athleteSlug`) — five-section scaffold + data consumption + full external preview within Brand HQ.
- Out of scope for MVP: coach/scout search, NIL transactions, payments, 247Sports API, AI drill scoring.

---

## Domain Terminology

See [`docs/glossary.md`](docs/glossary.md) for the canonical list. Quick reference:

- **Brand HQ** — the authenticated builder
- **Athlete Profile** — the public shareable page at `/:athleteSlug`
- **ProCard** — the visual athlete card
- **Profile Strength** — completion percentage in SideNav
- **Section / Chapter** — Brand HQ has six sections; Athlete Profile has eight chapters
- **Develop** — training video uploads with AI scoring and progress timeline
- **Pulse** — live CFBD data feed + athlete-curated moments (planned)
- **teamColor** — hex driving all dynamic accents
- **NIL** — Name Image Likeness brand partnership opportunities
