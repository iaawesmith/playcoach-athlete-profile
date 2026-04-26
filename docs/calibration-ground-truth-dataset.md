# Calibration Ground Truth Dataset

**Established:** 2026-04-26
**Purpose:** Append-only registry of analyzed clips with empirical pixels-per-yard (ppy) estimates and the values each calibration path produced at the time of measurement. This is the dataset the deferred Slice B2 calibration architecture decision will eventually be made against.

> **No architectural decisions get made off this dataset until it has ≥3 entries spanning at least two filming contexts.** Per F-SLICE-B-1 in the migration risk register, B2 redesign is deferred until ground-truth ppy is established on additional clips with verifiable in-frame scale references — ideally clips spanning camera distances (close, mid, far) and representing the actual analysis target (sideline football game film).

---

## Schema (per entry)

| Field | Type | Description |
|---|---|---|
| `file_identifier` | string | Stable name. **Never** a signed URL. |
| `bucket_path` | string | `athlete-videos/...` storage path. |
| `video_dimensions` | string | `WxH` of the master file analyzed. Note any preview-vs-master discrepancies. |
| `true_ppy_estimate` | string | Best estimate or range. Use a range when uncertainty is meaningful. |
| `measurement_methodology` | string | Plain-language description of how the estimate was derived, including which independent methods converged. |
| `body_based_ppy_at_time_of_measurement` | number \| null | Value `calculateBodyBasedCalibration` returned, regardless of whether selected. |
| `static_ppy_at_time_of_measurement` | number \| null | Value `selectCalibration(node, camera_angle)` returned, regardless of whether selected. |
| `measurement_confidence` | `low` \| `medium` \| `high` | Confidence in the ground-truth estimate, not in the analysis output. |
| `notes` | string | Caveats: bbox contamination, marking ambiguity, posture artifacts, lighting, etc. |
| `recorded_at` | ISO date | When the entry was added. |

---

## Entries

### slant-route-reference-v1.mp4

- **file_identifier:** `slant-route-reference-v1.mp4`
- **bucket_path:** `athlete-videos/test-clips/slant-route-reference-v1.mp4`
- **video_dimensions:** `4096×2304` (master analyzed by the pipeline). A `1024×576` transcoded preview also exists; downstream sanity checks performed against the preview are technically invalid against the actual analysis target. See dimension-confusion footnote in `docs/phase-1c2-determinism-experiment.md` Section D corrections.
- **true_ppy_estimate:** **~495** (best point estimate; defensible range ~450–550 if marking identification is conservatively widened)
- **measurement_methodology:**
  1. **Algebraic least-squares circle fit on visible arc at frame bottom.** Arc spans ~3,579 px. Under the assumption that this is a FIFA soccer center circle (10-yard radius), `ppy ≈ 494.89`. Marking identification (see Notes) is now well-supported by facility context.
  2. **Athlete-height bbox cross-check at frame 60.** Visible athlete pixel height ~750–850 px (the diagnostic bbox is contaminated on the right by the dome wall, so the raw 970 px figure overstates). For a 6-ft athlete in a cutting/leaning posture (compresses standing height by ~15–25%), expected pixel height at `ppy ≈ 495` is in the 750–850 range — **consistent with circle fit**.
  3. **Convergence:** both independent methods land within their uncertainty envelopes on `ppy ≈ 485–495`. The 495 point estimate is more defensible than the previously-recorded "400–550 range," which was driven by an over-broad treatment of marking identification.
