# Phase 1c Risk Register — Index

**Source:** Split from `docs/migration-risk-register.md` during Phase 1c.2 cleanup (Pass 4, 2026-04-26). One file per entry. Schema in [`_schema.md`](_schema.md). Original combined doc is now an R2 redirect stub.

**Counts (reconciled in PHASE-1C3-SLICE-F, 2026-04-30):** **25 total entries** — 12 risks (`R-01`–`R-12`) and **13 findings** (`F-*`). Plus **10 verification tasks** (`V-1c.3-01`–`V-1c.3-10`) tracked in [`docs/process/phase-1c3-prep-backlog.md`](../process/phase-1c3-prep-backlog.md). Status distribution at Phase 1c.3 close: risks — 8 open, 3 mitigated (R-01, R-05, R-07), 1 closed (R-12); findings — 9 open, 1 deferred (F-SLICE-B-1), 3 resolved (F-SLICE-E-4, E-5, E-6). Earlier "26 entries / 14 findings / 9 verification tasks" narrative was drift; reconciled here.

**Severity scale** (unchanged from source):
- **Sev-1** — blocks production analyses
- **Sev-2** — silent correctness drift in admin output, Claude prompt, or athlete UX
- **Sev-3** — admin UX confusion, no data loss
- **Sev-4** — cleanup hygiene only
- **none** — process lesson, no severity (e.g., F-SLICE-E-3)

---

## §1 — Risk register (R-NN)

| ID | Title | Status | Severity | Origin slice | Related ADRs | Related entries |
|---|---|---|---|---|---|---|
| [R-01](R-01-mechanics-phases-content-migration-loses-or-duplicates-coaching-cues.md) | Mechanics → Phases content migration loses or duplicates coaching cues | mitigated | Sev-2 | 1c.1 | — | — |
| [R-02](R-02-system-parameter-substitution-fix-changes-claude-output-for-already-passing.md) | System-parameter substitution fix changes Claude output for already-passing nodes | open | Sev-2 | 1c.1 | — | — |
| [R-03](R-03-phase-context-injection-blows-past-claude-token-budget.md) | `{{phase_context}}` injection blows past Claude token budget | open | Sev-3 | 1c.1 | — | — |
| [R-04](R-04-backup-table-omits-a-text-bearing-field-making-rollback-impossible.md) | Backup table omits a text-bearing field, making rollback impossible | open | Sev-1 | 1c.2 | ADR-0007, ADR-0012 | — |
| [R-05](R-05-tab-consolidation-hides-existing-draft-state-content-from-admins.md) | Tab consolidation hides existing draft-state content from admins | mitigated | Sev-3 | 1c.3 | — | R-12, F-OPS-4 |
| [R-06](R-06-det-frequency-defender--multiple-deletion-breaks-scenario-resolution-for-nodes-t.md) | `det_frequency_defender`/`_multiple` deletion breaks scenario resolution for nodes that never set `det_frequency_solo` | open | Sev-2 | 1c.2 | — | — |
| [R-07](R-07-earmarked-but-deleted-athlete-ui-fields-lose-institutional-memory.md) | Earmarked-but-deleted athlete-UI fields lose institutional memory | mitigated | Sev-3 | 1c.2 | ADR-0007, ADR-0012 | F-OPS-4 |
| [R-08](R-08-removing-solution-class-performance-mode-tracking-enabled-breaks-the-cloud-run-r.md) | Removing `solution_class`, `performance_mode`, `tracking_enabled` breaks the Cloud Run request shape | open | Sev-1 | 1c.2 | — | — |
| [R-09](R-09-claude-prompt-template-references-a-deleted-variable.md) | Claude prompt template references a deleted variable | open | Sev-2 | 1c.2 | — | — |
| [R-10](R-10-backup-table-grows-unbounded-over-future-migrations.md) | Backup table grows unbounded over future migrations | open | Sev-4 | 1c.0 | ADR-0012 | — |
| [R-11](R-11-score-bands-field-stays-orphaned-kept-but-no-consumer.md) | `score_bands` field stays orphaned (kept but no consumer) | open | Sev-4 | 1c.0 | — | — |
| [R-12](R-12-mechanics-tab-deletion-strands-knowledge-base-sub-sections-keyed-to-mechanics.md) | Mechanics tab deletion strands knowledge_base sub-sections keyed to "mechanics" | closed | Sev-3 | 1c.2 | ADR-0015 | F-OPS-3, F-OPS-4 |

## §1.5 — Findings (F-*)

