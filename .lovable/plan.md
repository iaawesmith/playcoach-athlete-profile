

## Revamp 247Sports to Transfer + Prospect Sections

### What's Changing

The current 247 parser targets the high-school recruiting slug (`/high-school-{id}/`). The user wants the **college profile** slug instead (`/player/{slug}-{id}/`), which contains two ranking sections:

1. **"247Sports Transfer Rankings"** — current transfer portal ratings
2. **"247Sports"** — original prospect (high school) ratings

These should appear in the builder's 247 tab as two distinct sections with a toggle or divider, replacing the current flat list of proprietary + composite fields.

### New Data Model

**Store fields to add** (in `athleteStore.ts`):
- `transferStars247: number | null` (badge: 247T)
- `transferRating247: number | null` (badge: 247T)
- `transferOvrRank247: number | null` (badge: 247T)
- `transferPositionRank247: number | null` (badge: 247T)
- `prospectStars247: number | null` (badge: 247P)
- `prospectRating247: number | null` (badge: 247P)
- `prospectNatlRank247: number | null` (badge: 247P)
- `prospectPositionRank247: number | null` (badge: 247P)
- `prospectStateRank247: number | null` (badge: 247P)

**Existing fields to remove/repurpose**: `stars247`, `rating247`, `compositeStars247`, `compositeRating247`, `compositeNationalRank247`, `compositePositionRank247`, `compositeStateRank247` — replace with the new transfer/prospect fields above.

### Changes by File

**1. `supabase/functions/firecrawl-profile/index.ts`**

- **Remove** `high-school` preference from `score247Url` — the college profile slug (`/player/{slug}-{id}/`) is what we want now
- **Rewrite `parse247RecruitingData`** to extract from two sections:
  - Transfer section: identified by `<h3 class="title">247Sports Transfer Rankings</h3>`
    - Stars: count `icon-starsolid yellow` spans inside the section's `stars-block`
    - Rating: numeric value in `rank-block` (e.g. 98)
    - OVR Rank: `<b>OVR</b>` → following `<strong>N</strong>`
    - Position Rank: `<b>{POS}</b>` (matched against CFBD position) → following `<strong>N</strong>`
  - Prospect section: identified by `<h3 class="title">247Sports</h3>` (already parsed, just rename output keys)
    - Stars: count `icon-starsolid yellow`
    - Rating: numeric in `rank-block`
    - Natl. Rank: `<b>Natl. </b>` → `<strong>N</strong>` (in non-composite `recruitrankings` URLs)
    - Position Rank: `<b>{POS}</b>` → `<strong>N</strong>`
    - State Rank: `<b>{ST}</b>` → `<strong>N</strong>` (state abbreviation from CFBD hometown)
- Return new field names: `transferStars247`, `transferRating247`, `transferOvrRank247`, `transferPositionRank247`, `prospectStars247`, `prospectRating247`, `prospectNatlRank247`, `prospectPositionRank247`, `prospectStateRank247`
- Remove search query `high-school` suffix — just search `site:247sports.com/player/ {name} {school}`

**2. `src/store/athleteStore.ts`**

- Add 9 new fields (transfer + prospect) with `null` defaults
- Remove old 7 composite/proprietary fields (`stars247`, `rating247`, `compositeStars247`, etc.)
- Update `MissingField.source` type to include `"247T"` and `"247P"`
- Update defaults object

**3. `src/hooks/useAutoFill.ts`**

- Update field mapping in `runFirecrawlPhase` to read new keys from backend
- Update `fieldLabels` with new human-readable labels (e.g. "Stars (Transfer)", "OVR Rank", etc.)
- Update `immediateRatingFields` to write new keys to store
- Update missing-field tracking to check transfer vs prospect fields separately
- Source badges: `"247T"` for transfer fields, `"247P"` for prospect fields

**4. `src/features/builder/components/IdentityForm.tsx`**

- Replace the 247 tab content with two sections separated by a divider:
  - **"As a Transfer"** — `transferStars247`, `transferRating247`, `transferOvrRank247`, `transferPositionRank247` with badge `247T`
  - **"As a Prospect"** — `prospectStars247`, `prospectRating247`, `prospectNatlRank247`, `prospectPositionRank247`, `prospectStateRank247` with badge `247P`
- Position label dynamically derived from CFBD position
- State abbreviation derived from CFBD hometown for state rank label
- Remove old composite fields display

**5. `src/services/firecrawl.ts`**

- Update `Extracted247Data` type to match new field names

**6. `src/features/builder/components/ProCard.tsx`**

- Update rating display to use new field names (use `transferRating247` or `prospectRating247` as fallback)

### Not Changing
- On3 logic — untouched
- CFBD logic — untouched
- Action photo extraction — keep as-is (already works on the college profile page)
- Discovery logic — the URL scoring will actually improve since we no longer prefer `high-school` URLs

