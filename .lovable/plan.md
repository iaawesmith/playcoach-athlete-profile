## Cap clip window at 3s for launch — execution plan (ready)

Five changes, plus your two clarifications baked in:
1. **No new triggers** — migration is data-only. Smoke test will be invoked manually from your terminal.
2. **`clip_duration_min` 4 → 3 on Slant is intentional and persistent** — flagged in Ticket 3 doc as a "revisit when 6s unlocks" item.

---

### Change 1 — `mediapipe-service/app/main.py` line 26

```diff
- MAX_WINDOW_SECONDS = 30.0
+ MAX_WINDOW_SECONDS = 3.0
```

Existing 400 guard at lines 56–61 already returns `clip window must be <= 3.0s (got X.XXs)`.

---

### Change 2 — `supabase/functions/analyze-athlete-video/index.ts`

**Add constant after line 9:**
```diff
  const RTMLIB_FALLBACK =
    'https://rtmlib-service-874407535869.us-central1.run.app'
+
+ const MAX_CLIP_WINDOW_SECONDS = 3
```

**Insert third preflight check at line 880 inside `runPreflight`:**
```diff
      {
        name: 'Clip duration',
        expected: `${nodeConfig.clip_duration_min}-${nodeConfig.clip_duration_max}s`,
        actual: `${duration}s`,
        result: duration < nodeConfig.clip_duration_min || duration > nodeConfig.clip_duration_max ? 'FAIL' as const : 'PASS' as const,
      },
+     {
+       name: 'Launch clip cap',
+       expected: `<= ${MAX_CLIP_WINDOW_SECONDS}s (3-second clips are currently supported; longer clips coming soon)`,
+       actual: `${duration}s`,
+       result: duration > MAX_CLIP_WINDOW_SECONDS ? 'FAIL' as const : 'PASS' as const,
+     },
      {
        name: 'Node status',
```

Existing `failedCheck` handler turns the FAIL into a 400 + `error_message` on the upload row. User-facing message: `Launch clip cap: 6s`.

---

### Change 3 — `src/features/athlete-lab/components/TestingPanel.tsx`

**Add constant near top (~line 18):**
```diff
+ const MAX_CLIP_WINDOW_SECONDS = 3
```

**Default state at line 201:**
```diff
- const [endSeconds, setEndSeconds] = useState(node.clip_duration_max.toString());
+ const [endSeconds, setEndSeconds] = useState(
+   Math.min(node.clip_duration_max, MAX_CLIP_WINDOW_SECONDS).toString(),
+ );
```

**Submit clamp at lines 338–341:**
```diff
  const parsedEndSeconds = endSeconds.trim() ? Number(endSeconds) : Number.NaN;
- const normalizedEndSeconds = Number.isFinite(parsedEndSeconds)
-   ? Math.min(Math.max(parsedEndSeconds, node.clip_duration_min), node.clip_duration_max)
-   : node.clip_duration_max;
+ const effectiveMax = Math.min(node.clip_duration_max, MAX_CLIP_WINDOW_SECONDS);
+ const effectiveMin = Math.min(node.clip_duration_min, effectiveMax);
+ const normalizedEndSeconds = Number.isFinite(parsedEndSeconds)
+   ? Math.min(Math.max(parsedEndSeconds, effectiveMin), effectiveMax)
+   : effectiveMax;
```

**Input + helper text at lines 712–721:**
```diff
  <input
    type="number"
-   min={node.clip_duration_min}
-   max={node.clip_duration_max}
+   min={Math.min(node.clip_duration_min, MAX_CLIP_WINDOW_SECONDS)}
+   max={MAX_CLIP_WINDOW_SECONDS}
    step="0.1"
    value={endSeconds}
    onChange={(e) => setEndSeconds(e.target.value)}
    className="..."
  />
- <p className="...">Start seconds are fixed at 0. End seconds are clamped to this node's allowed clip window of {node.clip_duration_min}–{node.clip_duration_max}s.</p>
+ <p className="...">3-second clips are currently supported; longer clips coming soon. Start seconds are fixed at 0; end seconds are clamped to {MAX_CLIP_WINDOW_SECONDS}s.</p>
```

NodeEditor elite-video clip inputs (admin-side reference clips for LLM context) intentionally **left untouched** — they don't drive `/analyze` submissions.

---

### Change 4 — Append "Ticket 3" section to `.lovable/plan.md`

```markdown
---

## Ticket 3 — 6-second clip support (deferred)

**Status:** deferred for launch. Clip window hard-capped at 3s in main.py
(`MAX_WINDOW_SECONDS = 3.0`), edge preflight (`MAX_CLIP_WINDOW_SECONDS = 3`),
and TestingPanel UI.

**Diagnosis (current run, upload 66ea5e98, 6s Slant clip):**
- Cloud Run instance dies mid-pose-loop ~2 minutes into processing.
- No `stream complete` log emitted from `run_pipeline()` finally block.
- No `analyze done` line.
- No FastAPI exception traceback.
- Container exits silently — consistent with SIGKILL from the platform
  (OOM or CPU throttle), not a Python-level crash.
- Keepalives were firing during the window (Ticket 2 working as designed) —
  the death is inside the pose loop, not a GFE timeout.

**Candidate fixes to investigate (separate session):**
1. Memory bump: Cloud Run instance from current limit to 16 GiB. Cheapest first try.
2. `TARGET_FPS` reduction in `video.py` from 30 → 15. Halves frame count fed
   to pose loop, roughly halves peak memory and pose-loop wall time.
   Trade-off: lower temporal resolution for metric calculations — needs
   validation against existing reference clips.
3. Pose loop chunking: process frames in batches of N with intermediate
   yields, instead of one synchronous `run_with_skip` call across all frames.
   Bounds peak memory regardless of clip length.

**Side effects to revisit when 6s unlocks:**
- Slant node `clip_duration_min` was lowered from 4 → 3 (and `clip_duration_max`
  from 15 → 3) in the launch migration so the existing "Clip duration"
  preflight check would pass alongside the new "Launch clip cap" check.
  When the 3s ceiling is removed, restore Slant's intended bounds (4–15s
  was the pre-launch config) or whatever the new product spec dictates.

**Requires fresh debugging session** with Cloud Run console access for
memory/CPU graphs at the moment of kill.
```

---

### Change 5 — Migration (data-only, no triggers)

```sql
-- Lower Slant clip duration bounds so 3s clips pass the existing
-- "Clip duration" preflight alongside the new "Launch clip cap".
-- INTENTIONAL + PERSISTENT — revisit when 6s unlocks (see Ticket 3 doc).
update public.athlete_lab_nodes
set clip_duration_min = 3,
    clip_duration_max = 3,
    updated_at = now()
where id = '75ed4b18-8a22-440e-9a23-b86204956056';

-- Reset the smoke-test upload: 3s window, pending, clear prior error.
-- No trigger fires on UPDATE — invoke analyze-athlete-video manually
-- from terminal with this row as the webhook payload.
update public.athlete_uploads
set status = 'pending',
    start_seconds = 0,
    end_seconds = 3,
    error_message = null,
    progress_message = null
where id = '66ea5e98-ff65-4d20-9e9e-232753d198aa';
```

Slant is already `live` — no status flip needed.

---

### Execution order on approval
1. `main.py` line 26.
2. `analyze-athlete-video/index.ts` — constant + preflight check.
3. `TestingPanel.tsx` — constant, default state, submit clamp, input attrs, helper text.
4. Append Ticket 3 section to `.lovable/plan.md`.
5. Run migration via insert tool (two UPDATEs).

Cloud Run rebuild for `main.py` is your manual step — same flow as Ticket 2.