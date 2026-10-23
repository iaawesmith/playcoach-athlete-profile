# Full-clip analysis + event-anchored phases (Oct 23)

## Changes
- Pose service: the 3 s window limit is replaced by a 300-frame cap (10 s at 30 fps). Frames are streamed by `frame_source.py`, which keeps a cache of at most 14 frames and replays the old eager decoder's exact seek/read sequence from a fresh capture. The full resolution goes to the model. Auto-zoom crops are applied lazily (`MappedFrames`). The response adds `frame_cap`, `frame_cap_reached`, `frames_requested`, `frames_decoded`, `achieved_fps`, `source_fps`, `clip_duration_s` and `decode_reopens`.
- Analyzer: the "Launch clip cap" preflight check is removed. A clip longer than the node maximum is now a WARN instead of a FAIL. Phases are anchored to three detected events (`segmentation.ts`):
  - **snap:** the release anchor.
  - **break:** the sharpest sustained ground-plane direction change before the first hands-up moment. Lateral position is x divided by the per-frame scale; depth is focal divided by the per-frame scale, with an assumed horizontal field of view of about 70 degrees.
  - **catch:** both wrists above the shoulder line and within 1.5 shoulder widths, for at least 2 frames.

  Phases bounded by an undetected event get no window, and their metrics are skipped with the reason `event_not_detected:<event>`.
- Analysis Log: adds a Decode line and a Detected Events column beside the phase windows.
- `scripts/fingerprint-rescore.ts --anchor-events` previews the event-anchored windows on stored data. The default path is unchanged, and fba7237f… still matches on c6fa0895.

## Stored-data preview (3 s runs, before the pose-service deploy)
| Clip | Snap | Break | Catch | Aggregate (anchored) |
|---|---|---|---|---|
| Slant – Indoor Diagonal 3.0s (c6fa0895) | 10 | 44 (peak 101°) | 85 | 94 (Plant Leg 139.61 → 138.89, others identical) |
| Slant – Behind WR | 22 | 56 | not in window | 58 |
| In / Out | 15 / 23 | 51 / 62 | — / not in window | 45 / 39 |
| Post / Go / Curl / Corner / Comeback | — | none in the first 3 s (straight line) | none | dependent metrics skipped |

## Pending
- User deploys the pose service from Cloud Shell; analyzer deploy follows.
- Run fresh library runs: Post – Behind WR (events), Slant Indoor (before/after per metric), Go (catch frame).
- The user approves the new baseline before it replaces fba7237f….
