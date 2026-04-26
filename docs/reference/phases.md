# Canonical Phase ID Registry

**Purpose:** Single canonical identifier for every phase referenced in code, scripts, risk-register entries, ADRs, and process docs. When a script's `VERIFIES:` header, a risk-register `origin_slice`, or an ADR mentions a phase, it must use one of the IDs below.

**Status source of truth:** [`docs/roadmap.md`](../roadmap.md). When status here disagrees with the roadmap, the roadmap wins — open a PR to sync this file.

**Canonical ID format:** `PHASE-{MAJOR}{MINOR}` uppercase, no dot.
Examples: `PHASE-1C0`, `PHASE-1C2`, `PHASE-2A`, `PHASE-3`.
Slice IDs are `PHASE-1C2-SLICE-E` (uppercase letter), `PHASE-1C2-SLICE-B1` (letter+digit). Findings and risks keep their own `F-*` / `R-*` IDs and reference the phase ID via `origin_slice`.

---

## Registry

| ID | Common label | Status | One-line scope | Canonical doc |
|---|---|---|---|---|
| `PHASE-1C0` | Phase 1c.0 | Complete | Architecture audit, end-state architecture, MediaPipe capability inventory, initial tab inventory. | [`architecture/athlete-lab-end-state-architecture.md`](../architecture/athlete-lab-end-state-architecture.md) |
| `PHASE-1C1` | Phase 1c.1 | Complete | Slice 2 (coaching cues migration) + Slice 3 (position field UI) ship records. | [`process/phase-1c1-slice2-outcome.md`](../process/phase-1c1-slice2-outcome.md), [`process/phase-1c1-slice3-outcome.md`](../process/phase-1c1-slice3-outcome.md) |
| `PHASE-1C2` | Phase 1c.2 | In progress (cleanup pass) | Slices A–E shipped (calibration audit, R-04 backup assertion, body-based path, det-frequency consolidation, mechanics tab strip); determinism stabilized to multimodal 7/1/1 distribution; current 6-pass repo + IA foundation cleanup in flight. | [`roadmap.md`](../roadmap.md) (Phase 1c.2 cleanup section) |
| `PHASE-1C3` | Phase 1c.3 | Not started | Consolidation pass: orphan column verification (`reference_object`, `llm_tone`), R2 stub removal, mechanics-tab + `MechanicsEditor` component deletion, post-1c.2 backlog absorption, final close of the 1c phase. | [`process/phase-1c3-prep-backlog.md`](../process/phase-1c3-prep-backlog.md) |
| `PHASE-2A` | Phase 2a | Not started (gated on 1c.3) | Calibration robustness — move ground-truth dataset from n=1 to n≥3, verify cross-clip determinism within ±1% per ADR-0005. | [`reference/calibration-audit-rollup.md`](../reference/calibration-audit-rollup.md), [`adr/0004-calibration-defer-b2-decision.md`](../adr/0004-calibration-defer-b2-decision.md) |
| `PHASE-2B` | Phase 2b | Not started (gated on F-SLICE-E-2 escalation) | Cloud Run telemetry instrumentation per `reference/observability/_schema.md` — cold starts, GPU usage, model version, per-run inference timing. | [`reference/observability/_schema.md`](../reference/observability/_schema.md), [`risk-register/F-SLICE-E-2-pipeline-calibration-audit-shows-0-78-non-deterministic-drift-on-identical.md`](../risk-register/F-SLICE-E-2-pipeline-calibration-audit-shows-0-78-non-deterministic-drift-on-identical.md) |
| `PHASE-2C` | Phase 2c | Not started (gated on 2a) | Metric quality audit + scoring rule verification — audit each entry in `reference/metrics/` for definition clarity, source-field correctness, valid-range plausibility, ground-truth verifiability. | [`reference/metrics/_schema.md`](../reference/metrics/_schema.md) |
| `PHASE-3` | Phase 3 | Not started (gated on Phase 2 close) | Athlete-facing UI surfaces built on top of trusted metrics. Per ADR-0006, athletes never see analysis surfaces built on untrustworthy data — this phase cannot start before 2c closes. | [`adr/0006-phase-ordering-metrics-before-ui.md`](../adr/0006-phase-ordering-metrics-before-ui.md) |

---

## Slice ID conventions (PHASE-1C2)

Phase 1c.2 is the only phase with named slices currently in scope. Slice IDs are formed as `PHASE-1C2-SLICE-{LETTER}` or `PHASE-1C2-SLICE-{LETTER}{DIGIT}` for multi-part slices. All slice outcome docs live under `docs/process/`.

| Slice ID | Outcome doc |
|---|---|
| `PHASE-1C2-SLICE-A` | [`process/phase-1c2-slice-a-r04-assertion.md`](../process/phase-1c2-slice-a-r04-assertion.md) |
| `PHASE-1C2-SLICE-B1` | [`process/phase-1c2-slice-b1-outcome.md`](../process/phase-1c2-slice-b1-outcome.md) |
| `PHASE-1C2-SLICE-D` | [`process/phase-1c2-slice-d-outcome.md`](../process/phase-1c2-slice-d-outcome.md) |
| `PHASE-1C2-SLICE-E` | [`process/phase-1c2-slice-e-outcome.md`](../process/phase-1c2-slice-e-outcome.md) |

---

## Usage rules

1. **Scripts** — `scripts/verification/*` `VERIFIES:` headers reference phase or slice IDs from this file. If a script verifies behavior introduced across multiple slices, list them all.
2. **Risk register** — the `origin_slice` frontmatter field uses an ID from this file (e.g. `PHASE-1C2-SLICE-E`). General-phase entries (not slice-specific) use the phase ID (`PHASE-1C2`).
3. **ADRs** — when an ADR's "Context" or "Consequences" section names a phase, use the canonical ID, parenthetical label allowed: `PHASE-1C2 (Phase 1c.2)`.
4. **Status updates** — never edit status in this file directly. Edit `docs/roadmap.md` first, then sync this file in the same PR.
5. **New slices/phases** — adding a new ID requires updating this registry, the roadmap, and (if it changes the gating chain) `adr/0006-phase-ordering-metrics-before-ui.md`.

---

## Anti-patterns (do not do)

- Inventing ad-hoc IDs in scripts (e.g. `PHASE_1C2_FINAL`, `PHASE-2`, `PHASE-1C-CLEANUP`). Use the table above or extend the table first.
- Using a slice letter without the phase prefix (`SLICE-E` is ambiguous across phases — write `PHASE-1C2-SLICE-E`).
- Citing "Phase 2" generically when the work belongs to a specific sub-phase. If the sub-phase is genuinely undecided, use `PHASE-2A` (the entry point) and note the ambiguity in prose.
