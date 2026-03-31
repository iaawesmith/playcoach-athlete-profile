# PlayCoach — Agent Instructions
# Commit this file to the root of your repository.
# Lovable reads it automatically in every session, regardless of conversation length.

---

## Product Vision

PlayCoach is a mobile-first athlete identity platform. The core product is an Athlete Link Profile — a single shareable link that serves as an athlete's complete digital identity across recruiting, NIL, skill development, and personal brand. Think Linktree, but built specifically for athletes with intelligence layered in.

Every design and architecture decision should serve one goal: giving athletes a professional, credible digital presence that works across every context — a coach watching film, a brand evaluating NIL deals, a scout on the sideline.

---

## Aesthetic & Design Buzzwords

Use these terms to guide every UI decision. They are the tone of the product:
- **Cinematic** — dramatic lighting, depth, layered surfaces
- **Editorial** — bold typography, strong information hierarchy, like ESPN or Bleacher Report
- **Premium** — nothing generic, every element feels intentional and high-craft
- **High-performance** — the UI feels fast, alive, and athletic
- **Glassmorphism** — frosted glass surfaces (.glass-card), backdrop blur on overlays
- **Kinetic** — typography feels in motion, buttons have mechanical press feedback (active:scale-95)
- **Dark mode** — deep near-black backgrounds, not pure black. Surfaces lifted in layers.
- **Engineered** — sharp corners (max 8px radius), precise spacing, nothing soft or bubbly

When in doubt: ask "Does this feel like a premium sports broadcast or a generic SaaS app?" If the latter, revise.

---

## Real Content Standard

Never use placeholder content. Always use realistic athlete data in all components and examples.

Default demo athlete for all previews:
- Name: Marcus Sterling
- Position: Wide Receiver (WR)
- Jersey: #84
- School: University of Georgia
- Class Year: 2025
- Hometown: Atlanta, GA
- Bio: Elite-tier wide receiver specializing in deep vertical threat scenarios. 3-year varsity starter with record-breaking explosive metrics.
- Stats: Speed 98, Agility 94, Power 88
- Team Color: #CC0000 (Georgia Red)

Use this data in any component that needs example content. Never write "Athlete Name" or "Your School Here."

---

## User Journey Map

**Builder Journey (athlete):**
Landing Page → Onboarding (sport/level selection) → Identity section → Highlights → Develop → Proof → Connect → Publish → External Facing Profile preview

**Viewer Journey (coach/scout/sponsor):**
Receives shared link → External Facing Profile hero → scrolls Stats → watches Highlights → reviews Proof → clicks Connect/NIL CTA

Every section of the UI should have a reason to exist and a reason to lead to the next step.

---

## Component States (always define all three)

Every dynamic component must handle all three states. Never build a component with only the "filled" state:

- **Empty state** — what shows when the athlete hasn't added content yet. Use an icon, a short prompt ("Add your action photo to bring your card to life"), and a CTA. Never show a blank white box.
- **Loading state** — use animate-pulse skeleton placeholders that match the shape of the real content. Never use spinners.
- **Filled state** — the real content rendered at full fidelity.

---

## Builder Section Definitions

The builder has 5 sections accessible via SideNav:

**Identity** — Core profile: name, position, school, class year, jersey number, hometown, bio, team color, action photo, school logo

**Highlights** — Video content: season highlight reel, top plays, embedded Hudl or YouTube links, uploaded clips

**Develop** — Athletic measurables: height, weight, 40-yard dash, vertical jump, broad jump, bench press, position-specific drill times. Skill ratings for Speed, Agility, Power displayed as stat bars.

**Proof** — Credentials: awards, all-conference honors, academic achievements, coach endorsement quotes, press mentions or newspaper clippings

**Connect** — Social and contact: Instagram, Twitter/X, TikTok, Hudl profile links with follower counts. NIL availability toggle. Contact inquiry form with purpose selector (Recruiting / NIL / Media / Fan). Preferred contact method.

---

## External Facing Profile — Section Order

Single-scroll page at /:athleteSlug. Sections render only if the athlete has filled in relevant data. Show a graceful empty state if a section has no content.

