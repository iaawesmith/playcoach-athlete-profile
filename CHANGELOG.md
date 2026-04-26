# Changelog

All notable changes to PlayCoach are recorded here. Format inspired by
[Keep a Changelog](https://keepachangelog.com/); versioning aligns with
phase identifiers (`PHASE-NN[a/b/c]`) rather than semver until public launch.

Entry shape:

```
## [<phase-id>] — YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Deprecated
- ...

### Removed
- ...

### Security
- ...
```

Cross-link risk-register IDs (`R-NN`, `F-*`) and ADR IDs (`ADR-NNNN`) inline
where applicable.

---

## [Phase 1c.2 — cleanup] — 2026-04-26

Foundation pass — documentation and scaffolding only. No pipeline changes,
no schema changes, no athlete-facing UI changes.

### Added
- `README.md`, `docs/INDEX.md`, `docs/glossary.md`, `docs/roadmap.md` — repo navigation foundation (Pass 1).
- `docs/agents/{onboarding,conventions,workflows}.md` — operational agent guidance (Pass 2).
- `docs/{architecture,process,reference,investigations,adr,templates}/` subdirectory layout (Pass 3a).
- `docs/reference/calibration/{ground-truth.yaml,_schema.md}` — structured calibration ground-truth dataset (Pass 3b).
- `docs/reference/determinism-drift.csv` + `_schema-determinism-drift.md` — structured drift log (Pass 3c).
- `docs/adr/0001`–`0012` — 12 backfilled ADRs covering user-roles table, Lovable Cloud default, Lovable AI Gateway default, calibration deferral (ADR-0004), determinism tolerance (ADR-0005), phase ordering (ADR-0006), backup snapshot pattern (ADR-0007), validation triggers, MediaPipe-on-Cloud-Run, Zustand, icon/font policy, backup retention (ADR-0012). See `docs/adr/INDEX.md`.
- `docs/adr/0013-prose-to-structured-policy.md` — codifies the two-of-four rule for converting prose datasets to CSV/YAML (Pass 3d follow-up).
- `docs/adr/0014-c5-unified-edge-function-body-based-path.md` — records the Slice C.5 collapse of the two parallel `body_based` calibration paths into a single edge-function path with structured `calibration_audit` payload (Pass 3d follow-up; resolves F-SLICE-B-1 path-disagreement).
- `docs/adr/0015-mechanics-tab-delete-not-patch.md` — records the Slice E recovery decision to hide the Mechanics tab rather than patch `MechanicsEditor` since the component is slated for 1c.3 deletion (Pass 3d follow-up; generalizes to a delete-not-patch rule).
- `docs/adr/template.md`, `docs/templates/slice-outcome.md` (Pass 3f).
- `scripts/verification/` — relocated all `slice*_verify.ts` and related verification scripts from `scripts/` root (Pass 3e).

### Changed
- Renamed `AGENTS.md` → `PRODUCT-SPEC.md` to eliminate naming collision with `docs/agents/` (Pass 1). R2 stub remains at `AGENTS.md`.
- Renamed `docs/run-analysis-observability-audit-v2.md` → `docs/reference/run-analysis-observability-audit.md` (Pass 1 + Pass 3a). R2 stub remains at root.
- Moved `docs/repo-architecture-audit.md`, `docs/athlete-lab-architecture-audit.md`, `docs/calibration-ground-truth-dataset.md`, `docs/phase-1c2-determinism-drift-log.md` into their canonical subdirectories (Pass 3a). R2 stubs remain at the four old root paths and are tracked in `docs/process/phase-1c3-prep-backlog.md` "Stub cleanup queue."
- Status banners added to 10 historical investigation/snapshot docs (Pass 1).
- `docs/agents/conventions.md` — added "Catalog doc exemption" subsection codifying that `INDEX.md` and `repo-architecture-audit.md` are exempt from the >30 cross-reference threshold (Pass 3a).

### Fixed
- All in-repo `.md` cross-references to moved docs (88 occurrences across 14 files; verified by markdown link resolver, 0 broken intra-pass links).
- Stale ADR cross-references corrected after the Pass 3d follow-up audit: `docs/roadmap.md` and `docs/agents/onboarding.md` previously cited "ADR-0010" for the "no new athlete UI in Phase 1c" rule (ADR-0010 is actually `zustand-for-shared-state`); both now correctly cite ADR-0006 (phase ordering) as the basis. `docs/investigations/calibration-ppy-investigation.md` previously cited "ADR-0011" for the C.5 unification decision; now correctly cites ADR-0014.

### Deferred (not changed in this pass)
- B2 calibration architecture decision — see ADR-0004.
- Risk-register split into `docs/risk-register/` (one file per `R-*` / `F-*`) — scheduled for Pass 4.
- Reference scaffolds (`reference/tiers.md`, `metrics.md`, `events.md`, `observability.md`, `calibration-audit-rollup.csv`) — scheduled for Pass 5.
- Tab inventory generator, phase ID lookup, verification recipe template — scheduled for Pass 6.
