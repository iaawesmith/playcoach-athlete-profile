# Phase 1c Migration Risk Register — Redirect Stub

> **Status:** Split. This file is a redirect stub.
>
> The risk register has been split into one file per entry under [`docs/risk-register/`](risk-register/). Aggregated view (with the §2 heatmap, §3 historical recommendation, §3.5 methodological note, and §4 closing summary) lives in [`docs/risk-register/INDEX.md`](risk-register/INDEX.md). Per-entry frontmatter contract is documented in [`docs/risk-register/_schema.md`](risk-register/_schema.md).
>
> The split happened during Phase 1c.2 cleanup (Pass 4) to make individual risks/findings discoverable as first-class addressable artifacts (typed queries, per-entry status updates, ADR cross-links). Per ADR-0013 (prose-to-structured policy), this register met all four criteria — precision-sensitive (severity classifications), multi-reader (15+ inbound docs), append-only-growth (10 findings added post-foundation batch), and typed-queries-useful (filter by status, severity, slice).

---

## Where to find what was here

| Looking for… | Now at |
|---|---|
| The 22-entry register (12 R-* + 10 F-*) | [`risk-register/INDEX.md`](risk-register/INDEX.md) — table view with status, severity, origin slice, related ADRs, related entries |
| A specific entry (e.g., `R-04`, `F-SLICE-B-1`) | [`risk-register/<ID>-<slug>.md`](risk-register/) — one file per ID |
| Frontmatter contract (status / severity / origin_slice / related_adrs / opened / last_updated) | [`risk-register/_schema.md`](risk-register/_schema.md) |
| §2 — Top-3 heatmap | [`risk-register/INDEX.md` §2](risk-register/INDEX.md#2--top-3-risks-heatmap) |
| §3.5 — Methodological note on comparison invariants | [`risk-register/INDEX.md` §3.5](risk-register/INDEX.md#35--methodological-note-comparison-invariants-across-migration-boundaries) |
| §4 — Closing summary (foundation batch) | [`risk-register/INDEX.md` §4](risk-register/INDEX.md#4--closing-summary-foundation-batch-2026-04-25) |
| Phase ordering note (revised 2026-04-26) | [`risk-register/INDEX.md` "Phase ordering note"](risk-register/INDEX.md#phase-ordering-note-revised-2026-04-26); decision recorded in [ADR-0006](adr/0006-phase-ordering-metrics-before-ui.md) |

---

## ID stability

R-* and F-* IDs are immutable across the split. `R-04` is still `R-04`; it now lives at `risk-register/R-04-backup-table-omits-a-text-bearing-field-making-rollback-impossible.md`. Inbound references to bare IDs (e.g., "see R-04" in slice outcome docs) continue to resolve via the INDEX table.

---

## Stub removal cadence

This stub is tracked in [`docs/process/phase-1c3-prep-backlog.md`](process/phase-1c3-prep-backlog.md) under "Stub cleanup queue." It will be removed at the start of Phase 1c.3 unless `rg "migration-risk-register"` shows live in-repo references at that time. Per the R2 stub policy in [`docs/agents/conventions.md`](agents/conventions.md), heavy-traffic doc moves get one phase boundary of redirect grace.
