

## Investigation report — pending row `71ced7da`

### 1. Full row contents

| Field | Value |
|---|---|
| id | `71ced7da-8d33-42f2-a28e-d66ada77f1b4` |
| athlete_id | `16620206-314e-49a3-b77f-d468e256420c` |
| node_id | `75ed4b18-8a22-440e-9a23-b86204956056` (Slant Route) |
| node_version | 1 |
| video_url | `https://youtube.com/watch?v=Sz1G2wiyAIg` |
| start_seconds / end_seconds | 6 / 11 |
| camera_angle | sideline |
| status | **pending** |
| error_message | null |
| created_at | **2026-04-18 20:15:56 UTC** |

This is the **very first** test INSERT — the one from the original Phase 1 smoke test (before any infra fixes).

### 2. Timeline vs trigger creation

```text
20:15:56  ← row 71ced7da inserted (THIS row)
20:15:42  ← migration 20260418201542 (install pg_net)       *applied AFTER insert*
20:17:04  ← migration 20260418201704 (trigger refactor)     *applied AFTER insert*
20:17:17  ← first net._http_response recorded (status 500)  *first webhook ever fired*
```

The row was inserted **before `pg_net` was installed and before `trigger_analysis_on_upload` was wired to fire successfully**. At insert time, the trigger either didn't exist yet or failed silently inside its `exception when others` block (which is why the INSERT itself succeeded but no webhook fired).

### 3. Edge Function processing history

- Log search for `71ced7da`: **no matches**
- `net._http_response` for the relevant window: only one entry, at 20:17:17, which is a **later** test row, not this one
- **Conclusion**: the Edge Function has never been invoked for this row

### 4. Matching row in `athlete_lab_results`

- Search by upload id, athlete+node+timestamp window: **no rows**
- No analysis output exists for this upload

### Recommendation: **(b) Mark as `failed` with explanation**

Reasoning:
- It is **not orphaned junk** — it's a legitimate historical artifact of the Phase 1 test, and the schema now supports recording why it never completed (the `error_message` column we just added).
- It is **not a valid pending analysis** — it predates the working trigger by ~1 minute, was never picked up, and the trigger will never retroactively fire for it (triggers only fire on new INSERTs).
- Marking as `failed` keeps a clean audit trail consistent with the 4 other test rows we cleaned up earlier, and keeps the invariant "no row stays in `pending` indefinitely" true going forward.

Proposed update (will run after approval):

```sql
update public.athlete_uploads
set status = 'failed',
    error_message = 'Cleanup: predates pg_net install and trigger wiring (inserted 20:15:56, trigger became functional at 20:17:04). Never picked up by analyze-athlete-video.'
where id = '71ced7da-8d33-42f2-a28e-d66ada77f1b4'
  and status = 'pending';
```

After this, `SELECT count(*) FROM athlete_uploads WHERE status IN ('pending','processing')` should return 0 and the table will be in a clean baseline state for the next real test.

### What I will NOT do
- No deletion (preserves audit trail of the original test).
- No schema changes.
- No edits to the trigger, function, or any other row.

