# Videos tab audit and narrowing

## Audit: what reads Videos tab fields

Each video has six fields: URL, label, start/end seconds, camera angle, type (educational / analysis / both) and the Reference flag. Slant has one: "ROUTE RUNNING TEACH TAPE - SLANT" (YouTube, 6–11s, sideline, educational, Reference).

| Reader | Fields read | Affects scoring or frame selection? |
|---|---|---|
| Analyzer | None. It never loads the videos list from the node. | No |
| Pose service | None. It gets the athlete upload's own clip window, not the node's video timestamps. | No |
| Analyzer calibration | Uses the upload's camera angle to choose a saved Reference calibration, not the video's angle. Height-based per-run scale is the main source. | No (video fields aren't involved) |
| Go-live check (Set Live) | Blocks unless at least 1 video has a URL. | No, but it blocks going live |
| Readiness bar, "Videos & Reference" (15%) | Video count, all videos have timestamps, Reference flagged | No, but these lower the score and Set Live needs 100% |
| Readiness bar, "Reference Calibration" (5%) | Video camera angles: each angle needs a calibration | No, but it lowers the score |
| Basics tab, Training Status checklist | At least 1 video, Reference flagged, all videos have timestamps | No (display only) |
| Node export (copy as text) | All fields | No |
| Testing Panel, run history, overlay player | None | No |
| Athlete-facing views | None. No athlete results screen shows the reference video yet. | No |

Conclusion: nothing in the pipeline uses the node's video timestamps, camera angle or type. They only feed readiness checks and copy. The Reference flag is the only field with a future athlete-facing purpose.

## Proposed changes

1. **Tab purpose: athlete teach tape.** Keep the video URL, label and Reference flag. Keep start/end as an optional "Play from / to" window for the athlete's view, labeled as display only.
2. **Hide the frame-selection fields:** camera angle, type, and the Camera Coverage block. Existing values stay saved on the node, just not shown or edited.
3. **Readiness and go-live:**
   - Set Live no longer requires a video.
   - "Reference video flagged" becomes a warning: it doesn't lower the score or block Set Live.
   - Remove "All videos have timestamps" and the video-count check.
   - The Reference Calibration check stops reading video angles. It keeps the existing "at least one calibration" check, also as a warning.
   - Same rules in the readiness bar and the Basics checklist.
4. **Copy fixes:**
   - New tab description: "The teach tape athletes see next to their results. Add a clip of the route done well and flag one as the Reference. These videos are not analyzed and don't affect scoring."
   - Remove "rtmlib" from the Reference tooltip.
   - Remove the line "Each camera angle needs its own Reference calibration for Distance and Velocity metrics."
   - Rewrite the Videos tooltip and empty state. The empty state currently says "for the AI to compare athlete footage against", which isn't true.
   - Readiness category becomes "Reference video" with the tooltip "Shown to athletes as the model rep. Optional; doesn't affect analysis." This replaces the timestamp tooltip.
   - Node export lists only the label, URL, play window and Reference flag.
5. **Unchanged:** scoring, the analyzer, the pose service, node data, Slant's saved video.

## Open question

Should the readiness bar also stop counting calibration toward the score? Per-run height scale is now the main source, so a missing saved calibration is closer to a warning. As written, the plan makes it a warning.

## Technical details

- Files: `NodeEditor.tsx` (tab subtitle, form fields, Camera Coverage, `checkCompleteness`, Training Status readiness), `NodeReadinessBar.tsx` (Videos and Reference Calibration categories, using the existing `warning` flag that `computeScore` already ignores), `nodeExport.ts`.
- No changes to the database, types or saved data. The `EliteVideo` fields stay optional.
- Add a test that a node without a Reference video still reaches a 100% readiness score, and that timestamps or angles no longer change it.
