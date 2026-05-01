# Phase 1c.2 — Slice D Outcome

> *Legacy slice outcome doc (pre-template, Pass 3f). Frontmatter contract evolved 2026-04-26; this doc retained as historical record.*


**Date:** 2026-04-26
**Status:** ✅ SHIPPED (pending user-driven D.6 steps 1+2 admin UI smoke)
**Predecessors:** Slice A (backup), Slice B1 (non-calibration cleanup), Slice C (calibration_audit logging)
**Successor:** Slice E (final destructive root column drops)

---

## Scope (executed)

Five refinements applied to the approved plan:

1. **D.5 step 4** specified as full-pipeline (Section B style, athlete_uploads insert with `athlete_height=74"`), single run sufficient because Slice C proved 5-run determinism.
2. **D.1 step 2** sub-field recoverability check made executable: read prod sub-field, parse parent JSONB from backup, extract same path, compare; halt on any divergence.
3. **D.6 step 2** acceptance: empty inputs / "—" render = acceptable; console errors / crashes / failed save = halt.
4. **D.5 backup-table integrity regression check** added: confirm Slice A backup row hashes unchanged post-strip.
5. **Bundled migration internal order** locked: D.2 (CHECK) → D.3 (ref_cal strip) → D.4 (cam_guidelines strip), atomic transaction.

---

## D.1 — Pre-flight gates: ✅ ALL PASS

| Check | Result |
|---|---|
| R-04 backup re-assertion (14 Slant rows) | ✅ Hashes captured for D.5 regression check |
| Sub-field recoverability — `reference_calibrations[]` × 6 sub-fields × 3 entries = 18 paths | ✅ All byte-equal between prod and parsed parent JSONB backup |
| Sub-field recoverability — `camera_guidelines.skill_specific_filming_notes` | ✅ Empty in both prod and backup; `camera_filming_instructions` byte-equal preserved |
| R-06 det_frequency parity | ✅ Unchanged (root=7, solo=2, defender=1, multiple=1) |
| `phase_context_mode` allowlist pre-check | ✅ Slant = `'compact'` (in allowlist) |
| R-09 template variable scan (`llm_prompt_template`, `llm_system_instructions`) | ✅ Zero `{{var}}` references to any of the 7 stripped sub-fields |
| Edge function (`analyze-athlete-video/index.ts`) reference scan | ✅ Zero references to stripped sub-fields → calibration runtime cannot be perturbed |

---

## D.2 / D.3 / D.4 — Bundled migration: ✅ APPLIED

Single atomic transaction, internal order per Refinement 5.

- **D.2:** `ALTER TABLE athlete_lab_nodes ADD CONSTRAINT athlete_lab_nodes_phase_context_mode_check CHECK (phase_context_mode IN ('full', 'compact', 'names_only'))`
- **D.3:** Stripped 6 sub-fields from each `reference_calibrations[]` element. Post-state per element: exactly `{camera_angle, pixels_per_yard, status}`. (`status` was not on the End-State §2.9 strip list — correctly preserved.)
- **D.4:** Stripped `skill_specific_filming_notes` from `camera_guidelines`. All other keys preserved including `camera_filming_instructions` (byte-equal verified).

Migration: `supabase/migrations/20260426014559_c23a598a-73bc-4e45-9286-90b44b7f2a9c.sql`

Linter warnings post-migration (8) are **all pre-existing** RLS/storage findings on tables not touched by Slice D. Out of scope.

---

## D.5 — Post-write assertions: ✅ ALL PASS

| Check | Result |
|---|---|
| (1) R-04 backup integrity regression (Refinement 4): all 14 backup row hashes match D.1 capture | ✅ No backup-table mutation |
| (2) R-04 sub-field recoverability re-check post-write | ✅ All sub-fields still recoverable from parent JSONB backups |
| (3) D.3 strip verification: every `reference_calibrations[]` element = `{camera_angle, pixels_per_yard, status}` | ✅ |
| (4) D.4 strip verification: `skill_specific_filming_notes` absent; `camera_filming_instructions` byte-equal preserved | ✅ |
| (5) R-06 det_frequency parity post-strip | ✅ Unchanged |
| (6) R-09 template scan post-strip | ✅ No new unresolved `{{var}}` |
| (7) **Full-pipeline determinism re-check** (Refinement 1) — single run, athlete_uploads insert, athlete_height=74" | ✅ See below |

### D.5 step 4 full-pipeline result

