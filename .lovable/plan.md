# Pose service: crop that covers the path, and a following crop for lost frames

Reference runs a634fbec / 6733a304 (service 370f40c, revision 00019, zoom 1.75x, crop x 490-2684, y 644-1878). Comparison: unzoomed run 39702081 (same clip).

## Diagnosis

### 1. Why the crop used the 1.75x cap

The rule is already "fit, then cap": `path_crop` computes the zoom that fits the combined box plus margin, then takes `min(1.75, fit)`. The cap only wins when the combined box is small. So the box was too small, not too large: the probes didn't see the end of the route.

Probe frames (8 samples, IMAGE mode, full 4K frame): 0, 11, 22, 34, 45, 56, 68, 79.

```text
probe   hips in 39702081 (truth)   what the crop implies
0       (no detection)             seen      ~1008
11      (no detection)             seen      ~1016
22      (no detection)             seen      ~1166
34      1481                       seen
45      1833                       seen
56      2194                       seen
68      2663                       NOT seen  (crop edge 2684 = hip at 68)
79      3124                       NOT seen
end     3518 (frame 89)            never sampled
```

The crop centre (x 1587) and width (2194) match a combined box that runs from about x 950 to 2260, which is probes 0-56 only. That box needs about 2.3x to fit, so the 1.75x cap applied. Probes 68 and 79 probably missed because the athlete is ~230-256 px tall (8.5%) and IMAGE mode on the full 4K frame misses a figure that small. This is the same failure we saw in leading-frame recovery.

Unconfirmed: probe results aren't recorded anywhere, so this is inferred from the crop geometry. The first build step adds a record of the probes, and the rerun confirms or corrects this.

Two more gaps:
- No probe falls after frame 79, so even perfect probes would miss frames 80-89 (hips 3124 to 3518).
- Correct fit for the true path, hips 1008 to 3518 (2510 px):
  - plus one body height (~256 px) on each side: about 1.27x
  - with the current margin (15% of path width = 377 px per side): about 1.12x, which is just above the 1.1x "not worth it" floor

  So the margin rule decides whether we zoom at all on long routes.

### 2. Why frames 70-89 weren't recovered

They did trigger the fallback. `fallback_full_frame` targets every frame that was missed or touched the crop edge, so 66 and 69-89 were all attempted. `zoom_fallback_frame_indices` only lists frames the fallback detected something on:
- 66 and 69 came back as partial bodies and were then rejected (`too_few_visible_landmarks`).
- 70-89 returned nothing on the full 4K frame in IMAGE mode.

The service doesn't record attempted frames separately, which made it look like only 66 and 69 were tried. The real failure is the one you named: re-detecting on the full frame can't find an athlete this small.

## Proposed changes (pose service only)

### A. Probes that see the whole path
- Record every probe in the output (`auto_zoom_probes`): frame, detected, box, hip, height, plus the combined box and the fit and cap factors. You can then see why a given zoom was chosen.
- Add probes at the last frame and the second-to-last frame, so the end of the route is always sampled.
- Re-try missed probes the same way leading-frame recovery does: crop at 1.75x around the position predicted from the neighbouring probes that did detect, using the IMAGE-mode engine, then map the result back.
- If a trailing probe still misses, extend the combined box along the measured path direction to the last frame, using the speed from the detected probes and staying inside the frame. The crop then never ends before the route does.
- Zoom = the smaller of the cap and the fit of the combined box plus margin, with margin = one body height (no longer the larger of 15% of path width and one body height). On this clip that gives about 1.27x.
- If the fit falls below the 1.1x floor, skip the zoom and use the following crop (B) on the unzoomed frames.

### B. Following crop instead of the full-frame fallback
- Replaces the full-frame re-detect. A frame is a target when it was missed, rejected as a partial body, or its box touches the crop edge.
- Frames are processed in time order. For each target:
  - Predict the hip from the last good hips: the average speed over the last 5 good frames, carried forward by the number of frames since the last good one.
  - Crop the same size as the zoom crop (or a 1.75x crop when zoom was skipped), centred on the predicted hip and kept inside the frame.
  - Detect with the separate IMAGE-mode engine (the main VIDEO tracker is never touched) and map the landmarks back to original coordinates.
- A recovered frame becomes the newest "last good" frame only if it passes the same plausibility check as everything else, so a bad recovery can't steer later crops.
- Stop after 10 consecutive misses, so a real exit from the scene isn't chased.
- New outputs: `follow_crop_attempted_indices`, `follow_crop_recovered_indices`, and the crop used per frame. `zoom_fallback_frame_indices` stays and keeps its meaning.

## Tests (no model needed, pure rules in framing.py)

New fixture: the full 90-frame hip and height series from 39702081, `run_39702081_full_series.json`.

1. Path crop: with probe boxes built from this series (including the extension when probes 68 and 79 are missing), the crop contains every detected hip from 0 to 89 plus one body height of margin. The zoom is about 1.27x, not 1.75x.
2. Cap still applies: a short path that fits at more than 1.75x is capped at 1.75x.
3. Following crop: with the 370f40c crop (x 490-2684) and frames 66-89 marked lost, each predicted crop for frames 66-89 contains that frame's true hip from 39702081, chained frame by frame from the last good hips (frames 63-68).
4. Stop rule: after 10 consecutive lost frames with no recovery, no more crops are issued.
5. A recovery that fails plausibility doesn't become the anchor for the next prediction.

## Not changed
Analyzer, node data, weights, status, the 3-second window, the VIDEO-mode main pass, and the existing leading-frame recovery.

## Deploy
After approval and build, the files go on main; you deploy from Cloud Shell. I then rerun the clip twice and compare against 39702081 and a634fbec:
- the probe record
- the zoom factor
- detected frames 66-89
- hip coordinates

## Technical details
- `framing.py`: `fit_factor(union, body_h, w, h)`, `extend_union_to_end(probes, n_frames)`, `predict_hip(last_good, k=5, steps)`, `follow_crop_rect(center, cw, ch, w, h)`, `MAX_FOLLOW_MISSES=10`, `PATH_MARGIN = body height`.
- `auto_zoom.py`: sample indices include `n-1` and `n-2`; missed probes are retried on a predicted crop through the probe engine; `ZoomState.probes` and `fit_factor`.
- `pose.py`: `follow_crop_recover(frames, results, crop_size, w, h)` replaces `fallback_full_frame` in `main.py`. It runs before `reject_partial_detections`, and edge and partial candidates are checked with the same per-frame rules.
- `schema.py`: additive fields only.
