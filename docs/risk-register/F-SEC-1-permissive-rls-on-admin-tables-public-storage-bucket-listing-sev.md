---
id: F-SEC-1
title: Permissive RLS on admin tables + public storage bucket listing (Sev-2)
status: open
severity: Sev-2
origin_slice: 1c.2-Slice-E
origin_doc: docs/process/phase-1c2-slice-e-outcome.md
related_adrs: [ADR-0001, ADR-0006]
related_entries: [R-01, R-02, R-03, R-04, R-06, R-08, R-09]
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

## §2 — Top 3 risks (heatmap)

Ranked by Severity × Likelihood × Reversibility:

1. **R-04 — Backup table omits a text-bearing field** — Sev-1, irreversible. The single risk where a mistake permanently loses admin-authored content. Pre-migration assertion is non-negotiable.
2. **R-02 — System-param substitution fix silently changes Claude output** — Sev-2, reversible (flag flip), but high likelihood and affects every athlete the moment it ships. Per-node feature flag is the right control.
3. **R-01 — Mechanics → Phases content migration misattributes coaching cues** — Sev-2, partially reversible (backup table preserves source), but the path of least surprise is the side-by-side admin confirmation cycle in 1c.1.

The risks that look scariest at first glance (R-08 service contract, R-06 det_frequency resolution) are actually controllable through ordering — they only become Sev-1 if the migration sequence is wrong, which is a planning problem, not an unknown.

---

## §3 — Recommended starting point for Phase 1c.1

Given the risk profile, the right first slice of 1c.1 is the **lowest-risk highest-value** capability to activate from the End-State plan:

> **Wire `{{phase_context}}` into the Claude prompt (audit P0 #3), gated behind a per-node opt-in flag.**

Reasoning:
- It's the first capability with **no DB schema change** and **no deletion** — pure additive code work in the edge function.
- It directly tests R-03 (token budget) on real data without committing to the rollout.
- It lays the groundwork for R-01 (Mechanics merge) by establishing where coaching cues belong end-to-end before we ask admins to confirm phase attribution.
- It avoids touching the system-prompt substitution path (R-02) until we've proven the new template-variable expansion works in the user-prompt path first.

The system-param substitution fix (R-02) is P0 by audit ranking but should be the **second** 1c.1 slice, after `{{phase_context}}` has shaken out the template-variable plumbing.

DB schema work (1c.2) starts only after both 1c.1 slices have one full week of clean runs in production.

---

## §3.5 — Methodological note: comparison invariants across migration boundaries

**Established:** 2026-04-25, during Phase 1c.2 Slice A R-04 backup-completeness assertion.

When asserting parity of values captured before vs. after a migration boundary, the correct comparison invariant depends on the data shape — not on whether the column happens to be `text` or `jsonb` in Postgres:

| Data shape | Correct invariant | Why |
|---|---|---|
| Plain text columns (markdown, prose, identifiers) | **Byte-equal** | No re-rendering occurs; any byte drift indicates real corruption. |
| JSONB sources, or any structure that is parsed and re-serialized across the boundary | **Semantic deep-equal** of parsed objects | PostgreSQL's `::text` cast on JSONB normalizes whitespace and key order differently than JS `JSON.stringify`. Byte-equal will produce false negatives even when the data is identical. |
| Sets of extracted tokens (e.g., `{{var}}` references in a template, enum values present, column names produced) | **Set equality** | Order and multiplicity are not invariants; membership is. Neither byte- nor deep-equal models the actual contract. |
| Numeric resolved values (e.g., the integer `det_frequency` after fallback resolution) | **Byte-equal on the canonical string form**, or `===` on parsed numbers | Once resolved to a scalar, there is no representational ambiguity; byte-equal is sufficient and the strictest. |

**Application to Phase 1c.2 assertions:**

- **R-04 (backup completeness):** Mixed — text fields use byte-equal, JSONB sources use semantic deep-equal. Implemented in `scripts/verification/slice1c2_r04_backup_assert.ts`.
- **R-06 (`det_frequency` parity across collapse):** Byte-equal on the persisted resolved integer. The resolver outputs a scalar; no JSON re-serialization occurs.
- **R-09 (template-variable resolution after deletes):** Set equality of `{{var}}` tokens extracted from `llm_prompt_template` and `llm_system_instructions`, cross-checked against the post-1c.2 known-variable list. Neither byte- nor deep-equal applies — the contract is "every referenced variable resolves to a non-empty value."

**Discipline for future phases:** Before writing any new R-xx assertion script, name the data shape first and pick the invariant from this table. Do not default to byte-equal because the column type is `text`; do not default to deep-equal because the column type is `jsonb`. The shape of the data and what crosses the boundary determines the invariant.

---


## §4 — Closing summary

- **12 risks enumerated** across 1c.1 (functional), 1c.2 (deletion), 1c.3 (UI consolidation), and post-1c hygiene.
- **1 Sev-1 risk** (R-04, backup completeness) — controlled by a pre-migration assertion that must pass for every node before any DROP runs.
- **4 Sev-2 risks** — all controllable via sequencing, feature flags, or side-by-side admin confirmation.
- **Backup table** is named `athlete_lab_nodes_phase1c_backup`, includes a `disposition` column carrying the End-State earmark label, and is retained indefinitely until explicitly archived (per Default B addition).
- **Recommended 1c.1 starting point:** `{{phase_context}}` wiring with per-node opt-in. Lowest risk, highest information yield, sets up the harder migrations safely.

End of Phase 1c.0 foundation batch.

---

## §5 — Slice E E.5 findings (appended 2026-04-26)
