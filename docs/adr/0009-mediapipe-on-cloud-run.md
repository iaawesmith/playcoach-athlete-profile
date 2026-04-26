---
id: ADR-0009
title: MediaPipe pose pipeline runs on Cloud Run (not in-browser, not in edge function)
status: accepted
date: 2026-04-26
deciders: workspace
related_risks: []
related_findings: [F-SLICE-E-2]
supersedes: []
superseded_by: []
---

# ADR-0009 — MediaPipe on Cloud Run

## Context

Athlete Lab needs MediaPipe pose estimation on uploaded video clips. Three execution venues were possible:

1. **In-browser via MediaPipe.js** — runs on the athlete's device. Zero server cost. But: model download is heavy (~10-20 MB), inference is slow on phones, output cannot be re-verified server-side, and the analysis pipeline (Claude scoring, calibration audit, persisted results) needs server access anyway.
2. **Inside a Supabase edge function (Deno)** — would keep the analysis pipeline single-process. But: edge functions have CPU/memory limits, no GPU, no native MediaPipe binding, and cold-start times incompatible with multi-second video processing.
3. **Dedicated MediaPipe service on Google Cloud Run** — Python service with the official MediaPipe pose model, invoked via HTTP from the edge function. GPU-optional, scales to zero, predictable URL.

## Decision

Run MediaPipe on a **dedicated Cloud Run service** (`mediapipe-service/` in this repo). The Supabase edge function `analyze-athlete-video` calls the Cloud Run `/analyze` endpoint with a signed video URL and analysis context, receives pose+keypoint data, and proceeds with downstream calibration / scoring / Claude-prompt construction.

The Cloud Run service is the **only** producer of pose data. Browser-side MediaPipe is not used; edge-function-side MediaPipe is not attempted.

## Consequences

- **Positive:** server-authoritative pose output — same input video produces verifiable output.
- **Positive:** model and Python deps live in `mediapipe-service/`, isolated from the Vite/React app and from the Deno edge functions.
- **Positive:** scales to zero cost when idle.
- **Negative:** introduces a third runtime (browser, edge function, Cloud Run service) with its own deployment story.
- **Negative:** F-SLICE-E-2 noise floor (~0.78% drift on `body_based_ppy`) is suspected to originate in this service — possibly cold-start vs warm-start divergence, possibly GPU vs CPU model fallback. The decision to run on Cloud Run does not cause the drift but the multi-replica nature makes the drift mode harder to characterize.

## Cross-links

- F-SLICE-E-2 — drift originating (suspected) in this service.
- `docs/architecture/mediapipe-capability-inventory.md` — capabilities of the deployed service.
- `mediapipe-service/` directory — service source.
- Edge function `supabase/functions/analyze-athlete-video/` — caller.
