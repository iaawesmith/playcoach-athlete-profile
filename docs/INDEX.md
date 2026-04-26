# Documentation Index

> **Status:** Current as of Phase 1c.2 cleanup Pass 3a.
>
> The structural reorg into subdirectories (`architecture/`, `process/`, `reference/`, `investigations/`, `adr/`, `agents/`, `templates/`) landed in Pass 3a. The `risk-register/` split lands in Pass 4. R2 redirect stubs remain at the four old root-level paths until Phase 1c.3 (see [`process/phase-1c3-prep-backlog.md`](process/phase-1c3-prep-backlog.md) → "Stub cleanup queue").
>
> For executive narrative, see [`../VISION.md`](../VISION.md). For build specs, see [`../PRODUCT-SPEC.md`](../PRODUCT-SPEC.md). For onboarding, see [`agents/onboarding.md`](agents/onboarding.md).

---

## Architecture

| Doc | Purpose |
|---|---|
| [`architecture/athlete-lab-architecture-audit.md`](architecture/athlete-lab-architecture-audit.md) | Phase 1c.0 architecture audit; current end-state laid out in companion doc below |
| [`architecture/athlete-lab-end-state-architecture.md`](architecture/athlete-lab-end-state-architecture.md) | "Where we're going" target architecture for the athlete-lab feature |
| [`architecture/athlete-lab-tab-inventory.md`](architecture/athlete-lab-tab-inventory.md) | Inventory of NodeEditor tabs, their dispositions, and audit findings |
| [`architecture/mediapipe-capability-inventory.md`](architecture/mediapipe-capability-inventory.md) | Capabilities of the MediaPipe Cloud Run service we depend on |
| [`architecture/repo-architecture-audit.md`](architecture/repo-architecture-audit.md) | Repo + IA audit (the doc that prompted this cleanup pass) |

## Process & slice records

| Doc | Purpose |
|---|---|
| [`process/phase-1c1-slice2-outcome.md`](process/phase-1c1-slice2-outcome.md) | Slice 2 ship record |
| [`process/phase-1c1-slice3-outcome.md`](process/phase-1c1-slice3-outcome.md) | Slice 3 ship record |
| [`process/phase-1c2-determinism-experiment.md`](process/phase-1c2-determinism-experiment.md) | Definitive determinism investigation writeup |
| [`process/phase-1c2-slice-b1-outcome.md`](process/phase-1c2-slice-b1-outcome.md) | Slice B.1 ship record |
| [`process/phase-1c2-slice-d-outcome.md`](process/phase-1c2-slice-d-outcome.md) | Slice D ship record |
| [`process/phase-1c2-slice-e-outcome.md`](process/phase-1c2-slice-e-outcome.md) | Slice E ship record |
| [`process/phase-1c3-prep-backlog.md`](process/phase-1c3-prep-backlog.md) | Open verification tasks for 1c.3 |

## Reference

| Doc | Purpose |
|---|---|
| [`reference/calibration-ground-truth-dataset.md`](reference/calibration-ground-truth-dataset.md) | Ground truth clip data (n=1, Slant route). Becomes structured YAML in Pass 3b. |
| [`reference/phase-1c2-determinism-drift-log.md`](reference/phase-1c2-determinism-drift-log.md) | Append-only drift log. Becomes CSV in Pass 3c. |
| [`reference/phase-1c2-baseline-slant-analysis.md`](reference/phase-1c2-baseline-slant-analysis.md) | Baseline Slant route numbers used as the determinism reference |
| [`reference/phase-1c2-diagnostic-snapshot-2026-04-26.md`](reference/phase-1c2-diagnostic-snapshot-2026-04-26.md) | Field-level diagnostic snapshot |
| [`reference/phase-1c2-detfreq-resolution-snapshot.md`](reference/phase-1c2-detfreq-resolution-snapshot.md) | Snapshot supporting R-06 resolution |
| [`reference/run-analysis-observability-audit.md`](reference/run-analysis-observability-audit.md) | Observability audit of the analysis pipeline (renamed from `-v2` in Pass 1) |
| [`reference/calibration-audit-rollup.md`](reference/calibration-audit-rollup.md) | Pass 5e: single entry point summarizing calibration accuracy + determinism state. |
| [`reference/_schema-calibration-audit-rollup.md`](reference/_schema-calibration-audit-rollup.md) + [`calibration-audit-rollup.csv`](reference/calibration-audit-rollup.csv) | Pass 5e-bis: generated CSV (9 seed rows, slant-route clip) + schema. Produced by `scripts/aggregate-calibration-audit.ts`. |
| [`reference/calibration/_schema.md`](reference/calibration/_schema.md) + [`ground-truth.yaml`](reference/calibration/ground-truth.yaml) | Pass 3b: structured ground-truth dataset. |
| [`reference/_schema-determinism-drift.md`](reference/_schema-determinism-drift.md) + [`determinism-drift.csv`](reference/determinism-drift.csv) | Pass 3c: 9-row determinism drift CSV (DB-verified Pass 5.5). |
| [`reference/tiers/_schema.md`](reference/tiers/_schema.md) | Pass 5a scaffold: tier definition contract. No tier files yet. |
| [`reference/metrics/_schema.md`](reference/metrics/_schema.md) | Pass 5b scaffold: metric definition contract. No metric files yet. |
| [`reference/events/_schema.md`](reference/events/_schema.md) | Pass 5c scaffold: event taxonomy contract. No event files yet. |
| [`reference/observability/_schema.md`](reference/observability/_schema.md) | Pass 5d scaffold: observability subsystem contract. Anchors run-analysis observability audit. |
| [`data-dictionary/fields.json`](data-dictionary/fields.json) | The canonical field-level data dictionary (110 fields, versioned) |

