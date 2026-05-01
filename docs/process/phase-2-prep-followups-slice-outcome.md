---
slice_id: PHASE-2-PREP-FOLLOWUPS
title: Smoke-test follow-up bundle — TestingPanel height hardening + F-OPS-5 + F-CALIB-1
date_shipped: 2026-05-01
status: shipped
related_risks: []
related_findings: [F-OPS-5, F-CALIB-1, F-OPS-1, F-SLICE-B-1, F-OPS-4]
related_adrs: [ADR-0014, ADR-0004]
---

# PHASE-2-PREP-FOLLOWUPS — Smoke-test follow-up bundle

## Goal

Close the three follow-up items surfaced by `docs/audits/phase-2-smoke-test-2026-05-01.md`:

1. Investigate Anomaly #2 (`athlete_height` missing from `analysis_context`) and remediate the root cause.
2. Open F-OPS-5 (admin-test uploads fail silently against draft nodes).
3. Open F-CALIB-1 (top-level `result_data` shadow values disagree with `calibration_audit`), deferred pending Phase 2a.

## What shipped

### Group 1 — TestingPanel athlete_height hardening (UX, not regression fix)

- `src/features/athlete-lab/components/TestingPanel.tsx`:
  - Added `useEffect` import.
  - Persist `athleteHeight` + `athleteHeightUnit` to `localStorage` under `athleteLab.testingPanel.athleteHeight.v1` / `athleteLab.testingPanel.athleteHeightUnit.v1` (versioned key convention from 1c.3-D `ConsolidationRedirectBanner`). Initial state hydrates from storage; setters write through.
  - Inline warning callout under the height field, rendered when `athleteHeight.trim()` is empty: "No athlete height provided. Body-based calibration will fall through to static. Aggregate scores will not match prior body-based runs." Surface style `surface-container-highest/80` with `material-symbols-outlined` warning icon. Warning, not blocker — submission still allowed.

### Group 2 — F-OPS-5 finding opened

- `docs/risk-register/F-OPS-5-admin-test-uploads-fail-silently-when-target-node-in-draft.md` created. Sev-3, status `open`. Three remediation candidates documented; (b) edge-function diagnostic split is recommended, deferred to Phase 2 substantive work.
- `docs/risk-register/F-OPS-1-...md` updated with `related_entries: [F-OPS-5]` (bidirectional cross-link).

### Group 3 — F-CALIB-1 finding opened (deferred)

- `docs/risk-register/F-CALIB-1-top-level-result-data-shadow-values-disagree-with-calibration-audit.md` created. Sev-3, status `deferred` pending Phase 2a calibration architecture decision. New `F-CALIB-` area prefix introduced; matches `F-<AREA>-<N>` convention in `_schema.md`. Three remediation candidates documented; (a) strip-shadow-on-write recommended.
- `docs/risk-register/F-SLICE-B-1-...md` updated with `related_entries: [F-CALIB-1]` (bidirectional cross-link).

### Group 4 — Closure

- `docs/risk-register/INDEX.md`: count narrative updated (25 → 27 entries, 13 → 15 findings; status distribution refreshed). Two new rows added to §1.5 Findings table.
- `docs/roadmap.md`: PHASE-2-PREP-FOLLOWUPS row added under Post-1c.3 prep.
- `CHANGELOG.md`: `[PHASE-2-PREP-FOLLOWUPS]` entry appended.
- This outcome doc.

## Verification

| Check | Method | Outcome |
|---|---|---|
| `athlete_height` capture path intact in TestingPanel | Read `TestingPanel.tsx:275-305` (buildContext) and `:645-667` (height input) | ✅ Field reads from state, `Number.isFinite` guard wraps payload, no regression in capture |
| `athlete_height` setter unchanged since introduction | `git log -S 'setAthleteHeight' -- TestingPanel.tsx` | ✅ Single commit (`3556def`); no 1c.3-era changes |
| F-OPS-5 cross-link bidirectional | `rg 'F-OPS-5' docs/risk-register/F-OPS-1-*.md` and reverse | ✅ Both directions linked |
| F-CALIB-1 cross-link bidirectional | `rg 'F-CALIB-1' docs/risk-register/F-SLICE-B-1-*.md` and reverse | ✅ Both directions linked |
| INDEX count narrative matches table rows | Manual count: §1 = 12 risks, §1.5 = 15 findings, total 27 | ✅ Matches |
| Roadmap-sync detector | `bun run scripts/verification/check-roadmap-sync.ts` | (auto-run by harness) |
| TypeScript build | `npx tsc --noEmit -p tsconfig.app.json` | (auto-run by harness) |