Upload `d2df20e9-f827-4b58-8674-cbb4917cc7fc`, post-strip pipeline run.

```json
{
  "node_id": "75ed4b18-8a22-440e-9a23-b86204956056",
  "static_ppy": 80,
  "camera_angle": "sideline",
  "node_version": 6,
  "selected_ppy": 200.21353797234588,
  "static_status": "computed_but_not_selected",
  "body_based_ppy": 200.21353797234588,
  "dynamic_status": "failed",
  "selected_source": "body_based",
  "body_based_status": "used",
  "body_based_confidence": 0.7865837119124024,
  "dynamic_failure_reason": "dynamic_pixels_per_yard_out_of_range",
  "athlete_height_provided": true
}
```

**SHA-256:** `34a8712604547408d5b8c2c7d5c37a281eaf9c9d83619dc1f6668a4e29afcc77`

**Byte-identical** to the Slice C post-C.5 baseline (`34a8712604547408…`). The JSONB sub-field strips did not perturb runtime calibration math — the audit object is bit-for-bit reproducible across the migration boundary.

Verification script: `scripts/verification/slice1c2_d5_post_strip_verify.ts`

---

## D.6 — Live Browser Smoke

### Step 3 (production analysis with `calibration_audit` logging) — ✅ MECHANICALLY COVERED

The D.5 step 4 run (upload `d2df20e9-f827-4b58-8674-cbb4917cc7fc`) was a real production pipeline execution post-strip. `calibration_audit` is well-formed in `result_data`, status enums are correct, body_based/static/dynamic all present and matching post-C.5 baseline. C.5 logging coexists cleanly with D's strips.

### Steps 1 + 2 (admin UI tab traversal + Reference tab visual) — ⏳ PENDING USER

Frontend audit forecast (`rg` over `src/`):

- `NodeEditor.tsx` (lines 2677–2991), `nodeExport.ts` (lines 227–242), `types.ts` (lines 180–186, 241–242) all still **read** the 7 stripped sub-fields using `??` / `||` fallback chains and TypeScript-optional fields.
- Read sites render `"Not configured"` / `"Not set"` / empty string / empty input when the sub-field is absent. **Per Refinement 3, this is acceptable.**
- No read site invokes `.toUpperCase()`, `.length`, etc. on a raw stripped value without optional chaining → **no expected console errors**.
- **Write sites** (`onUpdate({ reference_object_name: ..., known_size_yards: ... })` in NodeEditor) will **re-introduce** stripped sub-fields if an admin edits and saves a Reference Calibration. This is expected — Slice D strips are point-in-time; permanent removal of frontend coupling lands with Phase 1c.3 Tab Consolidation. **Document as follow-up cleanup, not a halt condition.**

### D.6 acceptance map (per Refinement 3)

| Symptom in admin UI | Disposition |
|---|---|
| Reference tab inputs show empty / "Not configured" for stripped sub-fields | ✅ Acceptable — log as 1c.3 follow-up |
| Other tabs render normally, save form succeeds | ✅ Acceptable |
| Console error mentioning a stripped sub-field name | 🛑 HALT — investigate |
| Admin tab crashes (white screen, error boundary) | 🛑 HALT — rollback via `athlete_lab_nodes_phase1c_backup` |
| Form save fails with stripped-sub-field error | 🛑 HALT |

---

## Risk register impact

- **R-04 (Sev-1):** mitigation re-validated. Backup completeness preserved through Slice D. Slice E gate intact.
- **R-06:** trivially passed pre + post.
- **R-09:** scanned pre + post; no growth.
- **R-08:** untouched (B1 edge log line still in production, Cloud Run contract unchanged).
- **F-SLICE-B-1 (Sev-2):** unchanged. Slice D is non-calibration cleanup.
- **No new risk class introduced.**

---

## Slice E — what unblocks now

Slice D shipping confirms:

1. R-04 mitigation works end-to-end (back up → strip → verify recoverable).
2. Calibration audit logging survives schema changes in adjacent JSONB.
3. JSONB sub-field projection is a safe primitive.

Slice E (root column drops) inherits Slice D's verification surface and applies it to the larger destructive operation. Slice E pre-flight will re-run R-04 / R-06 / R-09 against the 10 root columns enumerated in End-State §2.9 (`pro_mechanics`, `llm_tone`, `det_frequency`, `solution_class`, `performance_mode`, `tracking_enabled`, `reference_object`, `reference_filming_instructions`, etc.) and the `athlete_height` admin-UI cleanup from Slice C scope.
