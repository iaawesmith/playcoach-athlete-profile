# Architecture Decision Records (ADRs)

This directory holds the canonical record of architectural decisions for PlayCoach. ADRs are append-only — to change a decision, write a new ADR that supersedes the previous one (set the previous ADR's `status: superseded` and `superseded_by` frontmatter).

## Conventions

- File name: `NNNN-<kebab-slug>.md` where `NNNN` is a zero-padded sequence number.
- Frontmatter: `id`, `title`, `status`, `date`, `deciders`, `related_risks`, `related_findings`, `supersedes`, `superseded_by`.
- Status values: `proposed`, `accepted`, `rejected`, `superseded`, `deprecated`.
- Body: `## Context`, `## Decision`, `## Consequences`, `## Cross-links`.
- IDs are immutable. Never renumber.

## Index

| ID | Title | Status | Related |
|---|---|---|---|
| [ADR-0001](0001-user-roles-separate-table.md) | User roles in a separate `user_roles` table (never on `profiles`) | accepted | F-SEC-1 |
| [ADR-0002](0002-lovable-cloud-default-backend.md) | Lovable Cloud as the default backend (no external Supabase project) | accepted | — |
| [ADR-0003](0003-lovable-ai-gateway-default-llm.md) | Lovable AI Gateway as the default LLM provider | accepted | — |
| [ADR-0004](0004-calibration-defer-b2-decision.md) | B2 calibration architecture decision deferred until ground-truth dataset has ≥3 entries / ≥2 contexts | accepted | F-SLICE-B-1, F-SLICE-B1-2, F-SLICE-E-2 |
| [ADR-0005](0005-determinism-tolerance-1pct.md) | ±1% determinism tolerance with bimodal-mode awareness | accepted | F-SLICE-E-2 |
| [ADR-0006](0006-phase-ordering-metrics-before-ui.md) | Phase ordering — metric quality (Phase 2) before athlete UI (Phase 3) | accepted | F-SLICE-B-1, F-SLICE-B1-2, F-SLICE-E-2 |
| [ADR-0007](0007-backup-snapshot-pattern.md) | Backup-before-destructive-migration pattern (snapshot to `*_phase1c_backup` table) | accepted | R-04 |
| [ADR-0008](0008-validation-triggers-over-check.md) | Validation triggers instead of CHECK constraints for time-based validations | accepted | — |
| [ADR-0009](0009-mediapipe-on-cloud-run.md) | MediaPipe pose pipeline runs on Cloud Run (not in-browser, not in edge function) | accepted | F-SLICE-E-2 |
| [ADR-0010](0010-zustand-for-shared-state.md) | Zustand for shared client state (no Redux, no React Context for shared mutable state) | accepted | — |
| [ADR-0011](0011-material-symbols-and-lexend-only.md) | Material Symbols Outlined as the only icon system; Lexend as the only font | accepted | — |
| [ADR-0012](0012-backup-retention-indefinite.md) | Indefinite retention for Phase 1c backup tables (Default B) | accepted | R-04, R-10 |

## ADR-0007 vs ADR-0012 distinction

These two ADRs are intentionally separate:

- **ADR-0007** answers *how to take a snapshot* before a destructive migration (the pattern: backup table shape, RLS, assertion step). This is an architectural pattern decision.
- **ADR-0012** answers *how long to keep snapshots once taken* (Default B: indefinite, scoped to Phase 1c). This is a retention-policy decision.

The pattern can outlive the retention policy. If Phase 2 ever adopts a TTL retention, the new ADR supersedes only ADR-0012, not ADR-0007.
