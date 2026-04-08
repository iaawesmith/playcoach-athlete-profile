

## Fix: CFBD Stars "Source not reached" + 247 "Player not matched" + Action Photo

### Root Causes Found

**1. Stars (CFBD) — "Source not reached" is misleading but correct-ish**

The CFBD recruiting endpoint (`/recruiting/players`) filters by `committedTo` school. Transfer players like Julian Sayin (committed to Alabama, transferred to Ohio State) won't appear in Ohio State's recruiting list. The endpoint succeeds (HTTP 200) but the player isn't in the results. The code at line 611 checks for `"recruiting" + "✗"` in error messages to determine `cfbdRecruitReached`. When recruiting returns data but the player isn't found, `cfbdRecruitReached` stays `true` and `cfbdRecruitFound` is `false` — but the error message includes `recruiting ✗`, which flips `cfbdRecruitReached` to `false`, causing "Source not reached" instead of the correct "Player not matched".

**Fix**: Change the `cfbdRecruitReached` logic. The source WAS reached (HTTP 200 returned data) — the player just wasn't in it. The condition should distinguish between "endpoint failed" and "player not in results".

**2. 247 — "Player not matched" is wrong; data IS returned**

The edge function returns: `{stars247: 5, playerRating247: 98, positionRank: 3, ...}`.

Two bugs prevent this from reaching the store:
- **Field name mismatch**: Backend returns `playerRating247` but frontend reads `d.rating247` (line 402). So `rating247` is always null.
- **`stars247` never written to store**: The `immediateRatingFields` block (lines 482-488) writes `compositeRating247`, `compositeStars247`, etc. but skips `stars247` and `rating247`. They only go into the `data` object for field entries. So `storeAfter.stars247` is null when the missing-fields check runs at line 665, making `has247Data` false, which triggers "Player not matched".

**Fix**: 
- Read `d.playerRating247` (matching backend key) and write it as `rating247`
- Add `stars247` and `rating247` to the `immediateRatingFields` block so they get written to the store

**3. 247 Action Photo — returns 100px thumbnail**

The edge function finds a 247 image but it's `?fit=crop&width=100` — a tiny thumbnail. Should strip or replace the width param to get a usable resolution.

**Fix**: In the edge function, strip `width=100` or replace with `width=800` on 247 CDN URLs before returning.

### Changes

**File 1: `src/hooks/useAutoFill.ts`**
- Line 402: Change `d.rating247` to `d.playerRating247` (match backend key)
- Lines 482-488: Add `stars247` and `rating247` to `immediateRatingFields` so they get written to the store
- Lines 607-612: Fix `cfbdRecruitReached` logic — track it based on whether the API call itself failed, not the presence of "✗" in error messages. If the endpoint returned data (even if the player wasn't matched), the source was reached.

**File 2: `supabase/functions/firecrawl-profile/index.ts`**
- In the 247 action photo extraction, strip or replace `width=100` with a larger width (e.g., `width=800`) on `s3media.247sports.com` URLs before returning

### Expected Outcome
- CFBD recruiting for transfer players: "Player not matched" (accurate) instead of "Source not reached"
- 247 Stars and Rating: appear in found data, not missing fields
- 247 composite fields still show as "Parsing failed" if the page didn't have composite data (which is accurate — Julian Sayin's 247 page apparently lacks composite section)
- 247 action photo returns at usable resolution