- **body_based_ppy_at_time_of_measurement:** *Two pre-C.5 code paths existed and produced different values on this clip. C.5 unified to the edge-function path; longitudinal values below are recorded by source and date.*
  - **Cloud Run service-side body_based (pre-C.5 code path, no longer used in selection):** `235.32`
    - Section A direct-call measurement (`233.896`) is consistent with this path within rounding/run-to-run noise.
    - Diagnostic snapshot 2026-04-26 confirms Cloud Run service-side path still emits `235.321` on the current clip (consistent across baseline and current state — that path is stable).
  - **Edge function `calculateBodyBasedCalibration` (post-C.5 code path, current selected source) — longitudinal:**
    - Slice C 5-run determinism baseline: `200.21` (deterministic across 5 runs, byte-identical `calibration_audit` hash).
    - Slice D post-strip diagnostic (2026-04-26, single run): `201.78`.
    - **Inter-run drift:** ~0.78% between Slice C baseline and Slice D diagnostic on what should be identical input. Small but non-zero on a code path C.5 did not modify and Slice D JSON cleanup did not touch. Tracked in backlog for Phase 3 — possible Cloud Run instance variance vs. real determinism issue; could compound if upstream calibration scaling changes.
  - **Path disagreement (Cloud Run vs. edge):** `235.321` vs. `~200–202` ⇒ ~14–15% on this clip. Persists in current state per Slice D diagnostic; remains real input for the B2 architectural decision.
  - **Comparability:** Pre-C.5 baseline measurements are not directly comparable to post-C.5 `calibration_audit.body_based_ppy` values. Post-C.5 edge-function values (currently `~200–202`) are the deterministic-ish baseline for `slant-route-reference-v1.mp4` reproducibility checks; allow ~1% tolerance until the inter-run drift item is resolved.
  - **Directional finding (Notes section below) is unchanged:** all observed body_based values (235, 201, 200) under-report ppy vs. ground-truth ~495, and all remain less wrong than `static`. The path disagreement and the new inter-run drift both strengthen — not weaken — the case for B2 considering Option B (world coordinates) rather than picking between imperfect calibration paths.
- **static_ppy_at_time_of_measurement:** `80`
- **measurement_confidence:** `medium`
  - Upgraded from "low" by facility context (see Notes), but not "high" because no in-frame metadata-confirmed scale reference (yard-line marker, tape measure, calibration object of known length) is present.
- **notes:**
  - **Filming context identified:** soccer training facility — visible from the dome interior, soccer goal in background, and field markings consistent with a soccer pitch. In a soccer facility, the prominent visible arc is almost certainly the **center circle** — penalty arcs are at field ends and not typically framed as the training reference; center spots are dots not arcs. The original "could be center circle, could be penalty arc, could be custom marking" framing overstated marking-identification uncertainty.
  - **Athlete bbox contamination:** the cyan diagnostic bbox extends well to the right of the actual athlete, reaching the netting/dome wall. Raw bbox-derived pixel height (~970 px) overstates; visual measurement of the actual athlete (head ~y=400–450, foot ~y=1180–1250) gives ~750–850 px.
  - **Posture compression:** athlete is mid-cut, leaning. Leaning compresses standing pixel height by 15–25%, so the 750–850 px observation is consistent with a 6-ft standing athlete at `ppy ≈ 495`, not the 990 px a fully-erect 6-ft athlete would occupy.
  - **Directional finding (robust across the full uncertainty window 450–550):**
    - `body_based` (234) is **1.7–2.4× off** (under-reports ppy → over-reports distances by the same factor)
    - `static` (80) is **5–6.9× off** (under-reports ppy → over-reports distances by the same factor)
    - **Static is more wrong than body_based regardless of where exactly true ppy lands.** This conclusion is invariant under any plausible widening of the uncertainty range.
  - **Multi-context filming implication:** static reference value (80) was authored for one specific filming geometry — likely sideline tactical camera at a football field, 25–40 yards from action. Real PlayCoach users film in indoor soccer/turf facilities, backyards, high-school football fields, and training facilities of every kind. Each context has different ppy depending on camera distance and focal length. Static at 80 is correct for one geometry and wrong everywhere else. This is not a static authoring bug; it is a **fundamental limitation of any single static constant for a multi-context product.**
- **recorded_at:** 2026-04-26

---

## Future entries needed before B2 architectural decision

Per F-SLICE-B-1 mitigation:

1. ≥1 sideline football clip with a real 5-yard line marker visible in frame (the original analysis target geometry — confirms whether `static=80` is correct in its native context).
2. ≥1 backyard / informal-filming clip (tests body_based's adaptive behavior at close range).
3. Ideally clips spanning camera distances (close, mid, far) on the same athlete, to test whether `body_based`'s under-report direction is consistent or context-dependent.

When these entries exist, the B2 architectural decision (Option A delete-one-path vs Option B world-coordinates-eliminate-calibration) can be made on evidence rather than reasoning from a single clip.
