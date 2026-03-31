# PlayCoach — Agent Instructions
# Commit this file to the root of your repository as AGENTS.md
# Lovable reads it automatically every session, regardless of conversation length.

---

## Product Vision

PlayCoach is a mobile-first athlete identity platform. The core product is the Athlete Link Profile — a single shareable link serving as an athlete's complete Brand HQ: recruiting identity, NIL presence, skill development record, and personal brand in one place.

**Brand HQ** is the authenticated builder where athletes create and manage their identity. The **Athlete Profile** is the public shareable page — what coaches, scouts, brands, and fans see.

Two mental models define every design decision:
- "The card is the cover. The profile is the magazine." The ProCard is the hook; the Athlete Profile is the full story told in chapters.
- "Not a recruiting tool — an athlete identity platform." The athlete owns and controls their narrative.

Goal: give athletes a professional, credible, cinematic digital presence that works in every context — a coach evaluating recruits, a brand considering NIL, a scout on the sideline, a fan following a player.

---

## Aesthetic Principles

Every UI decision should pass this test: "Does this feel like a premium sports broadcast or a generic SaaS app?" If the latter, revise.

- **Cinematic** — dramatic lighting, depth, layered dark surfaces
- **Editorial** — bold typography, strong hierarchy, like ESPN or The Athletic
- **Premium** — every element feels intentional and high-craft, nothing generic
- **High-performance** — fast, alive, athletic. The UI has energy.
- **Glassmorphism** — frosted glass via .glass-card (backdrop-filter blur), used for input cards and overlays
- **Kinetic** — typography feels in motion, buttons have mechanical press feedback (active:scale-95)
- **Dark mode only** — deep near-black backgrounds (#0b0f12), not pure black. Surfaces lift in layers.
- **Engineered** — precise spacing, rounded-xl (12px) max on cards, nothing soft or bubbly

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
- Team Color: #CC0000 (Georgia Red) — defaults to #00e639 if not set
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
- **Loading** — animate-pulse skeleton matching content shape. Never spinners.
- **Filled** — real content at full fidelity.

---

## Brand HQ — Builder Section Definitions

Six sections accessible via SideNav:

**Identity** — Name, position, school (full + abbreviation), class year, jersey number, hometown, height, weight, bio, personal quote, team color hex (with live swatch preview), action photo upload, school logo upload

**Highlights** — Season highlight reel, top play clips, Hudl/YouTube embed links, uploaded video files

**Development** — Drill uploads (route running, 40-yard dash, etc.), AI scores (future feature), measurables, progress tracking, badges earned. Design as a destination — not a coming-soon page.

**Stats** — Position-specific manual stat entry (3 stats per position, see stat map in Project Knowledge). Real data only — no made-up metrics.

**Brand** — NIL availability toggle, partnership categories, current partner brand logos, contact for opportunities CTA

**Settings** — School color hex + live swatch, social links, contact preferences, profile privacy

---

## Athlete Profile — Chapter Architecture

Public page at /:athleteSlug. Eight full-viewport chapters (~100vh each). Render only if athlete has content for that section. Each chapter inherits teamColor as accent but has its own visual character.

1. **Hero** — ProCard full-screen center, teamColor ambient glow fills viewport, earned badge strip below card, scroll indicator. First impression — must feel cinematic.

2. **Story** — Bio and personal quote large-format, hometown, action photo as atmospheric background. Human, personal, not a form.

3. **Highlights** — Featured reel full-width with play button. Horizontal scroll gallery of tagged clips below. Film-room aesthetic.

4. **Development Lab** — AI drill scores, progress over time, position leaderboard ranking, earned badges displayed as visual achievements. Placeholder for Sessions 1–5 but design as a real destination, not a gray box.

5. **Stats** — Position-specific real stats visualized as bold infographics in teamColor. Season + career split. No spreadsheet tables.

6. **Recruiting** — School interest tracker, official visits, offers, status (open / considering / committed). Placeholder until 247Sports API integration.

7. **NIL** — Partner brand logos, available categories, "Contact for NIL Opportunities" CTA.

8. **Connect** — Social links with follower counts, agent/parent contact, direct inquiry form with purpose selector (Recruiting / NIL / Media / Fan). Always ends with an open door.

---

## ProCard Specification

The ProCard is the central visual element. Appears in builder center column and Athlete Profile Hero chapter.

**Dimensions:** w-full aspect-[3/4] max-w-sm, rounded-[12px], overflow-hidden
**Glow:** .team-glow class (filter drop-shadow in teamColor)

**Structure top to bottom:**

1. **School banner** (absolute top-0 full-width h-8 z-10): background var(--team-color). Text: school name uppercase font-black tracking-[0.25em] text-[9px] text-white/90 centered. This is the first visual hit — establishes school identity immediately. When teamColor updates, this banner transforms.

2. **Photo area** (top 65% of card): full-bleed action photo, object-fit cover. Empty state: bg-surface-container-high with centered athlete silhouette SVG (white, ~7% opacity). No text, no camera icon in the card — uploads happen in the form.

3. **Gradient overlay**: linear-gradient(to top, #0b0f12 0%, transparent 60%) over bottom of photo.

4. **School logo** (absolute bottom-left, outside stats area): 40×40px, glass-card background, rounded-lg. Empty state: shield outline SVG in text-on-surface-variant.

5. **Info section** (bottom 35%, p-4, padding-left 64px to clear school logo):
   - Athlete name: font-black italic uppercase tracking-tighter text-white text-3xl leading-none
   - Position + jersey: font-bold uppercase tracking-widest text-sm color var(--team-color)
   - Stat row: 3 position-specific stats. Label: text-[8px] uppercase tracking-widest text-on-surface-variant. Value: font-black text-white text-lg.

---

## Button System

- **Primary CTA**: kinetic-gradient bg, text-[#00460a], rounded-full, font-black uppercase tracking-[0.2em] text-xs, h-11+, active:scale-95. e.g. Publish Profile, Save Identity
- **Secondary**: glass-card, border border-outline-variant/20, text-white, rounded-full. e.g. Discard Changes
- **Icon**: rounded-full glass-card, single Material Symbol, 44×44px. e.g. Share
- **Destructive**: bg-[#d53d18], text-white, rounded-lg. e.g. Remove Photo

---

## Top Navigation Pattern

- **Left**: PlayCoach logo → thin vertical divider → "[First Last]" (white font-bold) + "BRAND HQ" (var(--team-color), tracking-widest, uppercase, text-sm)
- **Right**: notification icon + account icon only
- **No section tabs in TopNav** — navigation lives in SideNav
- Height: h-16 (64px), bg-[#0b0f12]/80 backdrop-blur-xl, border-b border-white/10

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
  store/                # athleteStore.ts (Zustand)
  services/             # API calls (future) — never fetch from components
  utils/
```

---

## Brand Colors

- **Performance Green #00e639** — default teamColor. All builder energy and accents. Used when no school color is set.
- **PlayCoach Steel #50C4CA** — landing page and onboarding only. Never in builder or Athlete Profile.
- teamColor is always applied via CSS variable --team-color set on the root container div.
- Never hardcode #0047BA or any school color. Always use var(--team-color).

---

## Responsive Behavior

**Brand HQ (builder):**
- lg+: three-column (SideNav 256px + ProCard sticky + Editor flex-1)
- md: two-column (SideNav + Editor, ProCard hidden)
- below md: Editor full-width + sticky bottom tab bar

**Athlete Profile:**
- All: single column, chapter-by-chapter scroll
- lg+: Hero becomes two-column (ProCard left, info right), max-width 1100px

---

## Scrollbar Styling
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #44484c; border-radius: 10px; }
