---
id: F-SLICE-B-1
title: Both calibration paths produce 2–6× distance errors; static-only is fundamentally limited for multi-context filming
status: deferred
severity: Sev-2
origin_slice: 1c.2-Slice-B
origin_doc: docs/process/phase-1c2-slice-b1-outcome.md
related_adrs: [ADR-0004, ADR-0014]
related_entries: [F-CALIB-1]
opened: 2026-04-26
last_updated: 2026-05-01
---

# F-SLICE-B-1 — Both calibration paths produce 2–6× distance errors; static-only is fundamentally limited for multi-context filming
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
