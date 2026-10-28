# Roadmap

## Full-clip analysis + event-anchored phases (approved Oct 23)
- [x] Pose service: 300-frame cap, streaming frames at full resolution (no memory increase), decode fields; tests pass
- [x] Analyzer: snap/break/catch detection, event-anchored phases, event_not_detected skips, Analysis Log decode + events
- [ ] Deploy pose service from Cloud Shell — waiting on user
- [ ] Deploy analyzer, then fresh runs: Post – Behind WR, Slant Indoor (per-metric before/after), Go — after user deploy
- [ ] Replace stored baseline fba7237f… — waiting on user approval

- [x] Post-cleanup: three Slant admin notes corrected; percentage ratio prompt/log, actual velocity span (15 frames; minimum 3 elapsed) verified on stored run; static Reference scale retained/reachable and resolution-scaled (80→160 at 4K), analyzer deployed. fba7237f… matches/94, 176 tests/build OK; live read-only replay 134 words passes after retry. Stopped.

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
- [x] Add approved Slant example, extend solo bans, revise second-person fallback and Hip Stability wording; replay 3e01efe2 five times and report counts.

## Target direction (approved Oct 22)
- [x] target_direction (target/at_most/at_least) scoring + direction wording (within the limit / met the target / on target within 25% tolerance) in prompt, fallback, Analysis Log, results; editor dropdown
- [x] Slant v10 directions; high-level/top-level/next-level banned; 1f7c3450 rescored 91→93 and replayed

## Configurable coaching model (approved Oct 22)
- [x] Workspace default (seeded with pinned dated snapshot of current model) + per-node override; Anthropic direct + built-in AI providers
- [x] Record provider/requested/reported model, tokens, ms on every run (log + export)
- [x] Prompts always use "Athlete"; real first name inserted after generation and check (production + replays)
- [x] Comparison replay (N per model × result IDs) with cost estimate + confirm; disabled without a secret until admin login (F-SEC-1)
- [x] Data-handling/retention report per provider
- [ ] Run comparison — blocked: waiting for second route to be filmed and user go-ahead

## Phase display + Speed into the break (approved Oct 22)
- [x] Admin views show every phase with "Not measured" reason; athlete-facing filter helper (no athlete results screen exists yet)
- [x] Slant v11: Speed into the break (pre-Break end window, per-frame calibrated speeds), weights 50/20/15/15
- [x] Rescore bcf95d35 from stored data

## Pose overlay player (approved Oct 22)
- [x] Admin overlay player in Testing Panel: stored keypoints, confidence colors, metric highlights, hip trail, follow view + minimap, phase timeline
- [x] First-frame-timestamp sync; verify left knee (25) on frame 46 of bcf95d35
- [x] One-time signed link refresh on playback error, resume at current frame
- [x] Per-frame px/yd and athlete height readout

## Videos tab narrowing
- [x] Videos tab: teach-tape only, hide angle/type, copy fixes
- [x] Readiness: Reference video is a warning; Set Live needs no video
- [x] Answer: is athlete height required on every upload path; scale when missing
- [x] Make athlete height required on every upload path; Reference Calibration a warning
- [x] Required height (48–90 in) in Testing Panel + library clips + edge validation
- [x] Analyzer: no real scale -> skip distance-unit metrics with no_scale
- [x] Readiness: Reference Calibration becomes a warning
- [x] Testing Panel: athlete height always visible, outside Analysis Context

## c6fa0895 follow-ups (approved Oct 22)
- [x] Speed into the break: peak only before Break (end_before_phase_id), tolerance 0.05 (Slant v12)
- [x] "Perfect" allowed about the score; test with c6fa0895 rejected retry
- [x] Word budget: instruct 120–140, reject above 160
- [x] analyzer_build from deploy stamp; cloud_run_revision from service response
- [x] Library ground-truth distance check (lowest-hip break anchor) in Analysis Log + export
- [x] Frame-source seam flags in export + overlay
- [x] Clip 932b91df expected source → height_based
- [x] Deploy analyzer + clips function; rescore c6fa0895 and report

## Behind WR camera angle
- [x] Add "Behind WR" to library clip form + Run Analysis context; check DB constraint; report readiness impact before applying any Reference-tab change; list "Other" records (no remap)
- [x] Reference tab per-angle list: leave Behind WR unchanged, as requested.