| ID | Title | Status | Severity | Origin slice | Related ADRs | Related entries |
|---|---|---|---|---|---|---|
| [F-OPS-1](F-OPS-1-zombie-upload-accumulation-rate-sev-3.md) | Zombie upload accumulation rate | open | Sev-3 | 1c.2-Slice-E | ADR-0006 | — |
| [F-OPS-2](F-OPS-2-missing-error-boundary-around-nodeeditor-phase-3-ship-blocker.md) | Missing error boundary around NodeEditor (Phase 3 ship blocker) | open | Sev-2 | 1c.2-Slice-E.5 | ADR-0006 | F-SLICE-E-4 |
| [F-OPS-3](F-OPS-3-deferred-work-shipped-earlier-creates-plan-vs-state-drift.md) | Deferred work shipped earlier creates plan-vs-state drift | open | none | 1c.3-Slice-B | ADR-0015 | R-12, F-OPS-4 |
| [F-OPS-4](F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md) | Pre-execution inspection scope systematically underestimates reality | open | none | 1c.3-Slice-B | ADR-0015 | R-12, F-OPS-3 |
| [F-SEC-1](F-SEC-1-permissive-rls-on-admin-tables-public-storage-bucket-listing-sev.md) | Permissive RLS on admin tables + public storage bucket listing | open | Sev-2 | 1c.2-Slice-E | ADR-0001, ADR-0006 | — |
| [F-SLICE-B-1](F-SLICE-B-1-both-calibration-paths-produce-2-6-distance-errors-static-only.md) | Both calibration paths produce 2–6× distance errors; static-only is fundamentally limited for multi-context filming | deferred | Sev-2 | 1c.2-Slice-B | ADR-0004, ADR-0014 | — |
| [F-SLICE-B1-2](F-SLICE-B1-2-release-speed-metric-correctness-on-slant-route-reference-v1-mp4.md) | Release Speed metric correctness on `slant-route-reference-v1.mp4` (REFRAMED 2026-04-26) | open | Sev-3 | 1c.2-Slice-B1 | ADR-0004 | — |
| [F-SLICE-E-1](F-SLICE-E-1-det-frequency-complex-consolidation-deferred-sev-3.md) | `det_frequency` complex consolidation deferred | open | Sev-3 | 1c.2-Slice-E | — | — |
| [F-SLICE-E-2](F-SLICE-E-2-pipeline-calibration-audit-shows-0-78-non-deterministic-drift-on-identical.md) | Pipeline `calibration_audit` shows ~0.78% non-deterministic drift on identical inputs | open | Sev-2 | 1c.2-Slice-E | ADR-0004, ADR-0005, ADR-0006 | — |
| [F-SLICE-E-3](F-SLICE-E-3-recipe-propagation-without-independent-verification-process-lesson-no-severity.md) | Recipe propagation without independent verification (process lesson) | open | none | 1c.2-Slice-E | — | — |
| [F-SLICE-E-4](F-SLICE-E-4-mechanics-tab-crash-post-pro-mechanics-drop.md) | Mechanics tab crash post-`pro_mechanics` drop | resolved | Sev-3 | 1c.2-Slice-E.5 | ADR-0015 | — |
| [F-SLICE-E-5](F-SLICE-E-5-solution-class-radio-control-writes-to-dropped-column.md) | Solution Class radio control writes to dropped column | resolved | Sev-3 | 1c.2-Slice-E.5 | — | F-SEC-1, F-SLICE-E-4, F-SLICE-E-6 |
| [F-SLICE-E-6](F-SLICE-E-6-training-status-write-paths-class-defect.md) | Training Status tab write paths form a four-column defect class against dropped columns | resolved | Sev-3 | 1c.3-C | — | F-SLICE-E-5, F-OPS-4 |

---

## §2 — Top 3 risks (heatmap)

Ranked by Severity × Likelihood × Reversibility:

1. **R-04 — Backup table omits a text-bearing field** — Sev-1, irreversible. The single risk where a mistake permanently loses admin-authored content. Pre-migration assertion is non-negotiable. (Mitigated by ADR-0007 backup-snapshot pattern; assertion implemented in `scripts/verification/slice1c2_r04_backup_assert.ts`.)
2. **R-02 — System-param substitution fix silently changes Claude output** — Sev-2, reversible (flag flip), but high likelihood and affects every athlete the moment it ships. Per-node feature flag is the right control.
3. **R-01 — Mechanics → Phases content migration misattributes coaching cues** — Sev-2, partially reversible (backup table preserves source), but the path of least surprise is the side-by-side admin confirmation cycle in 1c.1. **Status: mitigated — Slice 2 shipped.**

