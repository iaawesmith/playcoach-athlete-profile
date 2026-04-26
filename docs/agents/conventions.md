# Repo Conventions

Operational rules for working in this repo. New conventions enter via the same passes that introduce the work they govern. When a doc disagrees with this file, this file wins.

---

## File naming

| Kind | Convention | Example |
|---|---|---|
| React component | `PascalCase.tsx` | `IdentityEditor.tsx` |
| React hook | `camelCase.ts` starting with `use` | `useAthleteData.ts` |
| Utility module | `camelCase.ts` | `formatStats.ts` |
| Page | `src/pages/PageName.tsx` | `src/pages/AthleteLab.tsx` |
| Zustand store | `src/store/<entity>Store.ts` | `src/store/athleteStore.ts` |
| Doc (under `docs/`) | `kebab-case.md` | `migration-risk-register.md` |
| ADR | `docs/adr/NNNN-<kebab-slug>.md` | `docs/adr/0006-phase-ordering-metrics-before-ui.md` |
| Risk register entry (post-Pass-4) | `docs/risk-register/R-NN-<kebab-slug>.md` | `docs/risk-register/R-04-backup-completeness.md` |
| Verification script | `scripts/verification/slice<phase>_<purpose>.ts` | `scripts/verification/slice1c2_b1_smoke_compare.ts` |

---

## ID conventions (never renumber)

| Prefix | Meaning | Source of truth |
|---|---|---|
| `R-NN` | Risk in the Phase 1c risk register | `docs/risk-register/R-NN-*.md` (one file per ID); aggregated in `docs/risk-register/INDEX.md` |
| `F-<AREA>-<N>` | Finding scoped to area / slice (e.g., `F-SLICE-E-2`, `F-OPS-1`, `F-SEC-1`) | `docs/risk-register/F-*-*.md`; aggregated in `docs/risk-register/INDEX.md` |
| `V-1c.3-NN` | Verification task for Phase 1c.3 | `docs/process/phase-1c3-prep-backlog.md` |
| `ADR-NNNN` | Architecture Decision Record | `docs/adr/` |
| `PHASE-NN[a/b/c]` | Phase identifier | `docs/reference/phases.md` (created Pass 6.2) |

When referring to one of these in prose, use the verbatim ID. Do not paraphrase ("the backup risk" → use `R-04`).

---

## Frontmatter on docs

Where applicable (ADRs, risk register entries, slice outcomes, schema docs), use YAML frontmatter:

```yaml
---
id: R-04
title: Backup completeness for Phase 1c migrations
status: closed                # open | mitigated | closed | monitoring
severity: medium              # low | medium | high | critical
origin_slice: 1c.2 / Slice A
origin_doc: investigations/phase-1c2-slice-a-r04-assertion.md
related_adrs: [0007]
opened: 2026-04-XX
---
```

Schemas for each doc family live next to them (`docs/risk-register/_schema.md`, `docs/reference/calibration/_schema.md`, etc.).

---

## File moves & stubs (R2 stub policy)

When relocating or splitting a doc, leave a redirect stub at the old path **only if** the doc is one of:

(a) Referenced from outside the repo (chat history, external bookmarks likely)
(b) Referenced from `README.md`, `PRODUCT-SPEC.md`, `VISION.md`, or this conventions file
(c) The historical entry point for a major workstream (risk register, architecture audit, etc.)

Otherwise, move cleanly and update in-repo references in the same pass.

**Stub format:**

```md
# <old filename> — Redirect Stub

> **Status:** Renamed/Moved. This file is a redirect stub.
>
> Current location: **[`<new path>`](<new path>)**
>
> Renamed/moved during <pass identifier> to <one-sentence reason>.

## Stub removal cadence

This stub is tracked in `docs/phase-<next>-prep-backlog.md` under "Stub cleanup queue."
It will be removed at the start of <next phase> unless `rg "<old path>"` shows live in-repo references at that time.
```

**Removal cadence:** stubs created during a phase's cleanup are removed at the start of the next phase, unless an `rg` sweep shows live in-repo references. Add an entry to the next phase's prep backlog stub-cleanup queue when creating each stub — this is mandatory, not optional.

### Catalog doc exemption (cross-reference threshold)

Catalog docs are exempt from the >30 cross-reference update threshold during reorg passes. A doc qualifies as a **catalog** if its primary purpose is enumerating other docs.

Current catalog docs:
- `docs/INDEX.md`
- `docs/repo-architecture-audit.md`

Per-doc diff stats surface at pass close for verification (count of references updated, in which docs). Non-catalog docs above the threshold remain a halt trigger. Adding a doc to the catalog list requires the same justification as introducing a new convention: it must be a pure index, not a narrative doc that happens to link a lot.

---

## Structured vs prose

Source-of-truth data lives in structured formats (CSV, YAML, JSON). Prose is for narrative, decisions, and human reasoning.

**Use structured (CSV/YAML/JSON) when:**
- The doc is a list of similar entries that grows over time (drift logs, ground-truth datasets, calibration audits)
- Entries have consistent fields across rows
- A future tool or generator might read the file
- Adding a new entry should take seconds, not require writing prose

**Use prose (Markdown) when:**
- The doc captures a decision, an investigation, or a narrative
- The structure varies entry-to-entry
- Human reasoning is the primary content

**Migration trigger:** when a prose doc has accumulated 3+ similarly-shaped entries and the next entry would be mechanical, migrate to structured.

The exemplar pattern: [`docs/data-dictionary/fields.json`](../data-dictionary/fields.json).

---

## Pass 5 sub-conventions

These sections are appended as Pass 5 sub-passes execute.

### Tier system (5a)
Per-tier-system files under `docs/reference/tiers/`. Frontmatter contract in `docs/reference/tiers/_schema.md`. Do not reuse the deprecated "Elite Tier" naming.

### Metric registry (5b)
One file per metric in `docs/reference/metrics/`. `metric_id` MUST match the database column / payload key verbatim. Frontmatter contract in `_schema.md` there.

### Event taxonomy (5c)
One file per event in `docs/reference/events/`. `event_id`s are append-only contracts; rename = breaking change. PII fields explicit.

### Observability (5d)
One file per subsystem in `docs/reference/observability/`. Don't list dashboards without verifying the URL resolves; mark unverified SLOs as `proposed`.

### Calibration audit rollup (5e + 5e-bis)
Two complementary artefacts:
- **`docs/reference/calibration-audit-rollup.md`** — human-readable entry point. Edit by hand when canonical artefacts change.
- **`docs/reference/calibration-audit-rollup.csv`** — generated. Schema in `docs/reference/_schema-calibration-audit-rollup.md`. Produced by `scripts/aggregate-calibration-audit.ts`.

**Run after each ground-truth clip addition.** When a new clip lands in `docs/reference/calibration/*.yaml`:

```bash
deno run --allow-env --allow-net --allow-read --allow-write \
  scripts/aggregate-calibration-audit.ts
```

The script is idempotent — re-running with no DB changes yields a byte-identical CSV. Required env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Halt conditions: any clip with zero matching uploads ⇒ exit 3, log `F-SLICE-1C2-CLEANUP-1`. Pre-Slice-C.5 result rows lack the `calibration_audit` payload (per ADR-0014) and are silently skipped — that's expected, not a failure.

---

## Pass 6 sub-conventions

### Tab inventory generator (6.1)
*To be added in Pass 6.1.*

### Phase ID lookup (6.2)
*To be added in Pass 6.2.*

### Verification recipe template (6.3)
*To be added in Pass 6.3.*