## Findings surfaced

- [F-OPS-5](../risk-register/F-OPS-5-admin-test-uploads-fail-silently-when-target-node-in-draft.md) — Sev-3, open, post-1c origin.
- [F-CALIB-1](../risk-register/F-CALIB-1-top-level-result-data-shadow-values-disagree-with-calibration-audit.md) — Sev-3, deferred to Phase 2a, post-1c origin.

## Decisions deferred

- **F-OPS-5 remediation choice**: candidate (b) edge-function diagnostic split recommended; deferred to Phase 2 substantive work. No new ADR.
- **F-CALIB-1 shadow-strip**: candidate (a) strip-shadow-on-write recommended; deferred to Phase 2a calibration architecture decision (rides with [ADR-0004](../adr/0004-calibration-defer-b2-decision.md) resolution rather than a separate slice).

## Process note (primary lesson — F-OPS-4 family)

**Group 1's slice-prompt premise was wrong, and the pre-execution sweep caught it.** The prompt asserted that 1c.3 admin UI work had broken `athlete_height` capture in the upload flow, with aggregate score collapse (61 → 12) as the symptom. Pre-execution sweep showed:

- `TestingPanel.tsx:221` initial state has always been `useState("")`. Git history (`-S 'setAthleteHeight'`) shows a single introduction commit, no subsequent edits.
- The capture path (state → `Number.isFinite` guard → `analysis_context` payload) is structurally intact and correctly handled the missing input. Pipeline behavior was correct end-to-end.
- The 2026-04-26 baseline upload that scored 61 had `athlete_height: 74` because the operator typed it. The 2026-05-01 fresh upload that scored 12 lacked it because the operator did not type it during the smoke-test re-trigger. Same code path, different operator input.

**Lesson**: when an output regression surfaces, distinguish **code regression** from **input regression** before asserting cause. The smoke test caught a real operational gap (silent fallthrough on empty height) but it was always there — Phase 1c.3 did not introduce it. "Restoring" a field that was never removed would have been an F-OPS-4 violation: re-asserting plan-time assumptions against current reality without verifying.

The reframe (UX hardening — localStorage persistence + inline warning — instead of regression restoration) closes the actual gap. The user explicitly approved dropping a third part of the original Option B (auto-seed default 74 for `FIXED_TEST_ATHLETE_ID`) on the grounds that pre-seeding creates a new failure mode (operator submits without realizing the value isn't from this session). Final shape: localStorage persistence handles "operator typed it before"; inline warning handles "operator forgot." Together they close the gap without creating new ones.

This is exactly the F-OPS-4 family discipline working as designed. Pre-execution sweep is not a procedural ritual; it is the falsification step for the slice prompt's framing of the problem.

## Cross-links

- Origin audit: [`docs/audits/phase-2-smoke-test-2026-05-01.md`](../audits/phase-2-smoke-test-2026-05-01.md) (Anomaly #1 → F-CALIB-1; Anomaly #2 → Group 1; Phase 2 prep backlog → F-OPS-5)
- Findings opened: [F-OPS-5](../risk-register/F-OPS-5-admin-test-uploads-fail-silently-when-target-node-in-draft.md), [F-CALIB-1](../risk-register/F-CALIB-1-top-level-result-data-shadow-values-disagree-with-calibration-audit.md)
- Backlinks: [F-OPS-1](../risk-register/F-OPS-1-zombie-upload-accumulation-rate-sev-3.md) (now ↔ F-OPS-5), [F-SLICE-B-1](../risk-register/F-SLICE-B-1-both-calibration-paths-produce-2-6-distance-errors-static-only.md) (now ↔ F-CALIB-1)
- Process: [F-OPS-4](../risk-register/F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md) — discipline applied to Group 1 reframe
- ADRs touched: [ADR-0014](../adr/0014-c5-unified-edge-function-body-based-path.md), [ADR-0004](../adr/0004-calibration-defer-b2-decision.md)
