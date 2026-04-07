
Problem confirmed: the team resolution is working, but the matching logic in `useAutoFill.ts` is reading the wrong CFBD field names. Live CFBD responses are camelCase (`firstName`, `lastName`, `homeCity`, `homeState`), while the current hook still looks for snake_case (`first_name`, `last_name`, `home_city`, `home_state`, `headshot_url`). That guarantees false “no name match” results even when the player exists.

Plan

1. Fix roster matching in `src/hooks/useAutoFill.ts`
- Replace roster name matching to read `firstName` / `lastName`, with snake_case only as fallback.
- Keep the requested exact-match first, last-name fallback second behavior.
- Update the success log to print the matched camelCase name fields.

2. Fix roster field extraction in `src/hooks/useAutoFill.ts`
- Read CFBD roster values from actual live response keys:
  - `firstName`, `lastName`
  - `homeCity`, `homeState`
  - `jersey`, `position`, `year`, `height`, `weight`
  - `id` as ESPN/player identifier fallback
- Keep headshot/photo handling safe:
  - use `headshot_url` only if present
  - otherwise don’t fail the roster match just because headshot is missing
- Stop tying ESPN ID extraction only to `headshot_url`; also use roster `id` when available so the ESPN action-photo phase can still run.

3. Fix recruiting matching in `src/hooks/useAutoFill.ts`
- Keep `recruitingPlayers(team)` in `cfbd.ts`.
- Match recruits using `name` first, then optional `firstName`/`lastName` fallback if present.
- Add the same last-name fallback used for roster so nickname/format differences don’t kill the match.

4. Improve diagnostics in `src/hooks/useAutoFill.ts`
- Make the CFBD error text more actionable, for example:
  - `roster ✗ (response had 120 players, no match for "Chase Roberts")`
  - `recruiting ✗ (response had 340 recruits, no match for "Chase Roberts")`
- This keeps logging useful without adding `console.log` noise.

5. Clean up obsolete scoring code in `src/hooks/useAutoFill.ts`
- Remove the unused identity-scoring helpers at the top of the file (`fuzzyNameScore`, `scoreCandidateRoster`) since the current flow is roster-list matching, not scored identity resolution.
- This prevents future confusion and aligns the hook with the intended CFBD flow.

Expected outcome
- BYU will still resolve correctly.
- Roster matching should start finding players like Chase Roberts because it will compare against the actual returned keys.
- Recruiting matching will work when the recruit is present in school recruit history.
- If recruiting truly has no record, the diagnostics will clearly say it was a real miss rather than a broken parser.

Technical note
```text
Current bug:
useAutoFill expects:   first_name / last_name / home_city / home_state
CFBD actually returns: firstName  / lastName  / homeCity  / homeState
```
That mismatch is the direct reason you’re seeing:
```text
team ✓ (BYU), roster ✗ (no name match), recruiting ✗ (no name match)
```
even though the API itself is returning valid BYU data.
