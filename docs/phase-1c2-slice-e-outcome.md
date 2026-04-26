# Phase 1c.2 — Slice E Outcome

**Status:** In progress (E.0 pre-flight complete; pipeline determinism check pending)
**Started:** 2026-04-26
**Scope:** Final destructive step in 1c.2 — root column drops on `athlete_lab_nodes`.

---

## §1 — Slice E scope (revised)

Original drop list: 10 columns. Revised to 8 columns after E.0 pre-flight code audit (see F-SLICE-E-1).

### Columns dropped in Slice E (8)

- `pro_mechanics`
- `llm_tone`
- `det_frequency` (root only)
- `solution_class`
- `performance_mode`
- `tracking_enabled`
- `reference_object`
- `reference_filming_instructions`

### Columns retained (originally proposed for drop)

- `det_frequency_defender` — authoritative runtime read at `analyze-athlete-video/index.ts:1155` (`with_defender` scenario)
- `det_frequency_multiple` — authoritative runtime read at line 1160 (`multiple` scenario)

Per-scenario column architecture cleanup deferred. See F-SLICE-E-1 in `docs/migration-risk-register.md`.

---

## §2 — Canonical determinism hash recipe

**Recipe:** SHA-256 of canonical-JSON-encoded `result_data.calibration_audit`.
- **Canonical JSON:** sorted keys, no whitespace separators (`,` and `:`), UTF-8 encoded
- **Field path:** `athlete_lab_results.result_data->'calibration_audit'`
- **Reference implementation (Python):**

```python
import json, hashlib
canonical = json.dumps(audit_obj, sort_keys=True, separators=(',', ':'))
hash_hex = hashlib.sha256(canonical.encode('utf-8')).hexdigest()
```

- **Reference implementation (psql + python):**

```bash
psql -t -A -c "COPY (SELECT result_data->'calibration_audit' FROM athlete_lab_results WHERE id='<RESULT_ID>') TO STDOUT;" \
  | python3 -c "import sys,json,hashlib; o=json.load(sys.stdin); print(hashlib.sha256(json.dumps(o,sort_keys=True,separators=(',',':')).encode()).hexdigest())"
```

**Authoritative baseline:** `34a8712604547408d5b8c2c7d5c37a281eaf9c9d83619dc1f6668a4e29afcc77`

Adopted from 6/9 historical Slant runs (Slice C 5-run determinism set + 1 Slice D D.5 run). See §3.

---

## §3 — Group A / B / C analysis (Option C scan)

**Scan inputs:** All 10 most recent `complete` uploads for node `75ed4b18-8a22-440e-9a23-b86204956056` (Slant) by athlete `8f42b1c3-5d9e-4a7b-b2e1-9c3f4d5a6e7b` (FIXED_TEST_ATHLETE_ID). 9 had `calibration_audit`; 1 (`4eb11f6d`, `1c2-determinism` experiment) did not.

### Hash distribution

| Group | Hash | Run count | Source |
|---|---|---|---|
| **A** (baseline) | `34a87126…` | 6 | 5× Slice C verification + 1× Slice D D.5 post-strip-verify |
| **B** (drift) | `26603f63…` | 1 | 1× Slice D D.5 post-strip-verify (`a164c815`) |
| **C** (different inputs) | `51f5f268…` | 2 | 2 untagged runs (no `athlete_height` provided) |

### Per-group `calibration_audit` field comparison

| field | Group C (`51f5f268`) | Group B (`26603f63`) | Group A (`34a87126` — baseline) |
|---|---|---|---|
| `athlete_height_provided` | `false` | `true` | `true` |
| `body_based_status` | `not_attempted` | `used` | `used` |
| `body_based_ppy` | `null` | `201.7827255013638` | `200.21353797230793` |
| `body_based_confidence` | `null` | `0.7817768960473507` | `0.78658371191…` |
| `selected_source` | `static` | `body_based` | `body_based` |
| `selected_ppy` | `80` | `201.78272550…` | `200.21353797…` |
| `static_ppy` | `80` | `80` | `80` |
| `static_status` | `used` | `computed_but_not_selected` | `computed_but_not_selected` |
| `dynamic_status` | `failed` | `failed` | `failed` |
| `dynamic_failure_reason` | `dynamic_pixels_per_yard_out_of_range` | (same) | (same) |
| `camera_angle` | `sideline` | `sideline` | `sideline` |
| `node_id` | (same) | (same) | (same) |
| `node_version` | `6` | `6` | `6` |

### Interpretation

- **Group C is correct behavior.** Different input (`athlete_height` missing from `analysis_context`) → pipeline correctly fell back to static calibration. Not a determinism finding.
- **Group A vs Group B is the determinism finding.** Identical inputs (per `analysis_context`); different `body_based_ppy` (Δ +0.78%) and `body_based_confidence` (Δ −0.61%). All categorical fields match. See F-SLICE-E-2.

### Run-level inventory

