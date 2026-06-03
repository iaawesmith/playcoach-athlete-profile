# Roadmap

Source of truth for phase ordering. When phase labels in any doc disagree with this file, this file wins.

> **Phase ordering principle:** Metrics before UI. Athletes never see analysis surfaces built on untrustworthy data. See [ADR-0006 — Phase ordering: metrics before UI](adr/0006-phase-ordering-metrics-before-ui.md) (backfilled in Pass 3d).

---

## Phase status snapshot

| Phase | Status | Scope summary |
|---|---|---|
| 1c.0 | Complete | Architecture audit, end-state architecture, mediapipe capability inventory, tab inventory |
| 1c.1 | Complete | Slice 2 + Slice 3 ship records |
| 1c.2 | Complete | Slices A–E shipped; determinism stabilized; 6-pass repo + IA cleanup landed |
| 1c.3 | **Complete (2026-04-30)** | Six slices A–F shipped: R2 stub sweep, Mechanics deletion + KB merges, write-path defect-class cleanup, 13 → 8 tab consolidation, R-07 backup audit + slice-tag normalization, retrospective + close. See [`process/phase-1c3-retrospective.md`](process/phase-1c3-retrospective.md). |
| 2a | In progress | Calibration robustness **and world-landmark activation** — two parallel tracks: A grows ground-truth to n≥3 with cross-clip determinism ±1% per ADR-0005; B captures and plumbs BlazePose GHUM 3D world landmarks as an alternative coordinate space |
| 2b | Not started | Cloud Run telemetry instrumentation (F-SLICE-E-2 escalation gate) |
| 2c | Not started | Metric quality audit + scoring rule verification |
| 3 | Not started | Athlete-facing UI surfaces on top of trusted metrics |

---

## Phase 1c.2 cleanup — current

The current cleanup pass is the 6-pass repo + IA foundation build (this file lives in Pass 1).

| Pass | Scope |
|---|---|
| 1 | Consolidation: README, INDEX, glossary, roadmap, AGENTS→PRODUCT-SPEC rename, status banners, observability rename |
| 2 | Agent infrastructure: `docs/agents/` onboarding, conventions, workflows |
| 3 | Structural conversions: subdirectory reorg, calibration YAML, drift CSV, 12 ADRs, verification scripts move, slice-outcome template, CHANGELOG + release-notes |
| 4 | Risk register split into `risk-register/` (one file per entry, IDs preserved) |
| 5 | Foundation scaffolding: tiers, metrics, events, observability schemas + calibration audit rollup (with executed seed) |
| 6 | Mechanical automation: tab inventory generator, phase ID registry, verification recipe template |

After this cleanup, Phase 1c.2 closes and 1c.3 prep begins.

---

## Phase 1c.3 — Complete (2026-04-30)

Six slices shipped 2026-04-29 → 2026-04-30. Synthesis lives in [`process/phase-1c3-retrospective.md`](process/phase-1c3-retrospective.md).

| Slice | Outcome | Doc |
|---|---|---|
| 1c.3-A | R2 stub sweep (7 removed) + V-1c.3-01 orphan verification (`reference_object`, `llm_tone` confirmed orphan) | [`process/phase-1c3-slice-a-outcome.md`](process/phase-1c3-slice-a-outcome.md) |
| 1c.3-B | Mechanics tab + inline `MechanicsEditor` deletion + `kb.mechanics` merge into `kb.phases` (R-12 closed; F-OPS-3, F-OPS-4 origin) | [`process/phase-1c3-slice-b-outcome.md`](process/phase-1c3-slice-b-outcome.md) |
| 1c.3-C | Training Status / Solution Class write-path resolution (F-SLICE-E-5 resolved; F-SLICE-E-6 opened + closed) | [`process/phase-1c3-slice-c-outcome.md`](process/phase-1c3-slice-c-outcome.md) |
| 1c.3-D | Tab consolidation 13 → 8 + R-05 mitigation + 5-key `knowledge_base` merge | [`process/phase-1c3-slice-d-outcome.md`](process/phase-1c3-slice-d-outcome.md) |
| 1c.3-E | R-07 backup disposition audit + slice-tag taxonomy normalization (F-OPS-4 sub-pattern 7) | [`process/phase-1c3-slice-e-outcome.md`](process/phase-1c3-slice-e-outcome.md) |
| 1c.3-F | Phase 1c.3 retrospective + V-1c.3-08 disposition + formal close | [`process/phase-1c3-retrospective.md`](process/phase-1c3-retrospective.md) |

Phase 2a unblocked.

### Post-1c.3 prep

| Slice | Outcome | Doc |
|---|---|---|
| PHASE-1C3-PREP | Documentation gap closure for Phase 2 readiness (system-overview, pipeline-trace, testing-philosophy, roadmap-sync detector, F-OPS-4 lede, tier resolution) | [`process/phase-1c3-prep-slice-outcome.md`](process/phase-1c3-prep-slice-outcome.md) |
| PHASE-1C3-POLISH | Post-prep audit cleanup: INDEX refresh + Audits section, scripts/verification/README, glossary entries (Slant, FIXED_TEST_ATHLETE_ID), legacy banners on 7 pre-template docs, methodological-triad cross-annotation across F-OPS-3/F-OPS-4/F-SLICE-E-3 | [`process/phase-1c3-polish-slice-outcome.md`](process/phase-1c3-polish-slice-outcome.md) |
| PHASE-2-PREP-FOLLOWUPS | Smoke-test follow-up bundle: TestingPanel `athlete_height` UX hardening (localStorage + inline warning), F-OPS-5 opened (Sev-3, draft-node misleading error), F-CALIB-1 opened (Sev-3, deferred to Phase 2a calibration shadow values) | [`process/phase-2-prep-followups-slice-outcome.md`](process/phase-2-prep-followups-slice-outcome.md) |

