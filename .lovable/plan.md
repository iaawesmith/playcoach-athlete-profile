

## Expand Identity Editor with All Store Fields

Two files change: the Zustand store gets new fields, and IdentityForm gets reorganized into Card Fields and Profile Fields sub-sections.

### 1. Update `src/store/athleteStore.ts`

Add all missing fields to the interface and defaults:

- `schoolAbbrev: string` (default `"UGA"`)
- `highSchool: string` (default `""`)
- `quote: string` (default `"Every rep is a rep toward the league."`)
- `fortyTime: string` (default `"4.42"`)
- `vertical: string` (default `"38.5\""`)
- `wingspan: string` (default `"6'8\""`)
- `handSize: string` (default `"9.5\""`)
- `eligibilityYears: number` (default `3`)
- `transferEligible: boolean` (default `false`)
- `redshirtStatus: string` (default `"None"`)
- `starRating: number` (default `4`)
- `nationalRank: number | null` (default `null`)
- `positionRank: number | null` (default `null`)
- `commitmentStatus: "committed" | "uncommitted" | "portal"` (default `"committed"`)
- `upcomingGame: { opponent: string; date: string; time: string; network: string; location: string } | null` (default `null`)

Update `AthleteData` type accordingly.

### 2. Reorganize `src/features/builder/components/IdentityForm.tsx`

Replace the current four sections with two top-level groups using `SectionHeader`:

**Card Fields** — feeds ProCard directly:
- "Your Identity": First Name, Last Name
- "Position & Details": Position chips, Jersey #, Class Year
- "School & Colors": School Name, School Abbreviation, School Color (hex with swatch)
- "Your Media": Action Photo upload, School Logo upload
- "Measurables": Height, Weight in 2-col grid; 40 Time, Vertical in 2-col; Wingspan, Hand Size in 2-col

**Profile Fields** — feeds the Identity section on external profile:
- "Background": Hometown, High School
- "Story": Bio (textarea), Personal Quote (textarea)
- "Eligibility": Eligibility Years Remaining (number input), Transfer Eligible (toggle switch built inline — a styled button that toggles boolean), Redshirt Status (dropdown via a styled select)
- "Recruiting": Star Rating (1–5 chip selector like position chips), National Rank, Position Rank
- "Commitment": Commitment Status (dropdown: Committed / Uncommitted / In Portal)
- "Upcoming Game": Opponent, Date, Time, Network, Location — all InputCard fields

New inline sub-components (inside IdentityForm.tsx, not new files):
- **ToggleCard**: label + styled toggle button reading/writing a boolean
- **SelectCard**: label + native `<select>` styled with same ghost border treatment
- **ChipSelector**: like position chips but for star rating (1–5)

All fields wire to `setAthlete()` on every change. Existing `InputCard` and `SectionHeader` reused throughout.

### Files modified
- `src/store/athleteStore.ts`
- `src/features/builder/components/IdentityForm.tsx`

