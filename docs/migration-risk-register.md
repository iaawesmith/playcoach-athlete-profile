# Phase 1c Migration Risk Register

**Date:** 2026-04-25
**Phase:** 1c.0 — Foundation
**Sequence:** Document 3 of 3 (after `architecture/mediapipe-capability-inventory.md` and `architecture/athlete-lab-end-state-architecture.md`)
**Frame:** Enumerate every meaningful way the Phase 1c cleanup could go wrong, with severity, likelihood, mitigation, and a concrete trigger that should pause the rollout.
**Inputs:** the two sibling docs in this batch; the architecture audit (`docs/athlete-lab-architecture-audit.md`); per your Default B addition, backup-table retention is indefinite (rollback buffer is permanent until explicitly archived).

Severity scale: **Sev-1** (blocks production analyses) · **Sev-2** (silent correctness drift in admin output or Claude prompt) · **Sev-3** (admin UX confusion, no data loss) · **Sev-4** (cleanup hygiene only).

---

## Phase ordering (revised 2026-04-26)

Original audit / risk register entries were authored under an earlier ordering that placed athlete UI as Phase 2 and analysis quality as Phase 3. **Reordered 2026-04-26 to reflect actual product priority: athlete UI must not ship before analysis is trustworthy.**

**Current canonical ordering:**

- **Phase 1c.3** — Admin UI consolidation (next; admin-only cleanup; see `docs/athlete-lab-tab-inventory.md` and `docs/phase-1c3-prep-backlog.md`).
- **Phase 2 — Analysis quality** (was "Phase 3" in earlier docs):
  - **2a** — World coordinates migration (B2 redesign of calibration).
  - **2b** — Metric formula audits.
  - **2c** — Tier-aware scoring.
  - **Plus operational/security obligations:** F-SEC-1 (RLS hardening), F-OPS-2 (error boundaries), F-OPS-1 (zombie cleanup), F-SLICE-E-2 (determinism investigation).
- **Phase 3 — Athlete UI** (was "Phase 2" in earlier docs): builds on the stable analysis foundation produced by Phase 2.

This document and sibling docs have been updated to use the revised labels. Where historical text said "Phase 3" or "Phase 3a/b/c" it now reads "Phase 2" / "Phase 2a/b/c"; where it said "Phase 2 athlete UI" or "Phase 2 ship" it now reads "Phase 3 athlete UI" / "Phase 3 ship". The work itself is unchanged — only the ordering label moved.

---

## §1 — Risk register

### R-01 — Mechanics → Phases content migration loses or duplicates coaching cues
- **Phase:** 1c.1
- **Severity:** Sev-2
- **Likelihood:** Medium
- **Status (2026-04-25):** Mitigated — Slice 2 shipped. See `docs/phase-1c1-slice2-outcome.md` for the full verification record.
- **What happens:** `pro_mechanics` (string of multi-section markdown) gets parsed into `phase_breakdown[].coaching_cues`. Parser misattributes sections to phases (e.g., "Break" coaching cues land on "Stem"), or content is double-stored because both old and new locations are written during transition.
- **Why it's likely:** The audit notes admins have already been duplicating cues across `pro_mechanics[].content` and the lower half of `phase_breakdown[].description` under a `— Coaching cues —` separator (audit Tab 3). Two existing storage sites means migration must reconcile.
- **Mitigation (as shipped in Slice 2):**
  1. Migration is **read-only on `pro_mechanics`** during 1c.1; the new `phase_breakdown[].coaching_cues` field is populated via per-phase admin confirmation.
  2. Side-by-side render in `MigrateCoachingCuesModal` for every phase: legacy mechanics text, legacy inline-description block, and proposed new cue value all visible. Admin must explicitly confirm attribution before any write occurs (no silent migration).
  3. **Atomic strip at confirmation time** (revised from original plan): on confirm, `applyConfirmedCues` writes `coaching_cues` AND removes the `— Coaching cues —` separator block from `phase_breakdown[].description` in the same transaction. This closes the double-render window where slice 1's `phase_context` mode=full would otherwise emit cue text twice (once from `coaching_cues`, once from the inline block) until 1c.2 ships. Renderer-side dedup was rejected as more complex and higher failure surface than atomic strip.
  4. Lifecycle column `coaching_cues_migration_status` (`pending` → `in_progress` → `confirmed`, sticky-confirmed) tracks per-node progress; banner suppression on Phases-tab post-confirmation.
  5. Risk being mitigated remains **content misattribution**, which the side-by-side review continues to address. Post-confirmation behavior is now "atomic strip + new field populated" rather than the originally-planned "additive only." 1c.2 inherits a smaller surface: only column drop (`pro_mechanics` + cleanup of CHECK constraints from slice 1) — description-strip work is done.
- **Trigger to pause:** Any node where the count of detected sections in `pro_mechanics` doesn't equal the count of phases in `phase_breakdown`. (For Slant specifically: pattern is empirically 5 × INLINE_ONLY — `pro_mechanics` is empty — so the bulk-confirm-all shortcut does not apply and the admin must confirm 5 phases individually. This is the helper behaving correctly for the data shape, not a defect.)

### R-02 — System-parameter substitution fix changes Claude output for already-passing nodes
- **Phase:** 1c.1
- **Severity:** Sev-2
- **Likelihood:** High
- **What happens:** Today `{{athlete_level}}`, `{{focus_area}}`, `{{skipped_metrics}}` arrive at Claude as **literal** strings inside `system`. Fixing the bug substitutes real values — which means Claude's behavior changes immediately for every athlete, including nodes that look "fine" today.
- **Mitigation:**
  1. Land the fix behind a per-node feature flag (`llm_substitute_in_system: bool`) defaulting to `false` until a node's prompt is reviewed.
  2. For each node, run a fixture comparison (old prompt vs new) before flipping the flag.
