---
slice_id: PHASE-2A-SLICE-A1
title: Calibration clip intake runbook
status: living
date_established: 2026-06-03
related_risks: []
related_findings: [F-SLICE-B-1, F-CALIB-1]
related_adrs: [ADR-0004]
---

# Calibration Clip Intake Runbook

**Purpose:** Define a repeatable workflow for taking a new candidate ground-truth video from "filmed" to "appended entry in `docs/reference/calibration/ground-truth.yaml`," so the Phase 2a goal of moving the dataset from n=1 to n≥3 across ≥2 filming contexts is mechanical rather than improvised.

**Status:** Living document. The append-step contract is locked by [`../reference/calibration/_schema.md`](../reference/calibration/_schema.md); steps 1–4 below are operational and may evolve as Slices A2/A3 ship tooling.

---

## Probe node

The **slant route node** is the canonical calibration probe node for Phase 2a.

- **Node status:** published, active. No draft-state risk per F-OPS-5 (admin-test uploads against draft nodes fail silently).
- **Why this node:** it is already the source of the n=1 entry (`slant-route-reference-v1.mp4`), so cross-clip comparisons against it are apples-to-apples (same metric definitions, same calibration code paths, same downstream pipeline).
- **No provisioning required.** Do not clone or fork; route every Phase 2a intake clip through the existing slant route node.

If the slant route node is unpublished or modified mid-phase, **halt intake** and surface a finding — re-publishing or cloning changes the comparison basis and invalidates inter-clip determinism reasoning.

---

## Scale-reference methodologies supported

A2 tooling (`scripts/verification/calibration_estimate_ppy.ts`, ships in next slice) will support **three** methodologies in parallel so the operator can pick per-clip based on what the filming context actually offers. None is privileged; all three are first-class inputs to the YAML `measurement_methodology` list.

| ID | Name | Inputs the operator must capture | Best for |
|---|---|---|---|
| `tape_measure` | Known length placed on the ground in-frame | Tape length (ft/yd), pixel span between tape endpoints in the chosen frame | Indoor / backyard / informal contexts where a tape can be staged before filming |
| `yard_line` | Known field-marking distance | Distance between two markings (yd), pixel span between them in the chosen frame | Football / soccer fields with visible yard lines or center-circle / penalty-arc geometry |
| `bbox_cross_check` | Athlete-height bbox against claimed real height | Visible athlete pixel height (head-y to foot-y), claimed real standing height, posture-compression caveat | Any clip where (1) and (2) are unavailable but the athlete's height is known; **lowest-confidence method**, use as cross-check not primary when possible |

**Multi-method preferred.** Per the existing n=1 entry, two independent methods that converge upgrades `measurement_confidence` from `low` → `medium`. A single method generally pins `measurement_confidence: low`.

---

## Intake workflow

### Step 0 — Pre-flight

- Confirm the slant route node is published.
- Confirm a stored `athlete_height` value exists for the test athlete (per `FIXED_TEST_ATHLETE_ID` UX hardening from PHASE-2-PREP-FOLLOWUPS — operator should not have to re-type per session, but should also not assume the value is current). Re-enter height for the actual athlete in this clip if different.

### Step 1 — Film

Choose a filming context **not already represented** in `ground-truth.yaml` (currently: soccer training facility). Examples that grow context diversity:

- Sideline football clip with a visible 5-yard line marker (native geometry for `static_ppy = 80`).
- Backyard / informal filming.
- Indoor turf at a different camera distance than the existing entry.

Capture, when possible, **at least one** of the three scale references in frame:

- A tape measure laid on the ground, fully visible at the start frame.
- A yard-line marker pair (e.g., the 30 and 35).
- An athlete of known real height standing upright at the start frame (for bbox cross-check).

**Recording defaults to lock down:**

