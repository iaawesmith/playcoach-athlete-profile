# Phase 1c.2 — Deletion Phase

## Status
- Pre-Slice-A artifacts: ✅ complete (camera_guidelines pre-flight, det_frequency snapshot, baseline Slant analysis)
- Slice sequencing: A → B → C → D → E **serial** (not parallel)
- Tab 8 calibration architecture: **Option A provisional** — pending Slice B doc reads
- Verification: R-04, R-06, R-09 assertion scripts; R-08 contract verification via edge log; Live Browser Smoke per slice

## Active slice
**Slice A — Backup table** (in flight)

## Slice A scope
1. Create `athlete_lab_nodes_phase1c_backup` (id, node_id, source_column, content, disposition, audit_reason, original_intent, captured_at).
2. Insert one row per (node × text-bearing field slated for deletion). Backup descriptions enriched per Finding 2 with audit reasoning + original intent (Pattern 1 = dead, Pattern 2 = collapsed, Pattern 3 = relocated, Pattern 4 = JSON sub-field).
3. Run R-04 backup completeness assertion: every (node × deletion-target field) pair present, byte-equal content, dispositions assigned.
4. Report results. Gate A→B on R-04 pass.

## Slice B scope (next)
**Pre-step:** read `docs/calibration-source-trace.md` and `docs/calibration-ppy-investigation.md` end-to-end. **Halt and surface as Finding** if either doc reveals a scenario where neither dynamic nor static calibration would work for Slant's camera angle and body-based was the only safety net.

Code changes (after doc reads pass):
- `analyze-athlete-video`: drop `solution_class`, `performance_mode`, `tracking_enabled` from MediaPipe POST body (4-key payload: `video_url`, `start_seconds`, `end_seconds`, `det_frequency`).
- Collapse `det_frequency` resolution chain: per-node UPDATE persists resolved values into `det_frequency_solo` / `_defender` / `_multiple` (idempotent for Slant per snapshot).
- Delete `calculateBodyBasedCalibration` function and its call sites; static reference becomes the only fallback (Tab 8 Option A).
- Delete dead `athlete-lab-analyze` edge function.
- **Add Finding 5 log line:** `logInfo('mediapipe_request_payload', { keys: Object.keys(requestPayload) })` immediately before the MediaPipe `fetch` call. Permanent observability for R-08 contract verification.

### Slice B verification (UPDATED — metric-value comparison thresholds)
Run a Slant analysis post-Slice-B and compare against baseline `docs/phase-1c2-baseline-slant-analysis.md`:

| Metric category | Baseline values | Threshold | On exceed |
|---|---|---|---|
| Angle (Plant Leg Extension) | 103.37° | **±5%** | Halt and surface as Finding (no calibration dependency expected) |
| Distance / velocity (Hip Stability 0.09yd, Release Speed 158.94mph, Hands Extension 1.74yd) | as listed | **±50%** | Halt and surface as Finding for evaluation |

Above threshold may mean (a) body-based was wrong and static is correcting (acceptable, document and continue) or (b) static calibration is misconfigured for Slant's camera angle (regression, halt). "Halt and evaluate" lets us decide explicitly rather than letting drift slip through.

Document deltas in `docs/phase-1c2-slice-b-outcome.md`.

Other Slice B verifications:
- R-06: pre/post `det_frequency` resolution parity per node (trivially passes for Slant per snapshot).
- R-08: `mediapipe_request_payload` log line shows exactly 4 keys.
- R-09: `llm_prompt_template` variables still resolve; `missing_variables` set does not grow.
- Live Browser Smoke: open Slant in `/athlete-lab`, trigger an analysis end-to-end, confirm no console errors.

## Slice C–E scope (unchanged from approved plan)
- **C:** SectionTooltip `forwardRef` fix, `onStatusChange` no-op prop removal, remove `athlete_height` from admin types.
- **D:** `phase_context_mode` CHECK constraint (`'full' | 'compact' | 'names_only'`); strip targeted sub-fields from `camera_guidelines` JSONB (preserve `camera_filming_instructions`); strip non-`pixels_per_yard` fields from `reference_calibrations[]`.
- **E:** Root column drops (10 fields including `pro_mechanics`, `llm_tone`, `det_frequency`, etc.) gated on R-04 / R-06 / R-09 re-assertions.

## Post-1c.2 backlog (admin authoring — NOT code work)
- **Slant `camera_filming_instructions` content drift:** the admin-authored text currently says "the athlete's height in their profile will be used as a reference," which becomes factually wrong after Slice C removes `athlete_height`. Update Slant's filming instructions to remove the athlete_height reference and replace with an accurate description of the new (static-only) calibration model. Tracked separately from 1c.2 code work; bundle with the user's other post-Slice-3 admin authoring tasks.

## Risk register references
- R-04 (Sev-1, irreversible): backup completeness — gates Slice A→B and Slice E execution.
- R-06: det_frequency resolution parity — trivially passes per pre-Slice-A snapshot.
- R-08: MediaPipe request contract — verified via edge log line shipping in Slice B.
- R-09: llm_prompt_template variable safety — re-asserted before Slice E drops.