## Node simplification (approved Oct 23, one batch at a time, user OK between batches; hide fields, never wipe data; reproducible semantic baseline replaces historical 718c917a… by user approval)
- [x] Batch 0 Measurement windows: fixed per-type constants, read-only display, fingerprint unchanged
- [x] Batch 1 Camera: hidden FPS/resolution/auto-reject settings preserved; active-only body parts; distance-only readiness; Slant WR filming instructions updated with original archived. All 147 tests pass; current analyzer rescore matches baseline 718c917a66f44a5edb40fde67c80ccf704f9a0ebc22a7d916541adaf6e55688e, aggregate 94. Real Slant Reference page verified. Stopped for Batch 2 approval.
- [x] Batch 2 source: hide Pipeline Setup / checkpoints, preserve retired saved values, proportional readiness, three-key analyzer request, every-frame service loop; 149 app tests + 19 service tests pass.
- [x] Batch 2 fresh run on deployed 4b79473 / mediapipe-service-00021-dzs: 90 detections, aa28d25d… unchanged, leading recovery 0–22 and following crop 77–89 unchanged, aggregate 94; stored c6fa0895 rescore values unchanged, aggregate 94.
- [x] Batch 2 equivalence accepted by user: pre-Batch-2 7712968 and current code have byte-identical metrics and aggregate 94. Historical hash retired; save and verify semantic comparison in scripts/fingerprint-rescore.ts.
- [ ] Batch 2 overlay end-to-end — actual bcf95d35 stored skeleton/panel/timeline loaded directly; blocked: history returns no rows and original video fails sandbox Chromium playback after fresh link (media error 4). No simulated history or video substitution. Batch 3 separately approved by user.
- [x] Establish c6fa0895 semantic baseline (4-decimal values/scores/statuses/aggregate, sorted keys, no diagnostics) and document in AGENTS.md: fba7237f605f41960d27375977057819623d820906c28a57c148cce25fc72b21; pre-Batch-2 and current both match, aggregate 94.
- [x] Batch 3: hide Depends On and Body Groups, unrestricted landmark picker, single Side adapter, admin notes preserved; baseline unchanged on identical stored input and fresh read, aggregate 94; 160 tests pass; actual Slant draft Side interactions checked and cancelled without node writes. Stopped after Batch 3; later batches await approval.
- [x] Batch 4 Phases: all five current Slant cues/descriptions archived and read-back verified before hiding; unused phase-context and migration presentation removed; structural controls/buffers and stored legacy fields preserved. Identical-input and fresh-read fba7237f… baseline PASS, aggregate 94; 160 tests pass, actual Slant draft verified without node save. Stopped after Batch 4.
- [x] Batch 5 Errors: severity hidden/preserved, three dead Slant WR rules removed, plant error renamed with unchanged <125 condition. Read-only c6fa0895 before/after errors and fba7237f… fingerprint PASS (94); only Slow release triggers; 162 tests and real editor verification pass. Stopped after Batch 5.
- [x] Wheel WR: exact Drifting to the sideline wording archived and read-back verified before removal; other rules/metrics/version preserved.
- [x] Batch 6 Reference: camera-angle + px/yd controls, legacy metadata/fallback settings hidden and preserved, filming guidance retained; fba7237f… unchanged (94), identical before/after errors; 165 tests and real Slant/Wheel browser checks pass. Stopped after Batch 6.
- [x] Batch 7 Scoring and fixes: hidden/preserved bands/rules/llm_max_words, fixed 500-token cap on both providers, Max skipped metrics % label, zero confidence blocked. Identical-input/fresh-read fba7237f… PASS (94), 170 tests, real editor verification, deployed read-only replay 131 words passes 160-word guard. Stopped after Batch 7.
- [x] Batch 8a only: audited dead pose items removed, live names renamed with stored log/config/checklist aliases preserved; fba7237f… PASS, fresh 932b91df aa28d25d…/90 frames/94 and recovery ranges unchanged; bcf95d35 skeleton/panel/timeline loaded (existing Chromium video error 4 remains). 171 tests, build OK; analyzer/health deployed, pose service untouched. Stopped after 8a.
- [x] Batch 8b: nine short code-verified guide pages (eight tabs + new-route checklist), original node knowledge in read-only Archive; real Slant 103 archived pages/cues preserved, entire node unchanged; desktop/mobile and Run Analysis help verified, 171 tests/build OK, fba7237f… matches (94). No scoring/service/node writes. Stopped after 8b.
- [x] Event detection fixes: acceleration snap fallback, clip-relative break fallback (body-size depth when scale is flat), chest-height converging-reach catch. Stored-data: In 98 and Slant 94 unchanged, fba7237f… PASS; 192 tests.
- [ ] Event detection fresh runs reported; Go determinism follow-up (only one stored Go - Sideline run exists to compare).
