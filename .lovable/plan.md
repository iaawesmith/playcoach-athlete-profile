# Pose service: leading-frame loss, ghost detections, filter cascade

Reference runs 39702081 / 59d79766 (service 0dbf5ae, revision 00017-cdz). Pose service only (`mediapipe-service/`). No analyzer, node data, weights, status or 3-second window changes.

## What the runs show (from stored diagnostics)

```text
frame  detected  hip (x, y)    height px
0-17   no        -             -
18     yes       790, 847      383    <- ghost
19     yes       1178, 1274    110    <- partial (half body)
20     yes       1165, 1278    115    <- partial
21     yes       772, 852      398    <- ghost
22-23  no (detector miss)
24-28  rejected height_jump (vs frame 21)
29     yes       902, 833      499    <- ghost
30-45  yes       1365 -> 1833, ~1250   230 -> 185   <- true track
```

Zoom: skipped, "athlete height 184px >= 150px", fill 0.0853. Recovered frames: none.

## 1. Zoom rule: share of frame height

- Replace the 150 px rule with: zoom when median athlete height < 20% of frame height (432 px on 2160). Configurable (`AUTOZOOM_MIN_HEIGHT_FRAC`, default 0.20). The existing path-covering crop and 1.75x cap are unchanged.
- This run (8.5%) would zoom again, as in the previous revision that detected these frames.
- Reason text reports the share, e.g. "athlete 8.5% of frame height < 20%".

## 2. Why frames 0-2 recovery recovered nothing

- It re-ran the same full 4K frame through a fresh engine with a lower threshold (0.3). MediaPipe shrinks the whole frame to a small detector input, so a 184 px athlete in a 3840 px frame becomes a few pixels. The problem is size, not the threshold, so lowering it changes nothing.
- With zoom off, "processed frames" are the originals, so no crop was ever tried.
- It was also capped at frames 0-2; the loss ran 0-17.

Fix: recover the whole leading run of missed frames (from frame 0 until the first accepted detection), on a crop around the athlete's path (probe boxes + margin), with a separate IMAGE-mode engine, mapping landmarks back to original coordinates. Applies whether zoom was on or off. Recovered frames still go through the plausibility check (item 4).

## 3. "Coordinate scale bug": diagnosis does not support it

The brief asks for a path that returns landmarks in resized space without mapping back. The code and data don't show one:
- With zoom off there is no resize anywhere: frames are decoded at 3840x2160, MediaPipe returns 0-1 coordinates, and they are multiplied by that same width/height. Fallback and reverse-mapping only run when zoom is applied (it wasn't).
- If 18/21/29 were scaled to two-thirds, the athlete would also be two-thirds the size (~150 px). Instead they are 1.7-2.2x larger (383-499 px vs ~230), with x and y off by different ratios. That is the tracker locking onto a wrong, larger shape (a ghost), not a coordinate bug.
- Frames 19-20 are a second problem: same position as the true track but only ~110 px tall (half a body).

Proposed fix instead: these are caught by the robust-reference check in item 4 (height and hip position vs the median of nearby good frames). No mapping code changes, because none is wrong. If you have evidence of a resized path I haven't found, I'll trace it before building.

## 4. Plausibility filter: robust reference

Replace "compare to last accepted frame" with a two-pass check:
1. Pass 1: basic checks per frame (clipped at edge, under 60% landmarks visible) as now.
2. Pass 2: for each candidate, reference = median height and median hip of up to 5 nearest candidates on each side (excluding the frame itself). Reject if height differs by more than 40% of reference, or hip is more than half a reference height away.
3. Iterate: rejected frames are removed from the pool and pass 2 reruns until nothing changes, so an invalid frame can never serve as a reference.
4. Need at least 3 neighbours for a reference; otherwise keep the frame and record `insufficient_reference`.

Expected on this run: 18, 21, 29 rejected (ghost); 19, 20 rejected (half body); 24-28 accepted.

## 5. Tests (no model needed)

`mediapipe-service/tests/test_framing.py`, using this run's stored series:
- Frames 18, 21, 29 rejected; 30-45 accepted; 19, 20 rejected.
- Frames 24-28 accepted.
- Zoom gate: 184/2160 zooms; 450/2160 doesn't.
- Leading-run detection: finds 0-17.

Limitation: frames 24-28 were zeroed after rejection before storage, so their real landmarks aren't in the run. The test uses values interpolated between frame 20 and 30 for those five frames, marked as such. To fix this going forward, the service will also return the pre-rejection height/hip per rejected frame (additive field), so next run's real values can replace the interpolated ones.

## Technical details

- `framing.py`: `MIN_ATHLETE_HEIGHT_FRAC`, `needs_zoom(med_h, frame_h)`, `leading_missed_run(results)`, `robust_validate(series)` (pure, iterative).
- `auto_zoom.py`: gate uses the fraction; keep the probe path crop in `ZoomState` even when zoom is skipped, for recovery.
- `pose.py`: `recover_leading_frames` takes the path crop, crops/maps back, no 3-frame cap; `reject_partial_detections` delegates to `robust_validate`.
- `main.py` / `schema.py`: pass crop to recovery; add `rejected_frame_details` (height, hip before rejection).
- After you deploy from Cloud Shell, I rerun the 4K30 Slant clip twice and compare to 39702081.
