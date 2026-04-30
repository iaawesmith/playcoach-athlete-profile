# Testing Philosophy

> **Created:** 2026-04-30 (PHASE-1C3-PREP). Closes a recurring fresh-Claude question: "where are the tests?" The answer is structural, not absent.

---

## Frame

**Per-slice manual verification is the test surface.** It is not the absence of tests; it is a different shape of test discipline calibrated to the project's current pace, blast radius, and agent-driven workflow.

The discipline has six load-bearing components. Each one catches a class of failure that, in a more conventional shop, would be caught by automated tests, CI, or hosted observability. Together they form the regression net for this codebase.

---

## §1 — Verification scripts in `scripts/verification/`

Every meaningful slice ships with (or extends) a verification script that proves the slice's correctness or falsifies a specific finding. Scripts carry a structured header per the Pass 6.3 convention (template at [`../../scripts/verification/_template.ts`](../../scripts/verification/_template.ts)):

```
NAME / PHASE / VERIFIES / RECIPE / BACKLINKS / MAINTENANCE
```

The header is the contract. **`VERIFIES`** names what the script proves. **`RECIPE`** describes how to run it and what divergence means. **`BACKLINKS`** point to the risk-register entries, ADRs, and slice outcome docs that depend on the script.

The lesson behind this contract is **F-SLICE-E-3** ([file](../risk-register/F-SLICE-E-3-recipe-propagation-without-independent-verification-process-lesson-no-severity.md)): recipes that live in code with backlinks stay current; recipes that live in prose drift. Treat verification scripts as documentation that runs.

Active scripts are listed in `scripts/verification/`. New scripts joining the directory MUST carry the full header — without it the script is invisible to future maintainers.

---

## §2 — Calibration audit rollup CSV (regression dataset)

The calibration audit rollup at [`../reference/calibration-audit-rollup.csv`](../reference/calibration-audit-rollup.csv) is the regression dataset for calibration drift. It captures, for every registered ground-truth clip, the calibration decision the pipeline made on each verification run.

Aggregated by `scripts/aggregate-calibration-audit.ts` from `docs/reference/calibration/*.yaml` (clip registry) joined against `athlete_lab_results.result_data.calibration_audit` (pipeline output).

