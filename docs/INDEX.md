# Documentation Index

> **Status:** Current as of Phase 1c.2 cleanup Pass 1.
>
> This index reflects the current `docs/` layout. The structural reorg into subdirectories (`architecture/`, `process/`, `reference/`, `investigations/`, `adr/`, `agents/`, `risk-register/`) lands in Pass 3. After Pass 3 completes, the paths in this index will be updated and a "renamed/moved" column will be added.
>
> For executive narrative, see [`../VISION.md`](../VISION.md). For build specs, see [`../PRODUCT-SPEC.md`](../PRODUCT-SPEC.md). For onboarding, see [`agents/onboarding.md`](agents/onboarding.md) (created in Pass 2).

---

## Architecture

| Doc | Purpose |
|---|---|
| [`athlete-lab-architecture-audit.md`](athlete-lab-architecture-audit.md) | Phase 1c.0 architecture audit; current end-state laid out in companion doc below |
| [`athlete-lab-end-state-architecture.md`](athlete-lab-end-state-architecture.md) | "Where we're going" target architecture for the athlete-lab feature |
| [`athlete-lab-tab-inventory.md`](athlete-lab-tab-inventory.md) | Inventory of NodeEditor tabs, their dispositions, and audit findings |
| [`mediapipe-capability-inventory.md`](mediapipe-capability-inventory.md) | Capabilities of the MediaPipe Cloud Run service we depend on |
| [`repo-architecture-audit.md`](repo-architecture-audit.md) | Repo + IA audit (the doc that prompted this cleanup pass) |

## Process & slice records

| Doc | Purpose |
|---|---|
| [`phase-1c1-slice2-outcome.md`](phase-1c1-slice2-outcome.md) | Slice 2 ship record |
| [`phase-1c1-slice3-outcome.md`](phase-1c1-slice3-outcome.md) | Slice 3 ship record |
| [`phase-1c2-determinism-experiment.md`](phase-1c2-determinism-experiment.md) | Definitive determinism investigation writeup |
| [`phase-1c2-slice-b1-outcome.md`](phase-1c2-slice-b1-outcome.md) | Slice B.1 ship record |
| [`phase-1c2-slice-d-outcome.md`](phase-1c2-slice-d-outcome.md) | Slice D ship record |
| [`phase-1c2-slice-e-outcome.md`](phase-1c2-slice-e-outcome.md) | Slice E ship record |
| [`phase-1c3-prep-backlog.md`](phase-1c3-prep-backlog.md) | Open verification tasks for 1c.3 |

## Reference

| Doc | Purpose |
|---|---|
| [`calibration-ground-truth-dataset.md`](calibration-ground-truth-dataset.md) | Ground truth clip data (n=1, Slant route). Becomes structured YAML in Pass 3b. |
| [`phase-1c2-determinism-drift-log.md`](phase-1c2-determinism-drift-log.md) | Append-only drift log. Becomes CSV in Pass 3c. |
| [`phase-1c2-baseline-slant-analysis.md`](phase-1c2-baseline-slant-analysis.md) | Baseline Slant route numbers used as the determinism reference |
| [`phase-1c2-diagnostic-snapshot-2026-04-26.md`](phase-1c2-diagnostic-snapshot-2026-04-26.md) | Field-level diagnostic snapshot |
| [`phase-1c2-detfreq-resolution-snapshot.md`](phase-1c2-detfreq-resolution-snapshot.md) | Snapshot supporting R-06 resolution |
| [`run-analysis-observability-audit.md`](run-analysis-observability-audit.md) | Observability audit of the analysis pipeline (renamed from `-v2` in Pass 1) |
| [`data-dictionary/fields.json`](data-dictionary/fields.json) | The canonical field-level data dictionary (110 fields, versioned) |

## Risks & findings

| Doc | Purpose |
|---|---|
| [`migration-risk-register.md`](migration-risk-register.md) | All `R-*` risks and `F-*` findings. Splits into `risk-register/` directory in Pass 4. |

## Investigations

| Doc | Purpose |
|---|---|
| [`calibration-ppy-investigation.md`](calibration-ppy-investigation.md) | (superseded — findings absorbed into F-SLICE-B-1) |
| [`calibration-source-trace.md`](calibration-source-trace.md) | Code trace of calibration paths |
| [`claude-prompt-content-trace.md`](claude-prompt-content-trace.md) | Trace of LLM prompt construction |
| [`first-real-test-diagnostic.md`](first-real-test-diagnostic.md) | (historical — pre-1c.2 diagnostic) |
| [`release-speed-velocity-investigation.md`](release-speed-velocity-investigation.md) | (reframed — original framing superseded by F-SLICE-B1-2) |
| [`phase-1c2-baseline-slant-analysis.md`](phase-1c2-baseline-slant-analysis.md) | Baseline Slant analysis |
| [`phase-1c2-camera-guidelines-preflight.md`](phase-1c2-camera-guidelines-preflight.md) | (historical — pre-flight check record) |
| [`phase-1c2-slice-a-r04-assertion.md`](phase-1c2-slice-a-r04-assertion.md) | (historical — small ship record) |

## Agents

| Doc | Purpose |
|---|---|
| [`agents/onboarding.md`](agents/onboarding.md) | Agent onboarding — read order for fresh agents |
| [`agents/conventions.md`](agents/conventions.md) | Repo conventions (file naming, IDs, R2 stub policy, structured-vs-prose) |
| [`agents/workflows.md`](agents/workflows.md) | Common multi-step workflows |

---

## Coming online during this cleanup

| Pass | Adds |
|---|---|
| 2 | `agents/onboarding.md`, `agents/conventions.md`, `agents/workflows.md` |
| 3 | Subdirectory reorg, calibration YAML, drift CSV, 12 ADRs, slice-outcome template, CHANGELOG + release-notes |
| 4 | `risk-register/` split (one file per `R-*` / `F-*`) |
| 5 | `reference/tiers.md`, `reference/metrics.md`, `reference/events.md`, `reference/observability.md`, `reference/calibration-audit-rollup.csv` |
| 6 | `reference/phases.md`, tab inventory generator, verification recipe template |
