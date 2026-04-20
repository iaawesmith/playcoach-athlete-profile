

## Plan: Reference Video Quality Guide — Videos tab (refined v2)

### Where it goes
Single-file edit: `src/features/athlete-lab/components/NodeEditor.tsx`. Insert a persistent callout block at the top of the `EliteVideosEditor` render output, immediately before the existing "Reference Videos" section label. Always visible, never dismissible, never collapsible.

### Visual design

```text
┌─ Videos tab ─────────────────────────────────────────────────────────┐
│                                                                       │
│  ┌─ INFO CALLOUT (bg #0f1e2e, border-l-4 #3b82f6) ─────────────────┐│
│  │ ◉ info icon   REFERENCE VIDEO QUALITY GUIDE                     ││
│  │               Use this checklist every time you add or update    ││
│  │               a reference video.                                 ││
│  │                                                                  ││
│  │ ┌─ IDEAL CRITERIA (✓) ─┐  ┌─ WHAT TO AVOID (✗) ──┐              ││
│  │ │ ✓ Solo athlete       │  │ ✗ Game footage w/    │              ││
│  │ │ ✓ Sideline angle     │  │   defenders           │              ││
│  │ │ ✓ Full body visible  │  │ ✗ Behind-the-QB angle │              ││
│  │ │ ✓ Yard lines visible │  │ ✗ Multiple players    │              ││
│  │ │ ✓ Crisp plant-break  │  │ ✗ End-zone/elevated   │              ││
│  │ │ ✓ Natural speed      │  │ ✗ Partial body shots  │              ││
│  │ │ ✓ Neutral lighting   │  │ ✗ Low-light footage   │              ││
│  │ │ ✓ 5–10 sec duration  │  │ ✗ Instructional       │              ││
│  │ │ ✓ HD quality (1080+) │  │   overlays/graphics    │              ││
│  │ └──────────────────────┘  └───────────────────────┘              ││
│  │                                                                  ││
│  │ ─── divider ─────────────────────────────────────────────────── ││
│  │ WHY THIS MATTERS                                                 ││
│  │   • Teaches athletes — elite example shown alongside results    ││
│  │   • Teaches admins — visual anchor for reviewing uploads        ││
│  │   • Sets submission quality bar — athletes model their filming  ││
│  │   • Validates the node itself — the reference is the canary    ││
│  │                                                                  ││
│  │   ⚠ A low-quality reference undermines the ability to           ││
│  │     distinguish a broken node from a bad athlete submission.    ││
│  │                                                                  ││
│  │ ─── divider ─────────────────────────────────────────────────── ││
│  │ USING THE REFERENCE AS A DIAGNOSTIC TOOL                         ││
│  │ Before promoting this node to Live, verify against the reference:││
│  │   ☐ Keypoint detection quality (clean skeleton, no jitter)      ││
│  │   ☐ Field line detection succeeds (pixels/yard returned)         ││
│  │   ☐ Phase segmentation accurate (start/transition/finish)       ││
│  │   ☐ Metric values land in expected ranges                       ││
│  │   ☐ Aggregate score 85+ on the reference clip                   ││
│  │                                                                  ││
│  │   ⚠ If the reference fails, fix the node before promoting       ││
│  │     to Live.                                                     ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  ┌─ SOURCING IDEAL REFERENCES (muted sub-card) ────────────────────┐│
│  │ ◉ search icon  WHERE TO FIND GOOD REFERENCE FOOTAGE             ││
│  │   • Position coach YouTube channels (Route Mechanic, QB Country,││
│  │     Footwork King, Coach Ballard)                               ││
│  │   • College pro day & NFL Combine drill reels (NFL Network)     ││
│  │   • Coaching clinic uploads (AFCA, Glazier Clinics)             ││
│  │   • Licensed platforms — Hudl Public Library (filter by drill)  ││
│  │   • Trusted skill coach Instagram reels (with permission)       ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  Reference Videos                            3 of 3+ recommended    │
│  └ existing video list / empty state / Add Video button             │
└──────────────────────────────────────────────────────────────────────┘
```

### Style spec (matches AthleteLab dark theme)

**Main callout container**
- `rounded-xl border border-blue-500/30 border-l-4 border-l-blue-400 p-5`
- Background: `style={{ backgroundColor: '#0f1e2e' }}` — distinct info-blue tone, separate from existing `#131920` / `#0d1218` surfaces

**Header row**
- Material Symbol `info` filled, 22px, `text-blue-300`
- Title: `REFERENCE VIDEO QUALITY GUIDE` — `text-[11px] font-bold uppercase tracking-widest text-blue-200`
- Subtitle: `text-xs text-on-surface-variant mt-1`