The risks that look scariest at first glance (R-08 service contract, R-06 `det_frequency` resolution) are actually controllable through ordering — they only become Sev-1 if the migration sequence is wrong, which is a planning problem, not an unknown.

---

## §3 — Recommended starting point for Phase 1c.1 (historical)

> **This recommendation has been executed.** Preserved for historical context — the actual 1c.1 sequence followed it.

Given the original risk profile, the right first slice of 1c.1 was the **lowest-risk highest-value** capability to activate from the End-State plan:

> **Wire `{{phase_context}}` into the Claude prompt (audit P0 #3), gated behind a per-node opt-in flag.**

Reasoning:
- It's the first capability with **no DB schema change** and **no deletion** — pure additive code work in the edge function.
- It directly tested R-03 (token budget) on real data without committing to the rollout.
- It laid the groundwork for R-01 (Mechanics merge) by establishing where coaching cues belong end-to-end before asking admins to confirm phase attribution.
- It avoided touching the system-prompt substitution path (R-02) until the new template-variable expansion was proven in the user-prompt path first.

The system-param substitution fix (R-02) was P0 by audit ranking but was the **second** 1c.1 slice, after `{{phase_context}}` shook out the template-variable plumbing.

DB schema work (1c.2) started only after both 1c.1 slices had clean runs in production.

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

## §4 — Closing summary (foundation batch, 2026-04-25)

- **12 risks enumerated** across 1c.1 (functional), 1c.2 (deletion), 1c.3 (UI consolidation), and post-1c hygiene.
- **1 Sev-1 risk** (R-04, backup completeness) — controlled by a pre-migration assertion that must pass for every node before any DROP runs.
- **4 Sev-2 risks** — all controllable via sequencing, feature flags, or side-by-side admin confirmation.
- **Backup table** is named `athlete_lab_nodes_phase1c_backup`, includes a `disposition` column carrying the End-State earmark label, and is retained indefinitely until explicitly archived (per Default B addition; see ADR-0012).
- **Recommended 1c.1 starting point:** `{{phase_context}}` wiring with per-node opt-in. Lowest risk, highest information yield, sets up the harder migrations safely.

End of Phase 1c.0 foundation batch.

**Post-foundation appendix:** Slice B / B1 / C / D / E and E.5 work added 10 findings (`F-SLICE-B-1` through `F-SLICE-E-5`, `F-OPS-1`, `F-OPS-2`, `F-SEC-1`) tracked above. ADR backfill (Pass 3d, 2026-04-26) provides 15 ADRs that mitigate or contextualize entries in this register; see [`../adr/INDEX.md`](../adr/INDEX.md).

---

## Phase ordering note (revised 2026-04-26)

Original audit / risk register entries were authored under an earlier ordering that placed athlete UI as Phase 2 and analysis quality as Phase 3. **Reordered 2026-04-26 to reflect actual product priority: athlete UI must not ship before analysis is trustworthy.** See [ADR-0006](../adr/0006-phase-ordering-metrics-before-ui.md).

**Current canonical ordering:**

- **Phase 1c.3** — Admin UI consolidation — **Complete (2026-04-30)**. Six slices A–F shipped; synthesis in [`../process/phase-1c3-retrospective.md`](../process/phase-1c3-retrospective.md). See also [`../architecture/athlete-lab-tab-inventory.md`](../architecture/athlete-lab-tab-inventory.md) and [`../process/phase-1c3-prep-backlog.md`](../process/phase-1c3-prep-backlog.md).
- **Phase 2 — Analysis quality** (was "Phase 3" in earlier docs) — **2a is next**:
  - **2a** — World coordinates migration (B2 redesign of calibration).
  - **2b** — Metric formula audits.
  - **2c** — Tier-aware scoring.
  - **Plus operational/security obligations:** F-SEC-1 (RLS hardening), F-OPS-2 (error boundaries), F-OPS-1 (zombie cleanup), F-SLICE-E-2 (determinism investigation).
- **Phase 3 — Athlete UI** (was "Phase 2" in earlier docs): builds on the stable analysis foundation produced by Phase 2.

---

## How to add a new entry

1. Pick the next available ID for the series (`R-13`, `F-<area>-<n>`).
2. Create a file using the schema in [`_schema.md`](_schema.md).
3. Add a row to the appropriate table in this INDEX.
4. If the entry references an existing entry, update both `related_entries` lists (this entry → other; other → this entry).
5. If a new ADR is opened to mitigate the entry, link both the ADR's `related_risks`/`related_findings` and this entry's `related_adrs`.