---

## Phase 2 — metric quality

Three sub-phases. Sub-phase order is the recommended sequence; specific scope decided at 2a kickoff.

### 2a — Calibration robustness — **in progress**

**Goal:** Move calibration ground-truth dataset from n=1 to n≥3, with cross-clip determinism verified to within ±1% per ADR-0005.

**Pre-conditions:** Phase 1c.3 closed. Calibration ground-truth structured as YAML (Pass 3b) so adding clips is mechanical, not prose-authoring.

**Structure:** two parallel tracks (A — ground-truth data growth; B — world landmarks activation) plus a closure slice. Slice IDs registered in [`reference/phases.md`](reference/phases.md).

| Slice | Status | Outcome doc |
|---|---|---|
| `PHASE-2A-SLICE-A1` | Shipped 2026-06-03 — calibration clip intake runbook (slant-route probe node, 3 scale-reference methodologies, halt conditions) | [`process/phase-2a-slice-a1-outcome.md`](process/phase-2a-slice-a1-outcome.md) |
| `PHASE-2A-SLICE-A2` | **Code-complete 2026-06-03; verification pending** — `calibration_estimate_ppy.ts` CLI exists but the only numerical check ran against the n=1 dataset, which is the inadequacy Track A exists to fix. Re-verification: methodology cross-check on the first clip that admits ≥2 methodologies (waits on intake or on a re-inspection of the n=1 clip for a second usable reference). | [`process/phase-2a-slice-a2-outcome.md`](process/phase-2a-slice-a2-outcome.md) |
| `PHASE-2A-SLICE-A3` | Blocked on Step 3 of Phase 2a remediation (drift-band corroboration of B1/B2) | (pending) |
| `PHASE-2A-SLICE-B1` | **Code-complete 2026-06-03; verification pending** — `pose_world_landmarks` captured in `PoseFrame` (meters, hip-centered); structural check holds, drift-band Option D corroboration deferred into B2 (F-OPS-6 instance) and not run. Verification script at [`scripts/verification/slice2a_b1_drift_band.ts`](../scripts/verification/slice2a_b1_drift_band.ts). | [`process/phase-2a-slice-b1-outcome.md`](process/phase-2a-slice-b1-outcome.md) |
| `PHASE-2A-SLICE-B2` | **Code-complete 2026-06-03; verification pending** — `world_keypoints` plumbed through `AnalyzeResponse`, always-on (decision moved to B1; honest reason: 70 KB is negligible, gating adds branching for no real saving). Same drift-band corroboration as B1 covers B2. | [`process/phase-2a-slice-b2-outcome.md`](process/phase-2a-slice-b2-outcome.md) |
| `PHASE-2A-SLICE-B3` | Blocked on Step 3 of Phase 2a remediation (drift-band corroboration of B1/B2) | (pending) |
| `PHASE-2A-SLICE-C` | Blocked — closure | (pending) |

> **Why "code-complete, verification pending" instead of "shipped":** per [`agents/testing-philosophy.md`](agents/testing-philosophy.md) §4, verification is constitutive of shipping. B1 and B2 both deferred their verification — B1 across a slice boundary into B2, B2 inherited and skipped it. A2's only numerical check ran against the n=1 dataset, which is the very inadequacy Track A exists to remediate. Three slices, three forms of the same failure mode, registered as [F-OPS-6](risk-register/F-OPS-6-verification-deferral-across-slice-boundaries.md). The status here matches reality; the `check-roadmap-sync` script validates presence, not truth, so it will not catch this for us.

### 2b — Cloud Run telemetry

**Goal:** Instrument the MediaPipe Cloud Run service per the schema in `reference/observability.md` (created in Pass 5.4) so cold starts, GPU usage, model version, and inference timing are observable per run.

**Pre-conditions:** F-SLICE-E-2 escalation trigger (see risk register). Until the trigger fires, this work is deferred.

**Decision:** when F-SLICE-E-2 fires, the schema in `reference/observability.md` is the implementation contract — no further design pass needed.

### 2c — Metric quality audit

**Goal:** Audit each metric in `reference/metrics.md` (registry created in Pass 5.2) for definition clarity, source-field correctness, valid-range plausibility, and ground-truth verifiability. Promote candidates to active; deprecate metrics that fail audit.

**Pre-conditions:** 2a complete (calibration trustworthy → metrics derived from it can be trusted). Metric registry populated.

---

## Phase 3 — athlete UI

**Goal:** Athlete-facing surfaces on top of audited metrics. Brand HQ → Development Lab chapter wiring, athlete-visible scoring, badge unlock surfaces, progress timelines.

**Pre-condition:** Phase 2 complete. No athlete-facing surface ships before the metrics behind it have passed 2c audit.

**Decision lineage:** [ADR-0006](adr/0006-phase-ordering-metrics-before-ui.md) (phase ordering: metrics before UI — also the basis for "no new athlete UI in Phase 1c").

Detailed scoping happens at Phase 3 kickoff. The capability-inventory → end-state-architecture → risk-register trio approach used for Phase 1c may or may not be repeated; decided at kickoff.
