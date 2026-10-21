# Roadmap

- [x] Correct Analysis Log reporting only: node measurement windows, separate smoothing/frames, active-used keypoint warnings, service identity/timings, optional variable display; real result 3e01efe2 verified in browser (3/15/10, smoothing 3, zero warnings, PASS); 11 reporting/export tests pass.

- [x] Audit and lock library run context, explicit changed-field overrides, fresh pre-submit comparison, clip-duration cap, edit link and result context; no analyzer or node changes. Verified UI, saved height override, mismatch blocking, Clear, and 2.27s preflight rejection; 32 tests pass.

- [x] Audit the specified 15 nodes' phase descriptions, coaching cues, and metric descriptions without changing node data.
- [x] Change only the ALL-tab display order to WR, TE, RB and official route order.
- [x] Verify filtered tabs and node records remain unchanged; WR Slant remains LIVE.
- [x] Calibration Video Library: direct-to-storage uploads (500MB), archive-instead-of-delete for clips with runs, chosen depth metric comparison, library-run tag + history filter.
- [ ] Lock Video Library to signed-in admins (blocked: needs admin login, tracked in F-SEC-1).
- [x] Slant 4K30 fixes: velocity whole-window, confidence gate 0.8 (window-only) + keypoint_warning flags, plausibility bounds, error-rule fix + detected_errors objects, results display parsing, low-quality LLM guard; reran clip.
- [ ] Node review: "Hands Extension at Catch" measures distance between both index fingers (kp 19↔20), not extension (left unchanged by request).

## Calibration v2 (approved Oct 20)
- [x] Height-based per-frame scale + candidate audit + depth_motion_present + static resolution flag (analyzer)
- [x] Calibration block in Testing Panel
- [x] Pose-service diff (item 2) prepared separately — deploy order: repo service as-is → analyzer → diff
- [ ] Deploy pose service (a) then diff (c), rerun 4K30 twice to confirm identical results — waiting on user deploy
- [ ] Re-check catch-frame scale vs manual 170 px/yd estimate (frame check reads ~215–225) — waiting on user

## Run 44c52897 fixes (approved Oct 21)
- [x] Stage 1 pose service: 150 px zoom gate, path-covering crop, IMAGE-mode exit fallback, body-height-relative partial-detection rejection, timings + build id (framing.py tested)
- [ ] Deploy Stage 1 from Cloud Shell (set SERVICE_BUILD) — waiting on user
- [x] Stage 2 analyzer: outside-foot plant rule (side_rule / Break heuristic), movement-anchored Release, catch-anchored Hands, not-measured phases out of prompt, export fixes; deployed
- [ ] Rerun 4K30 Slant twice after Stage 1 deploy and compare to 44c52897 — waiting on user deploy

## Runs 39702081 / 59d79766 fixes (approved Oct 21)
- [x] Service: zoom when athlete < 20% of frame height; leading-run recovery on path crop; robust-reference plausibility; rejected_frame_details (tests pass)
- [x] Service: path-fit zoom (min of cap and fit), probe record + retries, athlete-sized recovery crops (RECOVERY_CROP_HEIGHT_MULT=5) for leading frames and a following crop replacing the full-frame fallback
- [ ] Rerun 4K30 Slant clip twice after user deploys service; compare vs 39702081 / a634fbec (blocked: user Cloud Shell deploy)
- [x] Analyzer: missed/rejected/(0,0)/score-0 points excluded from smoothing; no fabricated points; dedicated 3-frame smoothing window (constant, independent of metric measurement windows) recorded in export; symmetric window at gaps; deployed
- [ ] Deploy service from Cloud Shell — waiting on user

## Grounded coaching feedback (approved Oct 21)
- [x] Metric descriptions + run context in prompt; system instructions get placeholders filled; Slant WR prompt v9 with evidence rules incl. no level-of-play comparisons
- [x] Admin-only replay (admin-replay-feedback → analyzer replay mode, nothing saved)
- [x] Replays of 3e01efe2 checked automatically (see feedback_check)
- [x] Post-check (level-of-play words always; other players on solo reps; 150 words), one named retry, data-only fallback; recorded as feedback_check in diagnostics
- [ ] Add example response to Slant system instructions — waiting on user approval of the wording
