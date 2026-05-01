---
id: F-OPS-1
title: Zombie upload accumulation rate (Sev-3)
status: open
severity: Sev-3
origin_slice: 1c.2-Slice-E
origin_doc: docs/process/phase-1c2-slice-e-outcome.md
related_adrs: [ADR-0006]
related_entries: [F-OPS-5]
opened: 2026-04-26
last_updated: 2026-05-01
---

# F-OPS-1 — Zombie upload accumulation rate (Sev-3)

- **Logged:** 2026-04-26, Slice E E.1 Gate 5 halt
- **Finding:** 3 `athlete_uploads` rows stuck in `processing` state for ~72h with no `error_message`, `progress_message`, or result. Pattern suggests edge function termination without graceful failure-status write. Observed rate: ~1 zombie/day on current system load.
- **Affected rows (cleaned up via H1):** `70539f0f-a66a-4fe5-afe5-b3a28c84ef33`, `8cff69b5-7294-4ad2-9f9a-c4be08971def`, `65b0544b-6da3-460a-b237-71ab5803181d`. All three updated to `status='failed'` with diagnostic `error_message` referencing F-OPS-1.
- **Severity:** Sev-3 (operational hygiene; doesn't break system but pollutes data and breaks "what's running" queries; will silently false-fail any future pre-flight gate that checks for in-flight uploads).
- **Hypothesized causes (not investigated):** Cloud Run timeout without exception handling, edge function crash without status write, database connection loss mid-analysis, Supabase function instance recycling mid-run.
- **Action:** Not investigated as part of 1c.2. Bundled into Phase 2 (analysis quality) operational obligations per revised phase ordering — escalate earlier if rate increases. Recommended remediation:
  - Add automated zombie-sweep job: any `processing` upload with `created_at < now() - interval '2 hours'` → mark `failed` with `error_message='auto-zombie-sweep'`.
  - Add alerting on `processing` rows older than 30 minutes.
  - Wrap `analyze-athlete-video` in a top-level try/finally that always writes a terminal status, even on `Deno.exit`/`SIGTERM`.
- **Cross-reference:** Slice E E.1 Gate 5 (`docs/phase-1c2-slice-e-outcome.md` §8); H1 cleanup applied 2026-04-26.
