# Full-clip analysis + event-anchored phases

Scoring math, metric definitions, node configs, badges and the Reference tab stay unchanged. Only two things change: how much of the clip gets analyzed, and where the phase windows fall.

## Decisions needed before building

1. **Pose service redeploy (Cloud Shell).** The 3 s limit is enforced in two places: in the analyzer pre-flight and in the pose service (`MAX_WINDOW_SECONDS = 3.0`). The pose service has to change and be redeployed. You said you deploy it from Cloud Shell, so I will hand you the exact diff and command and wait for your deploy before any fresh run.
2. **Memory at 4K.** The risk register (F-INFRA-1) says 4K frame buffers are held twice per request. 90 frames of 4K already cost about 2.2 GB. 300 frames would cost about 7.5 GB, which is above the current Cloud Run limit. My proposal: decode at full resolution but stream frames, keeping only the frames that framing and recovery need, with a size limit on recovery crops. The fallback is to raise service memory. I will not change the resolution the model sees, because that would change keypoints.
3. **Baseline fingerprint moves on purpose.** Moving the phase windows changes metric values, including on SLANT INDOOR 3.0S. fba7237f… compares stored data and will still match for the old run. For the fresh-run comparison, I will report the before and after aggregate and each metric's value, then ask you to approve the new baseline. I will not overwrite the old one silently.

## 1. Remove the 3-second cap

- Analyzer pre-flight: remove the 3 s check and the "3-second clips are currently supported" text. Run Analysis stops clamping CLIP END SECONDS to 3. By default it uses the full stored clip duration.
- Pose service: replace the seconds limit with `MAX_DECODED_FRAMES = 300` (10 s at 30 fps). Decoding stops at 300 frames, and the response reports `frame_cap`, `frame_cap_reached`, `frames_decoded`, `achieved_fps` and `clip_duration_s`.
- Determinism is unchanged. Each request still gets a fresh VIDEO-mode engine, timestamps still start at 0, frames are still sampled on the same fixed 30 fps clock, and the same input always gives the same frames.
- Analysis Log: a new "Decode" line, for example "Frame cap 300 (10.0 s @ 30 fps) · decoded 240 · achieved 30.0 fps · clip 8.00 s · cap not reached".

## 2. Event-anchored phases

All of this is new pure code in `segmentation.ts`, with tests in `src/test/segmentation.test.ts`:

- **Snap:** uses the existing release anchor (first sustained hip movement).
- **Break:** the first frame after the snap where the hip-path heading turns by at least a set angle and holds that turn for N frames. It is found on smoothed, calibrated hip centers. Confidence comes from turn size, hip keypoint confidence and coverage. If the athlete never turns, or confidence is low, it is marked not detected.
- **Catch:** the existing wrist-peak search, but run only after the break (or after the snap on routes that have no break phase). It also requires both hands to rise toward each other, so a mid-stride arm swing on the last frame no longer counts as a catch.
- **Mapping events to phases:** each phase starts or ends at the event its name points to (Release starts at the snap; Stem runs from snap to break; Break is around the break frame, using the phase's existing Frame Buffer; Catch Window is around the catch; YAC runs from the catch to the clip end). A phase with no event-named boundary keeps its existing proportional share of the frames between its neighbouring events. I add a mapping only inside the analyzer. Node configs are not edited.
- **Event not detected:** every phase that depends on that event is marked not measurable this run, and its metrics are skipped with the reason `event_not_detected:<break|catch|snap>`. The existing skip-and-renormalize rule with the 50% ceiling handles the score. No metric is scored from an assumed window.
- **Analysis Log:** a detected-events row (frame, time and confidence, or "not detected" with the reason) shown beside the phase windows. The windows are also saved in diagnostics, so the overlay player shows them unchanged.

## Verification and report

- All tests pass, plus new tests for break detection (straight-line run: none detected; slant cut: detected), catch rejection on a mid-stride last frame, and dependent-metric skipping.
- After you deploy the pose service, I run fresh runs and report back:
  - the frame cap
  - the detected events on POST - BEHIND WR, with Break Angle before (176.96°) and after
  - the detected events on SLANT - INDOOR DIAGONAL - 4K30 - 3.0S, with its aggregate before (94) and after, and each metric's value
  - GO - BEHIND WR, to confirm frame 89 is no longer labeled Catch Window
- Run the stored-data fingerprint fba7237f… to confirm the old run still rescores identically.
- Document the change in AGENTS.md (one line), docs/process and roadmap.md.

## Technical details

- Files: `mediapipe-service/app/{main.py,video.py,schema.py}`, `analyze-athlete-video/{index.ts,segmentation.ts}`, `TestingPanel.tsx`, `analysisLogReporting.ts`, `AnalysisLog.tsx`, `src/test/segmentation.test.ts`, and a new `mediapipe-service/tests` test for the frame cap.
- Break heading is the angle between the hip displacement vectors over the K frames before and after each frame. Thresholds are analyzer constants, recorded in diagnostics.