| upload_id | created_at (UTC) | experiment | group |
|---|---|---|---|
| `4b848c06-2868-44f5-8355-53d69b77efb9` | 2026-04-26 02:15:13 | (none) | C |
| `a164c815-0fa7-4705-8970-910fe93ef859` | 2026-04-26 01:56:35 | `1c-slice-d-d5-post-strip-verify` | **B** |
| `6ba462dc-ae58-409d-a248-65fad2b4629e` | 2026-04-26 01:55:25 | (none) | C |
| `d2df20e9-f827-4b58-8674-cbb4917cc7fc` | 2026-04-26 01:47:22 | `1c-slice-d-d5-post-strip-verify` | A |
| `0527f664-ea84-45dc-a5c6-6072e256b809` | 2026-04-26 01:08:25 | `1c-slice-c-verification` | A |
| `c946e1ad-45ac-46d6-b059-b4194185fc34` | 2026-04-26 01:08:25 | `1c-slice-c-verification` | A |
| `a9ece02b-c4bb-4e49-98b4-0a4b64f1ce07` | 2026-04-26 01:08:25 | `1c-slice-c-verification` | A |
| `0a477dc7-d1d5-4aaa-891e-2dafcce84bac` | 2026-04-26 01:08:25 | `1c-slice-c-verification` | A |
| `528f296a-63ce-4355-ba46-241c97f78f43` | 2026-04-26 01:08:25 | `1c-slice-c-verification` | A |

---

## §4 — Option D verification protocol (Slice E E.0 / E.3.6)

Adopted in lieu of bit-exact determinism gates. Applies to both E.0 (post-SELECT-list-edit) and E.3.6 (post-migration determinism re-check).

### Decision matrix

| Condition | Outcome |
|---|---|
| Hash exactly matches `34a87126…` | ✅ Pass |
| Hash differs; categorical fields all exact match; numeric drift ≤ ±1% relative | ✅ Pass + log drift to `docs/phase-1c2-determinism-drift-log.md` |
| Hash differs; numeric drift > ±1% and ≤ ±2% | ❌ Halt for investigation |
| Hash differs; numeric drift > ±2% on any numeric field | ❌ Halt — high-confidence regression |
| Any categorical field differs | ❌ Halt — categoricals require exact match |

### Categorical fields requiring exact match

`camera_angle`, `node_id`, `node_version`, `athlete_height_provided`, `body_based_status`, `static_status`, `dynamic_status`, `dynamic_failure_reason`, `selected_source`.

### Numeric fields subject to ±1% / ±2% bands

`body_based_ppy`, `body_based_confidence`, `selected_ppy`, `static_ppy`.

### Drift logging requirement

Every E-phase verification observation (pass or halt) appends to `docs/phase-1c2-determinism-drift-log.md` with: date, upload_id, result_id, hash, group classification, per-field deltas vs baseline, outcome.

---

## §5 — Backup table integrity baseline (E.3.3 anchor)

**Captured:** 2026-04-26 pre-E.0
**Hash:** `ad8bb95c7d6292b73905efe657df911ecbad04a5d5253a94742eb802788a3201`
**Row count:** 14 (10 root + 4 JSONB sub-fields, all from Slice A capture)

### Recipe

```sql
SELECT encode(sha256(convert_to(
  string_agg(
    node_id::text || '|' ||
    source_column || '|' ||
    COALESCE(content, '') || '|' ||
    COALESCE(audit_pattern, '') || '|' ||
    COALESCE(disposition, '') || '|' ||
    COALESCE(audit_reason, '') || '|' ||
    COALESCE(original_intent, '') || '|' ||
    COALESCE(slice, ''),
    E'\n' ORDER BY node_id, source_column
  ), 'UTF8')
), 'hex') AS backup_integrity_hash, COUNT(*) AS row_count
FROM athlete_lab_nodes_phase1c_backup;
```

**Notes:**
- Excludes `id` (random uuid, drift-prone) and `captured_at` (timestamp, drift-prone) and `node_name` (denormalized).
- Includes `content` — the integrity-critical backed-up payload.
- Order key: `(node_id, source_column)` — composite-unique within the backup.
- E.3.3 re-runs this exact query post-migration and asserts byte-equality. Backup table is text-only — no determinism risk.

---

## §6 — Process lessons (F-SLICE-E-3)

1. **Recipe propagation gap.** The hash `34a87126…` was propagated through approval messages without independent reproduction against its source upload. When E.0 verification began, the agent first hashed the wrong upload (`a164c815` — Group B) and incorrectly concluded the recipe was broken; the actual issue was wrong-upload selection. Option C scan caught both.
2. **Process correction:** any baseline hash cited in approval messages must be independently reproduced against its source upload before propagation. "Verifiable baselines or no baseline."
3. **Halt-condition discipline worked.** Each halt (det_frequency scope conflict, hash mismatch, multi-group drift) caught a real issue before it became a Cloud Run cost or a destructive migration.

---

## §8 — E.1 Gate 5 zombie-cleanup event (H1)

