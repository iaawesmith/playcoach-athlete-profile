# Phase 2a — Athlete Lab smoke testing with the verified 20-clip set

## Where we actually are

Verified against the repo (nothing has moved since 2026-06-03):

- `ground-truth.yaml` — **n=1** (one entry, soccer training facility, master 4096×2304). Needs n≥3 across ≥2 contexts to re-open ADR-0004.
- `determinism-drift.csv` — only the 5 historical seed rows. No `baseline`/`postship` rows, so B1/B2 stay verification-pending.
- A1 shipped. A2, B1, B2 code-complete/verification-pending. A3, B3, C blocked.
- Repo connection intact; `docs/STATUS.md` is still the resume-here file, updated at every slice close.

## Drive folder — verified read-only

Folder `1TUxdyCmaLNv4rTA77-E6dBYVjgM5O5i1`, connection "Eric's Google Drive" (gateway-backed, not linked to the project and it doesn't need to be). Contents confirmed: **20 files, 10 routes × 2 angles, all `video/mp4` at 3840×2160, 6.2–9.6 s, 235–369 MB.** Routes: Cross0, Wheel1, Slant2, Out3, Curl4, Comeback5, In6, Corner7, Post8, Go9. Filenames identify the angle (`-side` / `-behind`), so selection needs no frame pulls.

Two things the listing surfaced:

**These are the masters, not previews.** 4K at 235–369 MB is consistent with camera-native files, which clears the dimension-confusion halt condition up front. I'll still record `width`/`height` per entry from Drive metadata.

**Resolution differs from the n=1 entry** (3840×2160 vs 4096×2304). That's a feature, not a problem — it means the new entries genuinely exercise a second camera geometry rather than re-measuring the same rig, which is what "≥2 filming contexts" is supposed to buy.

## Answers to your earlier questions

**Run all 20?** No — not for calibration. ppy is a property of camera geometry, not route variety; 20 clips of one static rig in one facility is one calibration point measured twenty times, at 20× Cloud Run cost. **3 clips for intake**, the other 17 become the Phase 3 metric-regression corpus.

**Which 3?** Side angles only, 3 different routes. Behind angles foreshorten lateral break distance toward the optical axis, so a yard-line ppy measured there doesn't transfer to distance/velocity metrics. Proposed: **`Slant2-calibration-side.MP4`** (same route as the n=1 entry, so it's the cleanest cross-context comparison), **`Out3-calibration-side.MP4`**, **`Comeback5-calibration-side.MP4`** — all three are sharp lateral breaks, which is where ppy error shows up most. Behind angles aren't discarded; they get registered as the B3 world-landmark corpus (hip/shoulder orientation is exactly what a behind angle is good for).

**Drive as pipeline input?** No. The analyze path reads the private `athlete-videos` bucket, so the 3 selected masters get pulled from Drive and uploaded to `athlete-videos/test-clips/`. Drive is identification and verification, not ingestion.

## The sequence

**1. Clip prep (no pipeline cost)**
Pull the 3 side-angle masters via the Drive connector, confirm byte size and dimensions match the listing, upload to `athlete-videos/test-clips/`. Record Drive file IDs in each ground-truth entry for provenance.

**2. A2 interim-bar verification**
On `Slant2-calibration-side.MP4`, run `calibration_estimate_ppy.ts` twice — `yard_line` (marking pair) and `bbox_cross_check` (athlete height). Convergence within the documented ±5% envelope clears A2's interim bar and flips A2 to Shipped.

Worth noting why this is better than the n=1 re-inspection we'd planned: the existing entry *does* already have two converging methods, but its primary was an **algebraic circle fit on a soccer center-circle arc**, which is not one of the three registered first-class methodologies. So it can't discharge the interim bar as written. A visible yard-line pair gives `yard_line` as a registered primary for the first time.

The A2 doc's other two obligation fields stay as written: the **full bar** (3-methodology convergence) and the **surviving ADR-0005 obligation** (cross-clip determinism, ±1%, n≥3 across ≥2 contexts) both remain owed. I won't fold them in quietly.

**3. Track A intake ×3**
Each clip through the A1 runbook: upload against the published slant-route node, confirm the `calibration_audit` row is written (F-OPS-5 pre-flight; F-CALIB-1 — read the audit row, never top-level shadow values), estimate ppy per methodology, append verbatim per `_schema.md`.

Result: **n=4 across 2 filming contexts.** Both ADR-0004 thresholds met.

**4. `PHASE-2A-SLICE-A3` — threshold gate**
`scripts/verification/calibration_dataset_threshold.ts`: reads the YAML, applies `min_entries_for_b2_decision` (3) and `min_filming_contexts_for_b2_decision` (2), exits non-zero when unmet. Running it green is what formally makes ADR-0004 eligible for re-open.

**5. Unblock B1/B2 (your side, start in parallel now)**
Check out pre-B1 SHA **`2bcff8e`**, deploy `mediapipe-service` at that SHA as a parallel Cloud Run revision, keep HEAD (`7e4b403`) live. Once both revision URLs exist: baseline×10 and postship×10 against the canonical slant clip, append to `determinism-drift.csv`, hand me the finished CSV. I run `--check` only — per the wiring boundary you ruled, live-pipeline contact stays operator-side. On exit 0, B1+B2 flip to Shipped and A3/B3 unblock. On halt, first diagnostic is N more baseline runs at `2bcff8e`, not a B1 investigation.

**6. Phase 3 corpus registration (no runs)**
Register the remaining 17 clips — route, angle, Drive file ID, dimensions — as the metric-regression corpus. This is what makes the full 20-clip set pay off after calibration is trusted.

## Flags to validate before I execute

**Clip duration vs the analysis window.** The A1 runbook says cut-relevant action should be ≤3 s to match `MAX_WINDOW_SECONDS` in the analyze pipeline. These clips are 6.2–9.6 s. I grepped for that constant and did not find it, so I'm **not** asserting what the pipeline does with a 7-second clip — it may window internally, or it may analyze a stretch that doesn't contain the break. Confirming this is the first thing I'd check in step 1, before spending any Cloud Run time. If the pipeline doesn't window, the clips need trimming to the break, which is a real (small) step 1 addition.

**4K ingest.** Nothing in the plan assumes the service downsamples. If it processes 4K natively, per-clip runtime and memory are higher than the n=1 baseline — relevant to cost on step 5's 20 runs, not to correctness.

## Technical notes

- No athlete-facing UI, no athlete-facing table changes, no new database tables. Ground truth stays append-only in `ground-truth.yaml` per ADR-0013.
- The Drive connector stays unlinked from the project — read-only one-off gateway calls only. The app has no runtime Drive dependency.
- Every slice closes with outcome doc + `roadmap.md` + `docs/STATUS.md` in one commit. F-OPS-6 applies: verification that can't run in-slice halts the slice.

## Open decision

**A3 ordering.** A3 is formally blocked on the B1/B2 drift band. Steps 1–3 run immediately either way. Do you want A3 to wait for the drift band (strict, preserves the registered dependency), or treat the Track A threshold gate as independent of Track B and unblock it once n=4 lands? Strict is my default.
