

## Add Error Logging to Auto-Fill Pipeline

### Problem
The auto-fill pipeline fails with "No Results Found" but provides zero diagnostic information. The catch block at line 510 of `useAutoFill.ts` swallows all errors with a generic message. CFBD edge function logs show only "booted" — no request processing. There's no way to identify which phase, which API call, or which specific error caused the failure.

### Changes

**File: `src/hooks/useAutoFill.ts`**

1. **Add detailed error capture to the main `scrape` function** — Replace the generic catch with one that captures and displays the actual error message, including which phase failed (CFBD vs Firecrawl).

2. **Wrap Phase 1 (CFBD) in try/catch with per-call error tracking** — Each of the 5 parallel CFBD calls (`roster`, `recruitingPlayers`, `teams`, `playerPortal`, `upcomingGames`) should use `Promise.allSettled` instead of `Promise.all` so one failing call doesn't kill the entire phase. Log which calls succeeded and which failed.

3. **Wrap Phase 2 (Firecrawl) in try/catch with error details** — Capture and surface the specific error from 247Sports and On3 calls rather than silently swallowing them.

4. **Surface error details in the error message** — Instead of "Auto-fill failed. Please try again.", show something like "CFBD roster lookup failed: 500 Internal Server Error" or "247Sports scrape failed: timeout" so the developer can diagnose issues.

5. **Prevent Phase 1 failure from blocking Phase 2** — Wrap `runCfbdPhase()` in its own try/catch so if CFBD fails, the Firecrawl phase still runs. Currently a CFBD error bubbles up and kills everything.

**File: `supabase/functions/cfbd-api/index.ts`**

6. **Add request logging** — Log the incoming endpoint and params so we can see what's actually being requested in the edge function logs. Currently only "booted" appears.

### Technical Detail

The key structural change is switching from `Promise.all` to `Promise.allSettled` for the 5 parallel CFBD calls. This means if, for example, the portal API returns a 404, the roster, teams, recruiting, and games data still gets written to the store. The error message will accumulate a list of what failed for debugging.

The `errorMessage` state will contain structured info like:
```
Phase 1 (CFBD): roster ✓, recruiting ✓, teams ✓, portal ✗ (404), games ✓
Phase 2: 247Sports ✗ (scrape timeout), On3 ✓
```

This gives immediate visibility into which specific call is failing without needing to check edge function logs.

