---
id: F-INFRA-1
title: 4K frame buffers held twice per request dominate service memory; OOM risk scales with Cloud Run concurrency
status: open
severity: Sev-1
origin_slice: PHASE-2A
origin_doc: docs/process/phase-2a-clip-trim-commands.md
related_adrs: [ADR-0009]
related_entries: [F-POSE-1]
opened: 2026-08-24
last_updated: 2026-08-24
---

# F-INFRA-1 — 4K frame buffers held twice per request dominate service memory

- **Severity:** Sev-1 — an OOM kill mid-analysis surfaces to the athlete as a
  failed or hung upload, and the risk is already live at any concurrency above 1.
- **Pre-existing.** Not introduced by Phase 2a. Surfaced while scoping the memory
  ceiling for the per-request-landmarker fix to F-POSE-1.

## Mechanism

`video.decode_window` accumulates decoded frames into a Python list
(`frames.append(frame)`) and returns it whole — no generator, no streaming. Then
`auto_zoom.decide_and_apply` builds a **second** full list: for each frame it
crops and `cv2.resize`s **back to the original (W, H)**, so the processed list is
the same per-frame footprint as the input list. Both are simultaneously live in
`main._build_response` from the auto-zoom call through `reverse_map_landmarks`.

At the numbers this pipeline actually runs:

| Quantity | Value |
|---|---|
| Frame footprint, 3840×2160 BGR uint8 | 3840 × 2160 × 3 = 24,883,200 B ≈ 23.7 MiB |
| Frames per request | `MAX_WINDOW_SECONDS` 3.0 × `TARGET_FPS` 30 = 90 |
| `frames` list | ≈ 2.09 GiB |
| `processed_frames` list (resized back to full res) | ≈ 2.09 GiB |
| **Peak, both live** | **≈ 4.2 GiB per request** |

Against that, the per-request landmarker the F-POSE-1 fix adds is
`pose_landmarker_full.task` at 9,398,198 B ≈ **8.96 MiB** of model weights plus
graph overhead — order tens of MiB. **The landmarker is ~1% of the per-request
footprint.** Any memory objection to option (ii) is aimed at the wrong term.

## Why concurrency is the live hazard

`Dockerfile:35` runs `uvicorn --workers 1`, so there is one process. But Cloud Run
container concurrency is a **service-level setting that lives outside this repo** —
no `service.yaml`, no `gcloud run deploy` invocation, and no `cloudbuild` config is
version-controlled here. If it is at Cloud Run's default of 80, the theoretical
peak is 80 × 4.2 GiB. It plainly is not surviving that, which means either
concurrency is already pinned low or requests are not in fact overlapping in
practice — and **we cannot tell which from the repo.** That unknown is itself the
finding.

## Required before the F-POSE-1 fix ships

1. Read the deployed service's `--memory` and `--concurrency` from Cloud Run and
   record them in `ADR-0009`, so they stop being invisible.
2. Pin `--concurrency` explicitly. A low value is independently desirable: it
   removes the *interleaving* half of F-POSE-1 even before the code fix, though it
   does **not** remove sequential state leakage between successive requests.
3. Consider decoding to a generator, or not resizing crops back to full
   resolution, as separate follow-ups. Both are larger than the F-POSE-1 fix and
   should not be bundled into it — each changes the pixels the model sees and
   therefore resets the `calibration_audit` baseline a second time.

## Consequences

- The memory ceiling is set by the frame buffers, not the model, so option (ii)
  for F-POSE-1 is memory-safe relative to what the service already does.
- Cloud Run runtime configuration is not captured in version control, so a
  concurrency or memory change can silently alter determinism and failure
  behavior with no diff to review.