## Risks & findings

| Doc | Purpose |
|---|---|
| [`risk-register/INDEX.md`](risk-register/INDEX.md) | Aggregated view of all `R-*` risks (12) and `F-*` findings (10), with status / severity / origin slice / related ADRs / related entries. One file per ID under `risk-register/`. |
| [`risk-register/_schema.md`](risk-register/_schema.md) | Frontmatter contract for risk-register entries. |
| [`migration-risk-register.md`](migration-risk-register.md) | R2 redirect stub (split executed in Pass 4). |

## Investigations

| Doc | Purpose |
|---|---|
| [`investigations/calibration-ppy-investigation.md`](investigations/calibration-ppy-investigation.md) | (superseded — findings absorbed into F-SLICE-B-1) |
| [`investigations/calibration-source-trace.md`](investigations/calibration-source-trace.md) | Code trace of calibration paths |
| [`investigations/claude-prompt-content-trace.md`](investigations/claude-prompt-content-trace.md) | Trace of LLM prompt construction |
| [`investigations/first-real-test-diagnostic.md`](investigations/first-real-test-diagnostic.md) | (historical — pre-1c.2 diagnostic) |
| [`investigations/release-speed-velocity-investigation.md`](investigations/release-speed-velocity-investigation.md) | (reframed — original framing superseded by F-SLICE-B1-2) |
| [`reference/phase-1c2-baseline-slant-analysis.md`](reference/phase-1c2-baseline-slant-analysis.md) | Baseline Slant analysis |
| [`investigations/phase-1c2-camera-guidelines-preflight.md`](investigations/phase-1c2-camera-guidelines-preflight.md) | (historical — pre-flight check record) |
| [`process/phase-1c2-slice-a-r04-assertion.md`](process/phase-1c2-slice-a-r04-assertion.md) | (historical — small ship record) |

## Architecture Decision Records

| Doc | Purpose |
|---|---|
| [`adr/INDEX.md`](adr/INDEX.md) | ADR index + ADR-0007 vs ADR-0012 distinction note |
| [`adr/0001`](adr/0001-user-roles-separate-table.md) … [`adr/0012`](adr/0012-backup-retention-indefinite.md) | 12 backfilled ADRs (Pass 3d) |

## Templates

| Doc | Purpose |
|---|---|
| [`adr/template.md`](adr/template.md) | ADR template (created Pass 3d) |
| [`templates/slice-outcome.md`](templates/slice-outcome.md) | Slice outcome template (created Pass 3f) |

## Agents

| Doc | Purpose |
|---|---|
| [`agents/onboarding.md`](agents/onboarding.md) | Agent onboarding — read order for fresh agents |
| [`agents/conventions.md`](agents/conventions.md) | Repo conventions (file naming, IDs, R2 stub policy, structured-vs-prose, catalog-doc exemption) |
| [`agents/workflows.md`](agents/workflows.md) | Common multi-step workflows |

---

## Coming online during this cleanup

| Pass | Adds |
|---|---|
| 2 | `agents/onboarding.md`, `agents/conventions.md`, `agents/workflows.md` |
| 3 | Subdirectory reorg, calibration YAML, drift CSV, 12 ADRs, slice-outcome template, CHANGELOG + release-notes |
| 4 | `risk-register/` split (one file per `R-*` / `F-*`) |
| 5 | `reference/tiers/_schema.md`, `reference/metrics/_schema.md`, `reference/events/_schema.md`, `reference/observability/_schema.md`, `reference/calibration-audit-rollup.md` (CSV form deferred — md rollup is the v1 surface) |
| 6 | `reference/phases.md`, tab inventory generator, verification recipe template |