- **Trigger to pause:** Any node where the substituted system prompt produces output that disagrees with the baseline on a labeled fixture.

### R-03 — `{{phase_context}}` injection blows past Claude token budget
- **Phase:** 1c.1
- **Severity:** Sev-3
- **Likelihood:** Medium
- **What happens:** Wiring per-phase descriptions + coaching cues into the user prompt (audit P0 #3) inflates token count. Slant has 5 phases × ~5–7 sentence cues = a meaningful prompt-token jump. May truncate Claude responses or push above `llm_max_words` budget heuristic.
- **Mitigation:**
  1. Compute substituted prompt length pre-call; warn in `claude_api` log section when `prompt_tokens > 0.7 * model_context_window`.
  2. Provide a per-node `phase_context_mode: "full" | "compact" | "names_only"` toggle.
- **Trigger to pause:** Average `prompt_tokens` across last 10 runs increases >2× post-rollout.

### R-04 — Backup table omits a text-bearing field, making rollback impossible
- **Phase:** 1c.2
- **Severity:** Sev-1
- **Likelihood:** Medium
- **What happens:** The `athlete_lab_nodes_phase1c_backup` table is meant to preserve every text-bearing field deleted in 1c.2 (per Default B + your addition: indefinite retention). If the migration script forgets a JSON sub-field (e.g., `reference_calibrations[].calibration_notes`), that admin-authored content is lost permanently.
- **Mitigation:**
  1. Backup table schema is **the union of all DELETE 1c.2 fields enumerated in End-State Architecture §2.9**, columns named `<source_column>` for root and `<source_column>__<sub_field>` for JSON sub-fields, plus `node_id` and `backed_up_at`.
  2. Pre-migration assertion: for every node, every listed field's text content exists in the backup row before any DROP runs.
  3. Backup table is RLS-locked to service_role only; no automatic delete; no TTL.
- **Trigger to pause:** Pre-migration assertion fails for any node.

### R-05 — Tab consolidation hides existing draft-state content from admins
- **Phase:** 1c.3
- **Severity:** Sev-3
- **Likelihood:** Medium
- **What happens:** Collapsing 12 → 8 tabs reroutes editors. An admin who was mid-edit on, say, the Filming Guidance tab returns and can't find the field they were editing.
- **Mitigation:**
  1. 1c.3 ships a one-time "what moved" banner with a tab-by-tab redirect map.
  2. Old tab anchors (`#filming-guidance`) auto-redirect to the new tab + scroll to the moved section.
- **Trigger to pause:** Admin support thread reports >1 "I lost my X field" within 48h.

### R-06 — `det_frequency_defender`/`_multiple` deletion breaks scenario resolution for nodes that never set `det_frequency_solo`
- **Phase:** 1c.2
- **Severity:** Sev-2
- **Likelihood:** Low (nodes default to `det_frequency=7`, `det_frequency_solo=2`)
- **What happens:** `index.ts:1111-1141` resolves the active value with fallbacks. If we drop `_defender` and `_multiple` columns, the fallback chain shortens. Any node where `det_frequency_solo` is null but `_defender` was set as the de-facto active value would silently flip to the root `det_frequency` default.
- **Mitigation:**
  1. Pre-migration: for every node, compute the **currently-resolved** `det_frequency` and write it into a single new column / overwrite `det_frequency_solo` (since they collapse).
  2. Post-migration: re-resolve and assert equality for every node.
- **Trigger to pause:** Any node's resolved `det_frequency` changes value across the migration boundary.

### R-07 — Earmarked-but-deleted athlete-UI fields lose institutional memory
- **Phase:** 1c.2 → future
- **Severity:** Sev-3
- **Likelihood:** High over long horizon
- **What happens:** Backup table preserves text content, but the *intent* ("this was meant for athlete UI per Phase 1c End-State Architecture §2.9") lives only in this doc. A future engineer restoring the table thinks the rows are dead.
- **Mitigation:**
  1. Backup table includes a `disposition` column populated at insert with the End-State doc's earmark label (e.g., `'earmark_athlete_ui'`, `'earmark_claude_prompt'`).
  2. Reference this register and the End-State doc from the migration's description text so the link is in git history.
- **Trigger to pause:** N/A — preventive only.

### R-08 — Removing `solution_class`, `performance_mode`, `tracking_enabled` breaks the Cloud Run request shape
- **Phase:** 1c.2
- **Severity:** Sev-1 if uncoordinated, Sev-4 if sequenced correctly
- **Likelihood:** Medium
- **What happens:** `analyze-athlete-video/index.ts:651-660` posts these fields to the service. `mediapipe-service/app/schema.py` accepts-but-ignores them. If the edge function stops sending them before the service drops them from `AnalyzeRequest`, nothing breaks (Pydantic optional). If the service drops them first while edge keeps sending, also fine. But if anyone tightens `AnalyzeRequest` to forbid extras (`extra = "forbid"`), order matters.
- **Mitigation:**
  1. Service-side: explicitly leave `extra = "ignore"` (Pydantic default) on `AnalyzeRequest` for the duration of 1c.
  2. Edge-side: stop sending the three fields **before** removing them from the DB.
- **Trigger to pause:** Any 4xx from `/analyze` mentioning unexpected fields.

### R-09 — Claude prompt template references a deleted variable
- **Phase:** 1c.2
- **Severity:** Sev-2
- **Likelihood:** Low
- **What happens:** A node's `llm_prompt_template` contains `{{filming_instructions}}` or similar. The substitution loop yields empty string → Claude gets a sentence with a dangling reference ("Remember: " followed by nothing).
- **Mitigation:**
  1. Pre-migration: scan all nodes' `llm_prompt_template` and `llm_system_instructions` for `{{...}}` references; cross-check against the post-1c.2 known-variable list.
  2. Block migration on any unresolved reference; require admin to update the template first.
- **Trigger to pause:** Any unresolved `{{var}}` in any active node's template.

### R-10 — Backup table grows unbounded over future migrations
- **Phase:** post-1c
- **Severity:** Sev-4
- **Likelihood:** Eventual
- **What happens:** Per your Default B addition, backup retention is indefinite. Future cleanups add more rows / more columns. Without naming convention, the table becomes a junk drawer.
- **Mitigation:**
  1. Name backup tables per phase: `athlete_lab_nodes_phase1c_backup`, `_phase1d_backup`, etc. Never reuse a name.
  2. Each backup table includes `archived_at` (NULL by default; set explicitly when the rollback buffer is intentionally retired).
- **Trigger to pause:** N/A — convention only.

### R-11 — `score_bands` field stays orphaned (kept but no consumer)
- **Phase:** post-1c
- **Severity:** Sev-4
- **Likelihood:** High
- **What happens:** End-State keeps `score_bands` but earmarks it for athlete UI. Without a tracking item, the field sits unused indefinitely, recreating the "documentation describes intended behavior, code does something else" pattern (audit Pattern 1).
- **Mitigation:** Open a tracking task in the project backlog at 1c close: "score_bands has no consumer; either wire to athlete result page or revisit in next cleanup."
- **Trigger to pause:** N/A — preventive only.

### R-12 — Mechanics tab deletion strands knowledge_base sub-sections keyed to "mechanics"
- **Phase:** 1c.2
- **Severity:** Sev-3
- **Likelihood:** Medium
- **What happens:** `athlete_lab_nodes.knowledge_base` is `Record<string, KnowledgeSection[]>` keyed by tab name. Deleting the Mechanics tab leaves `knowledge_base.mechanics` orphaned.
- **Mitigation:**
  1. Migration script copies `knowledge_base.mechanics` into `knowledge_base.phases` (with a separator note) before deleting the key.
  2. Same logic for `reference`, `filming_guidance`, `training_status`, `scoring`, `checkpoint` keys → their new home tabs.
- **Trigger to pause:** Any node where merged Phases knowledge_base content > UI display limit (truncation risk).

### F-SLICE-B-1 — Both calibration paths produce 2–6× distance errors; static-only is fundamentally limited for multi-context filming
- **Phase:** 1c.2 Slice B → deferred to **Slice B2** (no schedule; gated on multi-clip ground-truth dataset)
- **Severity:** **Sev-2** (upgraded 2026-04-26 from Sev-3, per Phase 1c.2 determinism experiment Section D corrections)
- **Likelihood:** High across the realistic filming distribution (multi-context filming reality, see below)
- **Status (2026-04-26):** **Option A (delete `body_based`, keep `static`) WITHDRAWN.** Section D ground-truth measurement on `slant-route-reference-v1.mp4` (filmed in a soccer training facility, ppy ≈ 495 from converged circle-fit + athlete-height methods) shows: `body_based` (234) is 1.7–2.4× off; `static` (80) is 5–6.9× off. **Static is more wrong than `body_based` regardless of where exactly true ppy lands within the conservative uncertainty window.** Slice B1 has shipped (non-calibration cleanup). Slice B2 deferred until multi-clip ground-truth dataset exists.
- **What happens:** Both calibration paths produce 2–6× distance errors on the only clip with empirically established ground-truth ppy. Beyond per-clip error magnitude, static-only calibration is **fundamentally limited** for a multi-context product: the static reference value (80) was authored for one specific filming geometry — likely sideline tactical camera at a football field, 25–40 yards from action. Real PlayCoach users will film in indoor soccer/turf facilities, backyards, high-school football fields, and training facilities of every kind. Each filming context has different ppy depending on camera distance, focal length, and frame composition. **Single calibration value cannot serve users filming in soccer facilities, backyards, football fields, and training spaces of varying geometries.** `body_based`'s adaptive nature, despite scale errors, is structurally more compatible with multi-context use than a single static constant.
- **Why Option A is contraindicated by evidence:** The directional finding (static more wrong than body_based) is invariant under any plausible widening of the Section D uncertainty window. Deleting `body_based` would leave the worse calibration path as the only one available. The investigation doc's own Recommendation B explicitly conditioned `body_based` deletion on "we've collected ~10 admin tests to validate that MediaPipe's `body_based` is consistently within a tightened gate range." That collection has not happened, and the one clip we have measured points the opposite direction from what Option A assumes.
- **Implication for B2 redesign:** B2 architectural redesign should consider **Option B (migrate to MediaPipe world coordinates entirely, eliminate calibration as a concept)** rather than choosing between two imperfect calibration paths. This is multi-week Phase 2+ work, not Phase 1c.2 deletion work. Option A is closed; the choice space for B2 is now Option B vs additional adaptive-calibration variants, evaluated against the ground-truth dataset.
- **Mitigation (B1/B2 split, revised 2026-04-26):**
  1. **B1 (SHIPPED 2026-04-26):** all non-calibration cleanup. Calibration path unchanged. Pipeline determinism verified bit-perfect across 5 runs (Sections A and B of `docs/phase-1c2-determinism-experiment.md`).
  2. **B2 (deferred, no schedule, Option A withdrawn):** architectural redesign — choice between Option B (world coordinates) and adaptive-calibration variants. Pre-conditions (all required):
     - Ground-truth ppy established on **≥2 additional clips** beyond `slant-route-reference-v1.mp4`, with verifiable in-frame scale references (5-yard line marker, known-distance object, etc.).
     - Clips ideally span camera distances (close, mid, far) to test whether `body_based`'s under-report direction is consistent or context-dependent.
     - **≥1 sideline football game film clip** representing the actual analysis target — since static reference was authored for that geometry, that context is the fairest test of whether static is correct in its native habitat.
     - Entries recorded in `docs/calibration-ground-truth-dataset.md` (established 2026-04-26 with `slant-route-reference-v1.mp4` as first entry).
  3. **Interim observability (Slice C.5, in flight):** structured `calibration_audit` logging written to `athlete_lab_results.result_data` on every analysis. Captures `body_based_ppy`, `static_ppy`, status enums, and the selected source — regardless of which path won. Future ground-truth measurements join this dataset for cross-clip analysis.
- **Trigger to re-open Option A or pause B2:** Multi-clip dataset shows `static` is correct in its native sideline-football geometry AND `body_based` is consistently wrong across all contexts. Until then, Option A stays closed.
- **Finding (added 2026-04-26, post-Slice-C 5-run verification):** Pre-C.5 codebase had **two `body_based` computations producing different values** — Cloud Run service-side (`~235` on `slant-route-reference-v1.mp4`) and edge function `calculateBodyBasedCalibration` (`~200.21` on the same clip). Slice C.5 unified to the edge function path. Pre-C.5 baseline measurements (Section A's `233.896`, Slice B1 baseline values) are not directly comparable to post-C.5 `calibration_audit.body_based_ppy` values. The two paths disagree by ~14.4% on the only clip with empirical ground truth. **This strengthens the case for B2 considering Option B (world coordinates) rather than picking between imperfect calibration paths** — the system already shipped two divergent answers to the same question. Post-C.5, `~200.21` is the new deterministic baseline for `slant-route-reference-v1.mp4` reproducibility checks.

### F-SLICE-B1-2 — Release Speed metric correctness on `slant-route-reference-v1.mp4` — REFRAMED 2026-04-26 (status: needs verification with known-speed clip)

- **Phase:** deferred to Phase 2 (calibration / metric audit work)
- **Severity:** **Sev-3** (downgraded 2026-04-26 from Sev-2; previous Sev-2 assumed a confirmed independent metric-math bug that the reframing no longer supports)
- **Likelihood:** Unknown until tested against a known-speed clip
- **Status (2026-04-26):** **Reframed from "confirmed metric bug" to "needs verification with a known-speed test clip."** Do **not** close — verification still required.
- **Original framing (now superseded):** Per `docs/phase-1c2-determinism-experiment.md` Section D and `docs/release-speed-velocity-investigation.md`, Release Speed of 158.94 mph (Slice B1 baseline) and 3.37 mph (Section B current) were both interpreted as evidence of an independent metric-math bug *beyond* calibration error, on the assumption the rep being measured was a full-effort game-speed release for which 5–10 mph is the credible window.
- **Reframing trigger:** Re-watching `slant-route-reference-v1.mp4`, the athlete performs a foot shuffle and a controlled-tempo release — **not** a full-burst attack off the line. Realistic ground-truth release speed for *this specific rep* is approximately **1–2 mph**, not 5–7 mph. The 5–10 mph window only applies to a full-effort game-speed release.
- **Reframed interpretation:**
  - **158.94 mph (Slice B1 baseline)** is explainable by severe calibration error alone — when ppy was way off, velocity inflated ~100×.
  - **1.34 mph (Slice D diagnostic, edge-path body_based ppy ~201.78)** is plausibly approximately correct for what the athlete actually did: a slow controlled rep at better calibration. It is **no longer evidence of a metric-math bug** under the corrected ground-truth assumption.
- **What this changes:** Calibration may be the dominant error source for **all** distance/velocity metrics on this clip, with **no separate metric formula bug confirmed**. This shifts the relative priority weighting between:
  - **Phase 2a — world coordinates / calibration redesign (B2 work):** may resolve more issues than originally scoped.
  - **Phase 2b — metric formula audits:** may have a smaller surface area than the prior "confirmed bug" framing implied.
- **Verification gate (required before this finding can be closed or reopened as a confirmed bug):**
  1. Acquire or film a **known-speed test clip** — a timed 40-yard-dash style rep with stopwatch ground-truth speed (or equivalent independently-measured velocity reference).
  2. Run the pipeline against that clip and compare reported Release Speed against the ground-truth value.
  3. If Release Speed produces sensible numbers when input speed is known → close F-SLICE-B1-2; the metric is calibration-dominated and Phase 2a alone is sufficient.
  4. If Release Speed is still off by an order of magnitude after calibration is on a known-good clip → reopen as a confirmed independent metric-math bug; Phase 2b retains its prior priority.
- **Cross-references:** `docs/release-speed-velocity-investigation.md` (original "single-sample lottery" hypothesis — still on the table as a candidate root cause if the verification clip fails); `docs/phase-1c2-determinism-experiment.md` Section D (original framing); `docs/phase-1c2-diagnostic-snapshot-2026-04-26.md` §5.3 (1.34 mph current value).
- **Do not act in Phase 1c.2.** No code change. Backlog item gated on verification clip availability.

### F-SLICE-E-1 — `det_frequency` complex consolidation deferred (Sev-3)

- **Logged:** 2026-04-26, Slice E pre-flight (E.0)
- **Finding:** The originally-proposed Slice E drop list included all three `det_frequency` columns (root, `_defender`, `_multiple`). Pre-flight code audit of `analyze-athlete-video/index.ts` showed `det_frequency_defender` is the authoritative runtime read for the `with_defender` scenario (line 1155) and `det_frequency_multiple` for `multiple` (line 1160). Per Slice B1's collapsed resolver design (lines 1141–1147), the per-scenario columns are authoritative; the root `det_frequency` is no longer consulted at runtime.
- **Action taken in Slice E:** Drop list reduced from 10 to 8 columns. Root `det_frequency` dropped (with paired SELECT-list edit at line 914); `det_frequency_defender` and `det_frequency_multiple` retained.
- **Deferred:** Per-scenario column architecture cleanup (consolidating the three-column shape into a single JSONB or an enum-keyed table) is deferred to Phase 2 metric-quality work or a dedicated calibration/scenario architecture cleanup work item. Dropping `_defender` / `_multiple` without that cleanup would silently degrade analysis to fallback defaults (1, 1) for non-solo scenarios.
- **Severity:** Sev-3 (institutional-memory / cleanup debt; no user-facing impact).

### F-SLICE-E-2 — Pipeline `calibration_audit` shows ~0.78% non-deterministic drift on identical inputs (Sev-2)

- **Logged:** 2026-04-26, Slice E pre-flight (Option C scan)
- **Finding:** Hashing `result_data.calibration_audit` (canonical sorted-keys SHA-256, UTF-8) across 9 historical Slant runs (node `75ed4b18`, athlete `8f42b1c3…`, identical clip, identical params) yielded **3 distinct hash groups**:
  - **Group A** (6 runs, baseline): `34a87126…`. `body_based_ppy = 200.2135`, `body_based_confidence = 0.7866`. Spans Slice C 5-run determinism set + 1 Slice D D.5 run.
  - **Group B** (1 run, drift): `26603f63…`. `body_based_ppy = 201.7827` (Δ +0.78% from Group A), `body_based_confidence = 0.7818` (Δ −0.61%). Same input tags as a Group A run.
  - **Group C** (2 runs, different inputs): `51f5f268…`. `athlete_height_provided = false`; pipeline correctly fell back to static. Not a determinism issue.
- **Diagnosis:** Identical-input runs producing different `body_based_ppy` values demonstrate the pipeline is not bit-exact deterministic. Suspected (not confirmed) sources: floating-point variance in MediaPipe/RTMlib pose estimation, GPU non-determinism, model variance across Cloud Run cold/warm starts, frame-sampling jitter.
- **Decision:** Bit-exact determinism gates are unsafe. E-phase verification adopts Option D (tolerance-based check):
  - Hash matches `34a87126…` exactly → pass.
  - Numeric drift within ±1% (categoricals exact match) → pass + log drift amounts.
  - Numeric drift between ±1% and ±2% → halt for investigation.
  - Drift > ±2% → halt with high confidence of regression.
- **Open diagnostic questions (deferred — investigation does NOT gate Slice E, but should precede Phase 2 metric-quality work):**
  1. Is drift in Cloud Run keypoint output or in edge-side `calculateBodyBasedCalibration`? (Hash Cloud Run keypoint NDJSON across Group A vs Group B runs.)
  2. Do other metrics (Plant Leg Extension, Hip Stability, Release Speed, Hands Extension) drift in lockstep with `body_based_ppy`, or only body-based-derived values? (Lockstep → upstream layer; isolated → calibration-specific.)
  3. What is the magnitude distribution of drift? (Run 5 fresh analyses on identical inputs in a single batch; cost ~$0.25.)
- **Severity:** Sev-2 (real pipeline noise floor; affects metric accuracy ceiling for Phase 2 work).
- **Cross-references:** `docs/phase-1c2-slice-e-outcome.md` (Group A/B/C analysis); `docs/phase-1c2-determinism-drift-log.md` (longitudinal observations); `docs/calibration-ground-truth-dataset.md` (~1% noise floor notation).
- **Update 2026-04-26 (post-E.3.6) — bimodal hypothesis:** E.3.6 observation produced `body_based_ppy = 201.7827255013638`, **bit-identical** to the historical Group B observation (run `a164c815`). Two independent observations producing identical drifted values strongly suggests **discrete bimodal behavior** rather than continuous floating-point noise. Updated hypothesis: drift correlates with a discrete branch in the pipeline — possibilities include Cloud Run cold-vs-warm instance state, GPU vs CPU pose-estimation fallback, or model-weight version served from different replicas. Discrete bimodal patterns are substantially more tractable to investigate than continuous random drift.
- **Phase 2 investigation guidance:** Run 10+ analyses on identical inputs in a single batch. **Predicted result if bimodal:** outputs cluster at exactly 2 distinct values (`200.2135…` and `201.7827…`). **Falsification:** if 3+ distinct values appear, the bimodal hypothesis is wrong and continuous drift is back on the table.

### F-SLICE-E-3 — Recipe propagation without independent verification (process lesson, no severity)

- **Logged:** 2026-04-26
- **Finding:** During Slice E plan-mode iteration, the hash `34a87126…` was propagated through approval messages by the executing agent without independent reproduction against its source upload. When E.0 verification began, the agent first hashed the wrong upload (`a164c815`, which is in Group B) and incorrectly concluded the recipe was wrong; the actual issue was wrong-upload selection. Both errors were caught by Option C scan.
- **Process correction adopted:** Any baseline hash cited in approval messages must be independently reproduced against its source upload before propagation. "Verifiable baselines or no baseline."
- **No code or data impact.** Documented as a process lesson.

### F-OPS-1 — Zombie upload accumulation rate (Sev-3)

- **Logged:** 2026-04-26, Slice E E.1 Gate 5 halt
- **Finding:** 3 `athlete_uploads` rows stuck in `processing` state for ~72h with no `error_message`, `progress_message`, or result. Pattern suggests edge function termination without graceful failure-status write. Observed rate: ~1 zombie/day on current system load.
- **Affected rows (cleaned up via H1):** `70539f0f-a66a-4fe5-afe5-b3a28c84ef33`, `8cff69b5-7294-4ad2-9f9a-c4be08971def`, `65b0544b-6da3-460a-b237-71ab5803181d`. All three updated to `status='failed'` with diagnostic `error_message` referencing F-OPS-1.
- **Severity:** Sev-3 (operational hygiene; doesn't break system but pollutes data and breaks "what's running" queries; will silently false-fail any future pre-flight gate that checks for in-flight uploads).
- **Hypothesized causes (not investigated):** Cloud Run timeout without exception handling, edge function crash without status write, database connection loss mid-analysis, Supabase function instance recycling mid-run.
- **Action:** Not investigated as part of 1c.2. Bundled into Phase 2 (analysis quality) operational obligations per revised phase ordering — escalate earlier if rate increases. Recommended remediation:
  - Add automated zombie-sweep job: any `processing` upload with `created_at < now() - interval '2 hours'` → mark `failed` with `error_message='auto-zombie-sweep'`.
  - Add alerting on `processing` rows older than 30 minutes.
  - Wrap `analyze-athlete-video` in a top-level try/finally that always writes a terminal status, even on `Deno.exit`/`SIGTERM`.
- **Cross-reference:** Slice E E.1 Gate 5 (`docs/phase-1c2-slice-e-outcome.md` §8); H1 cleanup applied 2026-04-26.

### F-SEC-1 — Permissive RLS on admin tables + public storage bucket listing (Sev-2)

- **Logged:** 2026-04-26, surfaced during Slice E E.2 migration security linter check.
- **Finding:** Multiple pre-existing RLS policies on admin-scoped tables use the permissive `USING (true) WITH CHECK (true)` pattern, granting any authenticated role full read/write/delete access. Additionally, the public storage bucket allows unrestricted listing of object keys. **Not introduced by Slice E** — predates Phase 1c.2 entirely. Surfaced here so it does not get lost in linter passing-notes.
- **Affected tables (permissive `ALL` policy to `public` role):**
  - `admin_enhancements` — "Allow all access to admin_enhancements"
  - `admin_implementation_docs` — "Allow all access to admin_implementation_docs"
  - `admin_reference_cache` — "Allow all access to admin_reference_cache"
  - `admin_reference_links` — "Allow all access to admin_reference_links"
  - `admin_tab_guidance` — "Allow all access to admin_tab_guidance"
  - `athlete_lab_nodes` — "Allow all access to athlete_lab_nodes"
  - `pipeline_setup_checklist` — "Allow all access to pipeline_setup_checklist"
  - (Plus `athlete-media` storage bucket, public + listable.)
- **Severity:** **Sev-2 — blocks Phase 3 athlete UI ship.** Once authenticated athlete users land on the platform, they will inherit the `public`/`authenticated` role grants and gain unrestricted read/write/delete on every admin-controlled table. This is a real shipping blocker, not a hygiene item. Per revised phase ordering (2026-04-26), F-SEC-1 is bundled into the Phase 2 analysis-quality + operational-obligations track so it lands before Phase 3 athlete UI work begins.
- **Required action before Phase 3 athlete UI ships (executed during Phase 2):**
  1. Replace all `USING (true) WITH CHECK (true)` policies on admin tables with role-based RLS (admin role for write; restrict reads on sensitive tables to admin/`service_role` only).
  2. Implement a `user_roles` table with `app_role` enum (`admin`, `athlete`, …) and `has_role(uuid, app_role)` SECURITY DEFINER function per workspace standard.
  3. Audit `athlete-media` bucket: either flip to private with signed URLs, or confirm contents are intentionally world-readable and document the decision.
  4. Re-run security linter; expect zero remaining permissive admin policies.
- **Out-of-scope rationale (Slice E):** Per Slice E halt discipline, scope was strictly the 8-column `athlete_lab_nodes` drop + NodeEditor save-payload edit. Touching RLS policies would have violated the scope ceiling and forced a halt. Logged here for Phase 2 planning (operational/security obligations bundle).
- **Cross-reference:** Slice E E.2 security linter output (`docs/phase-1c2-slice-e-outcome.md`).

---

## §2 — Top 3 risks (heatmap)

Ranked by Severity × Likelihood × Reversibility:

1. **R-04 — Backup table omits a text-bearing field** — Sev-1, irreversible. The single risk where a mistake permanently loses admin-authored content. Pre-migration assertion is non-negotiable.
2. **R-02 — System-param substitution fix silently changes Claude output** — Sev-2, reversible (flag flip), but high likelihood and affects every athlete the moment it ships. Per-node feature flag is the right control.
3. **R-01 — Mechanics → Phases content migration misattributes coaching cues** — Sev-2, partially reversible (backup table preserves source), but the path of least surprise is the side-by-side admin confirmation cycle in 1c.1.

The risks that look scariest at first glance (R-08 service contract, R-06 det_frequency resolution) are actually controllable through ordering — they only become Sev-1 if the migration sequence is wrong, which is a planning problem, not an unknown.

---

## §3 — Recommended starting point for Phase 1c.1

Given the risk profile, the right first slice of 1c.1 is the **lowest-risk highest-value** capability to activate from the End-State plan:

> **Wire `{{phase_context}}` into the Claude prompt (audit P0 #3), gated behind a per-node opt-in flag.**

Reasoning:
- It's the first capability with **no DB schema change** and **no deletion** — pure additive code work in the edge function.
- It directly tests R-03 (token budget) on real data without committing to the rollout.
- It lays the groundwork for R-01 (Mechanics merge) by establishing where coaching cues belong end-to-end before we ask admins to confirm phase attribution.
- It avoids touching the system-prompt substitution path (R-02) until we've proven the new template-variable expansion works in the user-prompt path first.

The system-param substitution fix (R-02) is P0 by audit ranking but should be the **second** 1c.1 slice, after `{{phase_context}}` has shaken out the template-variable plumbing.

DB schema work (1c.2) starts only after both 1c.1 slices have one full week of clean runs in production.

---

## §3.5 — Methodological note: comparison invariants across migration boundaries

**Established:** 2026-04-25, during Phase 1c.2 Slice A R-04 backup-completeness assertion.

When asserting parity of values captured before vs. after a migration boundary, the correct comparison invariant depends on the data shape — not on whether the column happens to be `text` or `jsonb` in Postgres:

| Data shape | Correct invariant | Why |
|---|---|---|
| Plain text columns (markdown, prose, identifiers) | **Byte-equal** | No re-rendering occurs; any byte drift indicates real corruption. |
| JSONB sources, or any structure that is parsed and re-serialized across the boundary | **Semantic deep-equal** of parsed objects | PostgreSQL's `::text` cast on JSONB normalizes whitespace and key order differently than JS `JSON.stringify`. Byte-equal will produce false negatives even when the data is identical. |
| Sets of extracted tokens (e.g., `{{var}}` references in a template, enum values present, column names produced) | **Set equality** | Order and multiplicity are not invariants; membership is. Neither byte- nor deep-equal models the actual contract. |
| Numeric resolved values (e.g., the integer `det_frequency` after fallback resolution) | **Byte-equal on the canonical string form**, or `===` on parsed numbers | Once resolved to a scalar, there is no representational ambiguity; byte-equal is sufficient and the strictest. |

**Application to Phase 1c.2 assertions:**

- **R-04 (backup completeness):** Mixed — text fields use byte-equal, JSONB sources use semantic deep-equal. Implemented in `scripts/verification/slice1c2_r04_backup_assert.ts`.
- **R-06 (`det_frequency` parity across collapse):** Byte-equal on the persisted resolved integer. The resolver outputs a scalar; no JSON re-serialization occurs.
- **R-09 (template-variable resolution after deletes):** Set equality of `{{var}}` tokens extracted from `llm_prompt_template` and `llm_system_instructions`, cross-checked against the post-1c.2 known-variable list. Neither byte- nor deep-equal applies — the contract is "every referenced variable resolves to a non-empty value."

**Discipline for future phases:** Before writing any new R-xx assertion script, name the data shape first and pick the invariant from this table. Do not default to byte-equal because the column type is `text`; do not default to deep-equal because the column type is `jsonb`. The shape of the data and what crosses the boundary determines the invariant.

---

## §4 — Closing summary

- **12 risks enumerated** across 1c.1 (functional), 1c.2 (deletion), 1c.3 (UI consolidation), and post-1c hygiene.
- **1 Sev-1 risk** (R-04, backup completeness) — controlled by a pre-migration assertion that must pass for every node before any DROP runs.
- **4 Sev-2 risks** — all controllable via sequencing, feature flags, or side-by-side admin confirmation.
- **Backup table** is named `athlete_lab_nodes_phase1c_backup`, includes a `disposition` column carrying the End-State earmark label, and is retained indefinitely until explicitly archived (per Default B addition).
- **Recommended 1c.1 starting point:** `{{phase_context}}` wiring with per-node opt-in. Lowest risk, highest information yield, sets up the harder migrations safely.

End of Phase 1c.0 foundation batch.

---

## §5 — Slice E E.5 findings (appended 2026-04-26)

### F-SLICE-E-4 — Mechanics tab crash post-`pro_mechanics` drop
- **Severity:** Sev-3
- **Logged:** 2026-04-26
- **Status:** Resolved via tab hide. Component deletion deferred to 1c.3.
- **Finding:** First E.5 browser smoke halted on `TypeError: Cannot read properties of undefined (reading 'trim')` when the Mechanics tab mounted `MechanicsEditor` at `NodeEditor.tsx:1015`. Root cause: `draft.pro_mechanics` is now `undefined` post-migration `20260426025918` and the read path lacks the defensive `?? ""` null-guard used at sibling sites. Crash unmounted the React tree.
- **Resolution:** Mechanics tab commented out of `TABS` array and removed from `ADVANCED_TAB_KEYS` in `NodeEditor.tsx`. Component file retained for 1c.3 deletion. Scope: 5-line edit. Avoided writing throwaway `?? ""` patches because `MechanicsEditor` is on the 1c.3 deletion list (content already migrated to phase coaching cues in Slice 2).
- **Process learning:** Slice E's frontend audit methodology checked existence of defensive patterns (e.g., `?? ""`) elsewhere in the file rather than verifying each individual consumer of dropped columns. The unguarded line 1015 was missed because most other consumers were guarded. **Going forward:** audits for data-shape-changing slices must verify each consumer site, not infer safety from pattern presence.

### F-OPS-2 — Missing error boundary around NodeEditor (Phase 3 ship blocker)
- **Severity:** **Sev-2** (upgraded 2026-04-26 from Sev-3 — reframed as Phase 3 athlete-UI ship blocker; remediation work bundled into Phase 2 per revised phase ordering)
- **Logged:** 2026-04-26 (severity upgraded same day; phase label updated 2026-04-26 PM)
- **Status:** Open. **Must land before Phase 3 athlete-facing UI ships** (i.e., during Phase 2 operational/security obligations track).
- **Finding:** A single null-deref inside any sub-editor (e.g., `MechanicsEditor` line 1015) unmounts the entire `NodeEditor` tree because there is no React error boundary at the tab-content level. During Slice E.5 first-attempt smoke, the `pro_mechanics` undefined dereference unmounted the whole admin shell — top nav, sidebar, all content blank — with no recovery path except a full page reload. For Phase 1c admin work this is uncomfortable but tolerable (admin user, technical, refresh-friendly). For Phase 3 athlete-facing UI it is unacceptable: an uncaught error mid-upload would blank an athlete's screen with no recovery path. Athletes are not technical users and will not understand a refresh-and-retry instruction; the perceived product failure mode is "the app broke and ate my upload."
- **Severity rationale (Sev-2):** Silent correctness failures in athlete UX are Sev-2 territory; "entire screen unmounts to root with no recovery" is the maximally bad version of that for a non-technical user. Containment is a non-negotiable prerequisite for athlete-facing surfaces.
- **Action (Phase 3 prerequisite, executed during Phase 2):** Add `ErrorBoundary` components at key React-tree positions before any Phase 3 athlete-facing surface ships:
  1. `AthleteLab` outer shell — admin work, last line of defense.
  2. `NodeEditor` tab-content level — wrap each `{tab === "..." && <SubEditor />}` block so a single sub-editor failure renders a "This tab failed to load — see console" panel and lets the admin keep using other tabs.
  3. **All future athlete-facing surfaces** (upload flows, result viewers, profile pages) — wrap at route level and at any subtree containing user-generated content rendering, with sensible recovery UI ("Something went wrong — your upload is safe, try refreshing this view").
- **Cross-references:**
  - **F-SLICE-E-4** — methodology gap that allowed the unguarded line 1015 to reach E.5; demonstrates that even with rigorous pre-flight audits, a single missed consumer can take the whole tree down.
  - **Slice E.5 first-attempt crash** — the empirical demonstration of the exposure. Artifacts: `/mnt/documents/slice-e-smoke/03-tab-04-mechanics-CRASH.png`, `console-cumulative.txt`.
- **Definition of done:** Phase 3 ship checklist must include "ErrorBoundary at AthleteLab, NodeEditor tab-content level, and every athlete-facing route" as a gate. Not a hand-wave "we should add error boundaries someday."

### F-SLICE-E-5 — Solution Class radio control writes to dropped column
- **Severity:** Sev-3
- **Logged:** 2026-04-26 (post-Slice-E.5 re-run report observation, §2.2 row 13)
- **Status:** Open. Scheduled for Phase 1c.3 cleanup.
- **Finding:** The Solution Class radio control on the Training Status tab is reachable and interactive: all three cards (Body, Body with Feet, Wholebody) render in an unselected state (the expected post-drop visual), and the click handler still binds form state for `solution_class`. If an admin clicks one of the cards and triggers Save, the form state would attempt to write `solution_class` to a column that no longer exists in the schema (dropped in migration `20260426025918`). Read paths were verified null-safe in the Slice E.5 §1.2 audit; the **write path was not audited** and remains coupled to the dropped column at the form-state level.
- **Failure mode:** PATCH `4xx` from PostgREST with `column "solution_class" of relation "athlete_lab_nodes" does not exist` (error code `42703`). **Graceful save failure**, not a render crash — distinguishes this from F-SLICE-E-4 (Mechanics tab unmount). Admin sees a toast / network error rather than a white screen, and other tabs remain usable.
- **Why latent in the re-run:** The Slice E.5 save validation toggled `phase_context_mode` (compact ↔ full), which exercises a different field. The Solution Class radio was visually inspected ("unselected, expected") but not clicked, so the write-path exposure was not triggered. PATCH 200 OK on the toggle does not generalize to all fields on the tab.
- **Mitigation options for 1c.3** (any one resolves):
  1. **Hide the Solution Class radio control** on the Training Status tab (analogous to the Mechanics tab hide pattern from F-SLICE-E-4 recovery). Lowest-effort defensive move if the tab itself stays.
  2. **Disconnect form state binding from the save payload at the source.** The save payload was already cleaned in Slice E.4 (Resolution A — payload excludes `solution_class`), but `update("solution_class", …)` calls in the radio's click handler still mutate `draft.solution_class`. A subsequent save would not actually transmit it (since payload construction is allow-list, not deny-list — verify), but the state coupling is fragile and should be removed.
  3. **Remove the entire Training Status tab** if Phase 1c.3 consolidation eliminates it per `docs/athlete-lab-tab-inventory.md` (tab 13 disposition: "consolidate or rename"). This resolves F-SLICE-E-5, the per-scenario `det_frequency_*` tab-content question, and the orphaned-radio question in one move.
- **Verification needed during 1c.3 audit:** Confirm whether the save-payload allow-list in `NodeEditor.tsx` (lines ~600–625, the post-Slice-E.4 cleaned payload) actually filters out `draft.solution_class` even when the form-state has it set. If yes, Sev-3 stays; if no (i.e., payload is spread-based and would transmit any field on `draft`), upgrade to Sev-2 immediately because the exposure is one click away from a failing save.
- **Root cause (shared with F-SLICE-E-4):** Slice E's frontend audit methodology checked read paths for null-safety but did not enumerate write-path bindings (click handlers, controlled-input `onChange`, form-state `update()` calls) for dropped columns. Going forward, data-shape-changing slices must audit **read paths AND write paths AND form-state bindings** for every dropped column.
- **Cross-references:**
  - **F-SLICE-E-4** — same root-cause methodology gap; different failure mode (render crash vs save failure).
  - **F-SEC-1** — pending Phase 3 athlete UI; both are pre-Phase-3 cleanup obligations executed during Phase 2 (analysis quality + operational/security track), tracked under different severities.
  - `docs/athlete-lab-tab-inventory.md` — tab 13 (Training Status) disposition rationale.