**Halt:** First Gate 5 run halted on 3 `athlete_uploads` rows in `processing` state since 2026-04-23 (~72h old, no `progress_message`, `error_message`, or result row). Predates Slice E by 3 days; no relationship to schema migration.

**Affected upload_ids:**
- `70539f0f-a66a-4fe5-afe5-b3a28c84ef33` (created 2026-04-23 03:48:24 UTC)
- `8cff69b5-7294-4ad2-9f9a-c4be08971def` (created 2026-04-23 03:41:42 UTC)
- `65b0544b-6da3-460a-b237-71ab5803181d` (created 2026-04-23 03:31:43 UTC)

**Resolution (H1, user-approved):** Updated all 3 to `status='failed'` with `error_message='zombie cleanup pre-Slice-E.2: stuck in processing >72h with no progress/error update, likely edge function termination without graceful failure write. Root cause not investigated. See F-OPS-1.'`

**Finding logged:** F-OPS-1 in `docs/migration-risk-register.md` (Sev-3, operational hygiene).

**Gate 5 re-run:** ✅ PASS (0 in-flight uploads).

---

## §9 — Outcome status (rolling)

- ✅ **E.0 step 1** — SELECT-list edit at `analyze-athlete-video/index.ts:912-914`. Removed root `det_frequency`. Retained `det_frequency_solo`, `det_frequency_defender`, `det_frequency_multiple`. Edge reference scan clean for 8 dropped columns.
- ✅ **E.0 step 2** — Backup table integrity hash captured (`ad8bb95c…`). Recipe documented.
- ✅ **E.0 step 3** — Option C historical scan complete. Baseline `34a87126…` adopted. F-SLICE-E-2 logged.
- ✅ **E.0 step 4** — Pipeline determinism verification PASSED. Run `2b3e2731-…` hashed exactly to baseline. Group A.
- ✅ **E.1** — All 7 pre-flight gates PASSED (Gate 5 after H1 zombie cleanup; F-OPS-1 logged).
- ✅ **E.2** — Bundled atomic migration (8 columns) executed via `20260426025918`. Backup integrity intact.
- ✅ **E.3** — Post-write assertions PASSED.
- ✅ **E.4** — NodeEditor save-payload edit completed (12-line save-payload edit + 1 null-safety touch on line 1015 area deferred to recovery).
- ✅ **E.5** — Live browser smoke completed in two attempts:
  - **Attempt 1:** HALT on Mechanics tab `TypeError` at `NodeEditor.tsx:1015`. See F-SLICE-E-4. Recovery decision: hide tab now (5-line edit), defer full component deletion to 1c.3 — avoids throwaway `?? ""` patch on a component slated for removal.
  - **Step 2 audit:** Scanned all remaining 7 dropped columns × all consumers. Zero unguarded references on kept tabs. No additional patches written. Full audit table in `/mnt/documents/slice-e-smoke/rerun-1/REPORT.md` §1.2.
  - **Line 1158 specific resolution (`MigrateCoachingCuesModal` consuming `pro_mechanics`):** Reachable but data-protected and downstream-null-safe. The modal is opened via `setMigrationModalOpen(true)` from `CoachingCuesMigrationBanner` buttons rendered on the still-visible Phases tab (line 1058) and the now-hidden Mechanics tab (line 1012). The banner returns `null` for `surface="phases"` when `coaching_cues_migration_status === "confirmed"` — and the only existing node (`Slant`, `75ed4b18…`) is `confirmed`, so the banner suppresses and the modal entry point is unreachable in current production data. Even if a non-`confirmed` node existed and an admin opened the modal, the modal's only consumer of `pro_mechanics` is `reconcileNode(phase_breakdown, pro_mechanics)` (modal line 131), whose signature is `(phase_breakdown, pro_mechanics_raw: string | null | undefined)` and which delegates to `parseProMechanicsText(raw: string | null | undefined)` — both null-safe at the utility layer (`migrateCoachingCues.ts:85,191`). **No code change applied.** The TypeScript prop type on `MigrateCoachingCuesModal` still declares `pro_mechanics: string` (not `string | null`) — this is a type-safety lie now that the column is dropped, but it does not produce a runtime crash because the utility layer accepts undefined. Disposition: deferred to 1c.3 alongside Mechanics component deletion; the modal itself becomes obsolete once `coaching_cues_migration_status` is universally `confirmed` and the migration banner/modal are removed entirely.
  - **Attempt 2:** PASS. All 13 remaining tabs walked clean. Sideline `pixels_per_yard=80` confirmed (ground-truth match). Solution Class radio renders unselected (expected post-drop state). `phase_context_mode` toggle save = PATCH 200, request body excludes all 8 dropped columns and includes the 3 retained per-scenario `det_frequency_*` columns. No `42703` errors, no `trim` errors, no white screens.
  - Artifacts: `/mnt/documents/slice-e-smoke/` (first attempt) and `/mnt/documents/slice-e-smoke/rerun-1/` (recovery + pass).

**Slice E status: COMPLETE pending hand-off acknowledgment.**