**Two-column criteria grid** (`grid grid-cols-1 md:grid-cols-2 gap-4 mt-4`)
- Sub-headings: `text-[10px] font-semibold uppercase tracking-widest` — `text-emerald-300` (ideal) / `text-red-300` (avoid)
- Item rows: `flex items-start gap-2 text-xs text-on-surface`
- Icons: `check_circle` 16px `text-emerald-400`, `cancel` 16px `text-red-400`

**Why This Matters section**
- Separator: `border-t border-blue-500/20 mt-4 pt-4`
- Heading: `text-[10px] font-semibold uppercase tracking-widest text-blue-200`
- Bullets: `<ul className="list-disc list-inside space-y-1 mt-2 text-xs text-on-surface-variant">`
- Closing warning: `flex items-start gap-2 mt-3 text-xs text-amber-300/90` with `warning` icon (14px)

**Diagnostic Tool section**
- Separator: `border-t border-blue-500/20 mt-4 pt-4`
- Heading: same `text-[10px] font-semibold uppercase tracking-widest text-blue-200`
- Intro line: `text-xs text-on-surface-variant mt-1`
- Items: `flex items-start gap-2 text-xs text-on-surface` with empty checkbox icon `check_box_outline_blank` 16px `text-blue-300/70`
- Closing warning: `flex items-start gap-2 mt-3 text-xs text-amber-300/90` with `warning` icon (14px)

**Sourcing sub-card** (separate, below main callout — not nested)
- `rounded-lg border border-outline-variant/15 bg-surface-container p-4 mt-3`
- Header: `search` icon (16px) + `WHERE TO FIND GOOD REFERENCE FOOTAGE` (`text-[10px] uppercase tracking-widest text-on-surface-variant`)
- 5 bullets: `text-xs text-on-surface-variant`

### Exact content

**Ideal Reference Video Criteria (9 ✓)**
1. Solo athlete (no defenders, no teammates)
2. Sideline camera angle
3. Full body visible at all times
4. Yard lines visible in frame (calibration)
5. Crisp plant-and-break footwork
6. Natural game speed (no slow-motion)
7. Neutral lighting and field conditions
8. 5–10 second clip duration
9. HD quality (1080p or higher)

**What to Avoid (7 ✗)**
1. Game footage with defenders in frame
2. Behind-the-QB camera angle
3. Multiple players in frame
4. End-zone or elevated/drone angles
5. Partial body shots (head or legs cut off)
6. Low-light or night-game footage
7. Instructional overlays, arrows, or graphics

**Why This Matters (4 bullets)**
- **Teaches athletes** — elite example shown alongside their results so they see exactly what "great" looks like
- **Teaches admins** — visual anchor reviewers compare uploads against when verifying analysis quality
- **Sets the submission quality bar** — athletes naturally model their filming after the reference
- **Validates the node itself** — the reference is the canary; if analysis fails on a perfect clip, the node is broken

Closing warning: *A low-quality reference undermines the ability to distinguish a broken node from a bad athlete submission.*

**Using the Reference as a Diagnostic Tool (5 ☐)**
- Keypoint detection quality (clean skeleton, no jitter or dropouts)
- Field line detection succeeds (pixels-per-yard returned)
- Phase segmentation accurate (start, transition, finish boundaries correct)
- Metric values land in expected ranges
- Aggregate score 85+ on the reference clip

Closing warning: *If the reference fails, fix the node before promoting to Live.*

**Sourcing Ideal References (5 bullets)**
- Position coach YouTube channels (Route Mechanic, QB Country, Footwork King, Coach Ballard)
- College pro day and NFL Combine drill reels (NFL Network, school athletics channels)
- Coaching clinic uploads (AFCA, Glazier Clinics)
- Licensed platforms — Hudl Public Library, filter by drill name
- Trusted skill coach Instagram reels (with permission)

### What I will NOT do
- No edits to `EliteVideosEditor` logic, the add/edit flow, the video list, or the empty state
- No edits to other tabs (Basics, Overview, Camera, Reference, etc.)
- No new component files — JSX inlined inside `EliteVideosEditor` for minimum diff
- No persistence, dismissal, or expand/collapse — always visible by design
- No system-wide token, font, or icon changes

### Files touched
- `src/features/athlete-lab/components/NodeEditor.tsx` — single insertion (~110 lines of JSX) at the top of `EliteVideosEditor`'s return block

### Risks
None meaningful. Pure additive presentational JSX — no state, no props, no logic changes.

