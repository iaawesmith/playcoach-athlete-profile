---
id: F-SEC-1
title: Permissive RLS on admin tables + public storage bucket listing (Sev-2)
status: open
severity: Sev-2
origin_slice: 1c.2-Slice-E
origin_doc: docs/process/phase-1c2-slice-e-outcome.md
related_adrs: [ADR-0001, ADR-0006]
related_entries: []
opened: 2026-04-26
last_updated: 2026-04-26
---

# F-SEC-1 — Permissive RLS on admin tables + public storage bucket listing (Sev-2)

- **Logged:** 2026-04-26, surfaced during Slice E E.2 migration security linter check.
- **Finding:** Multiple pre-existing RLS policies on admin-scoped tables use the permissive `USING (true) WITH CHECK (true)` pattern, granting any authenticated role full read/write/delete access. Additionally, the public storage bucket allows unrestricted listing of object keys. **Not introduced by Slice E** — predates Phase 1c.2 entirely. Surfaced here so it does not get lost in linter passing-notes.
- **Affected tables (permissive `ALL` policy to `public` role):**
  - `admin_enhancements` — "Allow all access to admin_enhancements"
  - `admin_implementation_docs` — "Allow all access to admin_implementation_docs"
  - `admin_reference_cache` — "Allow all access to admin_reference_cache"
  - `admin_reference_links` — "Allow all access to admin_reference_links"
  - `admin_tab_guidance` — "Allow all access to admin_tab_guidance"
  - `athlete_lab_nodes` — "Allow all access to athlete_lab_nodes"
  - `pipeline_setup_checklist` — "Allow all access to pipeline_setup_checklist"
  - (Plus `athlete-media` storage bucket, public + listable.)
- **Severity:** **Sev-2 — blocks Phase 3 athlete UI ship.** Once authenticated athlete users land on the platform, they will inherit the `public`/`authenticated` role grants and gain unrestricted read/write/delete on every admin-controlled table. This is a real shipping blocker, not a hygiene item. Per revised phase ordering (2026-04-26), F-SEC-1 is bundled into the Phase 2 analysis-quality + operational-obligations track so it lands before Phase 3 athlete UI work begins.
- **Required action before Phase 3 athlete UI ships (executed during Phase 2):**
  1. Replace all `USING (true) WITH CHECK (true)` policies on admin tables with role-based RLS (admin role for write; restrict reads on sensitive tables to admin/`service_role` only).
  2. Implement a `user_roles` table with `app_role` enum (`admin`, `athlete`, …) and `has_role(uuid, app_role)` SECURITY DEFINER function per workspace standard.
  3. Audit `athlete-media` bucket: either flip to private with signed URLs, or confirm contents are intentionally world-readable and document the decision.
  4. Re-run security linter; expect zero remaining permissive admin policies.
- **Out-of-scope rationale (Slice E):** Per Slice E halt discipline, scope was strictly the 8-column `athlete_lab_nodes` drop + NodeEditor save-payload edit. Touching RLS policies would have violated the scope ceiling and forced a halt. Logged here for Phase 2 planning (operational/security obligations bundle).
- **Cross-reference:** Slice E E.2 security linter output (`docs/phase-1c2-slice-e-outcome.md`).

---