Workflow when adding a clip or running a verification: see ["Re-running the calibration audit aggregation"](workflows.md#re-running-the-calibration-audit-aggregation). Unexpected row-count changes are information about pipeline state, not script failure — investigate, then log a finding if warranted.

---

## §3 — Determinism drift CSV

The drift log at [`../reference/determinism-drift.csv`](../reference/determinism-drift.csv) is the regression record for pipeline determinism. Each row appends a multi-run experiment's outcome against the ±1% multimodal tolerance set in [ADR-0005](../adr/0005-determinism-tolerance-1pct.md).

Open finding [F-SLICE-E-2](../risk-register/F-SLICE-E-2-pipeline-calibration-audit-shows-0-78-non-deterministic-drift-on-identical.md) (~0.78% non-deterministic drift on identical inputs) lives entirely in this dataset. The drift log is the trigger for the F-SLICE-E-2 escalation gate that unblocks Phase 2b (Cloud Run telemetry instrumentation).

---

## §4 — Pre-execution sweep + halt-and-decide discipline (F-OPS-4 family)

The most effective regression net in this repo is **the discipline of halting when execution surfaces something inspection missed.** Phase 1c.3 surfaced seven sub-patterns of this failure mode, all documented in [F-OPS-4](../risk-register/F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md):

1. Constraint discovery — enumerate all CHECK/FK/UNIQUE constraints on write targets, not just suspected ones
2. Shape discovery — sample array-element shapes before composing assertions
3. Location discovery — `rg` for the symbol, not just the asserted file path
4. Multi-source merges — accumulator pattern for stale-read prevention
5. Inline cascades — track downstream consumers of "deleted" symbols
6. Transactional correctness — assert post-conditions inside the same transaction
7. Taxonomy drift — durable identifier schemes from the start

Halts during execution **are the system working correctly**, not inefficiency. The remediation is "expect halts; build halt-and-decide tolerance into slice plans," not "inspect harder before every slice." Treating halts as expected raises the floor on what gets caught.

This is the discipline that absent automated tests catch. It works because the slice cadence is low (1–3 per week) and rigor per slice is high.

---

## §5 — Backup-before-destructive-migration pattern

Every destructive migration in Phase 1c snapshots the affected rows into `athlete_lab_nodes_phase1c_backup` first, with a `disposition` column carrying the End-State earmark label. Pattern formalized in [ADR-0007](../adr/0007-backup-snapshot-pattern.md); indefinite retention per [ADR-0012](../adr/0012-backup-retention-indefinite.md).

This is the rollback safety net. R-04 (backup completeness) is mitigated by the assertion script `scripts/verification/slice1c2_r04_backup_assert.ts`. The slice 1c.3-E audit pass + slice-tag normalization keeps the backup table itself trustworthy as a rollback source.

---

## §6 — TypeScript strict-as-deployed

`tsc --noEmit -p tsconfig.app.json` is the cheapest regression check available, run before claiming any code-touching slice "shipped." Strict mode is intentionally not yet enabled (see Phase 1c.3 retrospective); incremental strict-mode enablement is identified as a Phase 2 priority.

---

## When this works

Current conditions:

- **Slice cadence is low** (1–3 per week)
- **Per-slice rigor is high** (manual verification, halt-and-decide, slice outcome docs, ADRs for non-trivial decisions)
- **One agent at a time** is making changes
- **No real athlete data flowing through** — every analysis run is on test fixtures or admin dogfood

Under these conditions, manual per-slice verification catches what CI would catch, plus things CI tends to miss (taxonomy drift, plan-vs-state drift, context-loss across sessions). The discipline scales linearly with slice count, which is currently low enough to make that affordable.

## When this would need to change

The discipline becomes insufficient when any of the following becomes true:

- **Ship cadence accelerates** beyond ~5 slices per week — manual verification becomes the bottleneck
- **Multiple agents execute in parallel** on the same surfaces — halt-and-decide assumes single-writer
- **Real athlete data flows through** the pipeline at volume — silent regressions affect users, not just dogfood
- **Phase 3 (athlete-facing UI) ships** — public surface changes the consequence model

Re-evaluate at Phase 2 close at the latest. The triggers above are observable, not speculative.

---

## Deferred decisions and revisitable triggers

### CI/CD pipeline — deferred

Rejected during the Phase 1c.2 repo audit (§5 R1, see [`../architecture/repo-architecture-audit.md`](../architecture/repo-architecture-audit.md)) for good reasons: manual per-slice rigor catches what CI catches at this pace, and CI adds infrastructure cost without proportional benefit. **Revisit when** ship cadence accelerates or multiple agents run in parallel.

### Hosted observability / Sentry — deferred

Similar reasoning (§5 R2 of the same audit): manual instrumentation per slice is sufficient at current volume; structured logging in the edge function (`logInfo` / `logWarn` / `logData`) provides the observability needed for current debugging. **Revisit when** the F-SLICE-E-2 escalation gate fires (Cloud Run telemetry per `docs/reference/observability/_schema.md` — already designed, deferred to Phase 2b).

Both decisions are revisitable. Neither is a permanent rejection. The triggers that would flip them are explicit and observable.

---

## Cross-references

- [`../scripts/verification/_template.ts`](../../scripts/verification/_template.ts) — verification recipe template
- [`workflows.md`](workflows.md) — operational steps that touch verification
- [`../risk-register/F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md`](../risk-register/F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md) — the seven sub-patterns
- [`../risk-register/F-SLICE-E-3-recipe-propagation-without-independent-verification-process-lesson-no-severity.md`](../risk-register/F-SLICE-E-3-recipe-propagation-without-independent-verification-process-lesson-no-severity.md) — recipe-propagation lesson
- [ADR-0005](../adr/0005-determinism-tolerance-1pct.md) — determinism tolerance
- [ADR-0007](../adr/0007-backup-snapshot-pattern.md) — backup-before-destructive
- [`../architecture/repo-architecture-audit.md`](../architecture/repo-architecture-audit.md) §5 — CI/CD and observability deferral reasoning