- Master resolution at the camera's native rate (do not downsample before upload — the existing entry documents preview-vs-master dimension confusion).
- Static camera position for the duration of the clip (no zoom/pan).
- Athlete fully in frame at start; cut-relevant action ≤ 3 seconds (matches `MAX_WINDOW_SECONDS` in the analyze pipeline).

### Step 2 — Upload and analyze

- Upload the clip via the admin test upload flow against the slant route node.
- Confirm the analysis completes (`athlete_lab_results` row written; no F-OPS-5 silent-fail).
- Capture the resulting `upload_id` and the `calibration_audit` row contents — this is the per-path ppy that the pipeline produced.

### Step 3 — Estimate true ppy (A2 tooling, when shipped)

Run the A2 estimator (placeholder until that slice ships):

```bash
bun run scripts/verification/calibration_estimate_ppy.ts --clip <file_identifier> --method tape_measure --inputs '...'
```

For each scale reference visible in the clip, feed it through the matching methodology. Record all derived ppy values. Convergence across ≥2 methodologies on overlapping ranges → `medium` confidence; single method → `low` confidence.

If no scale reference is in frame, you can still submit the clip with `bbox_cross_check` only and `measurement_confidence: low`. It still counts toward `min_entries_for_b2_decision` if it adds a new filming context, but a low-confidence-only dataset is a weak basis for the B2 architectural decision — flag this in the operator handoff.

### Step 4 — Append to `ground-truth.yaml`

Follow [`../reference/calibration/_schema.md` § Append workflow](../reference/calibration/_schema.md) verbatim. Do not round, do not reformat numeric values from the `calibration_audit` row.

After append:

- If `len(entries) >= min_entries_for_b2_decision` AND `len(unique filming_contexts) >= min_filming_contexts_for_b2_decision`, the **A3 threshold gate** trips and ADR-0004 becomes eligible for re-open.
- If the new clip changes the directional finding (e.g., `body_based` over-reports somewhere, or `static` is suddenly correct in its native geometry), add a notes amendment to `../reference/calibration-ground-truth-dataset.md` Section "Entries."

---

## Halt conditions

| Condition | Action |
|---|---|
| Slant route node is unpublished or modified mid-phase | Halt intake; surface as a new finding in `docs/risk-register/`. Do not silently re-route through a different node. |
| Analyze pipeline fails or returns no `calibration_audit` row | Halt; check F-OPS-5 (draft-node silent fail) and F-CALIB-1 (shadow-value disagreement) before re-running. |
| Dimension confusion between preview and master | Halt; verify the master file is the analysis target per the existing entry's `video_dimensions.notes` precedent. |
| No scale reference visible in frame AND athlete height unknown | Do not submit. The clip cannot anchor any methodology and adds no decision-grade evidence. |

---

## Cross-links

- [`../reference/calibration/_schema.md`](../reference/calibration/_schema.md) — append-workflow contract.
- [`../reference/calibration/ground-truth.yaml`](../reference/calibration/ground-truth.yaml) — current dataset (n=1).
- [`../adr/0004-calibration-defer-b2-decision.md`](../adr/0004-calibration-defer-b2-decision.md) — the deferred decision this intake unblocks.
- [`../risk-register/F-SLICE-B-1-both-calibration-paths-produce-2-6-distance-errors-static-only.md`](../risk-register/F-SLICE-B-1-both-calibration-paths-produce-2-6-distance-errors-static-only.md) — origin finding.
- [`../risk-register/F-CALIB-1-top-level-result-data-shadow-values-disagree-with-calibration-audit.md`](../risk-register/F-CALIB-1-top-level-result-data-shadow-values-disagree-with-calibration-audit.md) — caveat on which calibration values to record (always read the `calibration_audit` row, not top-level shadow values).
- [`../risk-register/F-OPS-5-admin-test-uploads-fail-silently-when-target-node-in-draft.md`](../risk-register/F-OPS-5-admin-test-uploads-fail-silently-when-target-node-in-draft.md) — pre-flight check rationale.
