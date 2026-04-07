

## Fix: CFBD Team Name Resolution

### Root Cause

The CFBD API uses short school names (e.g. `"BYU"`, `"Colorado"`, `"Alabama"`), but the athlete store contains display names with mascots (e.g. `"BYU Cougars"`, `"Colorado Buffaloes"`).

**Proof from live testing:**
- `roster("BYU", 2025)` → returns full roster (100+ players)
- `roster("BYU Cougars", 2025)` → returns `[]`

This means every CFBD call (roster, recruiting, portal, games) is sending the wrong team name and getting empty results.

### Fix — Two files, two changes

**1. `src/services/cfbd.ts` — Add a `resolveTeamName` function**

Add a new exported function that calls `/teams` to fetch the full team list, then finds the best match for the user's school string. Cache the result so it only fetches once per session.

```text
resolveTeamName("BYU Cougars")
  → fetches /teams (all teams)
  → finds { school: "BYU", mascot: "Cougars" }
  → returns "BYU"
```

Matching logic (in priority order):
1. Exact match on `school` field (case-insensitive)
2. `school + " " + mascot` equals input (e.g. "BYU" + "Cougars" = "BYU Cougars")
3. Input starts with school name (e.g. "Colorado Buffaloes" starts with "Colorado")
4. Alternate names match

Cache with a module-level `Map<string, string>` so repeat calls don't re-fetch.

**2. `src/hooks/useAutoFill.ts` — Call `resolveTeamName` before CFBD calls**

At the top of `runCfbdPhase`, before any API calls:

```typescript
const cfbdTeam = await resolveTeamName(school);
if (!cfbdTeam) {
  errors.push("team ✗ (no CFBD match for " + school + ")");
  return { espnId: null, errors };
}
```

Then pass `cfbdTeam` (not `school`) to all four CFBD calls: `roster()`, `recruitingPlayers()`, `playerPortal()`, `upcomingGames()`.

Also remove the old scoring gate logic (lines 246–284) and replace with simple name matching in the roster results, as was previously requested but the scoring gate (`bestScore >= 70`) is still present.

### What this fixes
- All CFBD calls will use the correct team name CFBD expects
- Roster, recruiting, portal, and games data will actually return results
- The error diagnostic will clearly show if team resolution failed vs. other issues