1. **Hero** — Full-bleed action photo background, dark gradient overlay, Pro-Card centered, athlete name, position, school, class year, social icon links, tier badge
2. **Stats** — Key performance metrics, measurables, skill rating bars (Speed/Agility/Power)
3. **Highlights** — Featured video reel as primary, grid of additional clips below
4. **Development** — Measurables, skill rating breakdown, committed/interested schools
5. **NIL Marketplace** — Availability status, partnership categories, "Contact for NIL" CTA
6. **Proof** — Awards grid, coach endorsement pull quotes, press clip cards
7. **Connect** — Social links, inquiry form, PDF recruiting profile download CTA

---

## Pro-Card Specification

The Pro-Card is the central visual element. It appears in CardPreview (builder) and AthleteCard (public profile).

Dimensions in builder: 280px wide × 380px tall, border-radius 8px, overflow hidden
Dimensions in public profile: responsive, max-width 320px, same aspect ratio

Structure (top to bottom):
- Top 65%: full-bleed athlete action photo, object-fit cover
- Gradient overlay on bottom half: linear-gradient(to top, #0b0f12, transparent)
- Top-left badge: level label (COLLEGE / PRO / HIGH SCHOOL), bg-surface-container, border border-outline-variant, text 0.6rem font-black uppercase tracking-widest, padding 4px 8px, border-radius 4px
- Top-right badge: tier label (ELITE TIER / DEVELOPING / BUILDING), background uses teamColor
- Bottom info section (padding 16px):
  - Athlete name: font-black italic uppercase tracking-tighter text-white, font-size 1.6rem, line-height 1
  - Position + jersey: font-bold uppercase tracking-widest text-sm, color teamColor
  - Stat row: flex gap-16px. Each stat has label (0.6rem uppercase tracking-widest text-on-surface-variant) and value (font-black text-white text-lg)
- Card glow: box-shadow 0 0 40px {teamColor}33, 0 0 80px {teamColor}11 via inline style

Empty state (no photo uploaded): show dark placeholder bg-surface-container-high with centered camera icon and text "Upload your action photo"

---

## Button System

**Primary CTA** — kinetic-gradient background, text #00460a, rounded-full, font-black uppercase tracking-[0.2em] text-xs, height 44px+, active:scale-95. Examples: Publish Profile, Save Identity

**Secondary** — transparent, border border-outline-variant, text white, same shape. Examples: Preview, Discard

**Icon button** — rounded-full, glass-card, single Material Symbol, 44px × 44px. Examples: Share icon

**Destructive** — background #d53d18, text white, rounded-lg. Examples: Remove photo, Delete

---

## Architecture & File Structure

```
src/
  components/       # Shared components used across features
  features/
    landing/        # / route
    onboarding/     # /onboarding route
    builder/        # /builder route (Identity, Highlights, Develop, Proof, Connect)
    profile/        # /:athleteSlug route
  pages/            # Route-level page wrappers
  store/            # Zustand stores (athleteStore.ts)
  services/         # API calls (future) — never fetch directly from components
  utils/            # Helper functions
```

- Persist athlete profile to localStorage on every state change
- Use optimistic updates for any mutations
- Never call fetch directly from components

---

## Responsive Behavior

**Builder:**
- lg+: full three-column (SideNav 220px + CardPreview 360px + Editor flex-1)
- md: two-column (SideNav + Editor, CardPreview hidden)
- below md: Editor full-width + sticky bottom tab bar, SideNav and CardPreview hidden

**External Facing Profile:**
- All sizes: single column, max-width 640px centered
- lg+: Hero becomes two-column (Pro-Card left, info right), max-width 900px

---

## Brand Colors (PlayCoach)

- **Steel** (primary brand): #50C4CA — teal, used as default teamColor and brand accent
- **Panther** (dark): #1A1E1E — dark charcoal, close to surface colors
- **White**: #FFFFFF

teamColor defaults to Steel (#50C4CA). When an athlete sets their school color, teamColor updates to that hex value and overrides Steel across all dynamic accent elements.

---

## Scrollbar Styling

Apply globally in index.css:
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #44484c; border-radius: 10px; }
