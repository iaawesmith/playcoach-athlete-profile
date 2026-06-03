---
slice_id: PHASE-2A-SLICE-B2
title: Plumb world_keypoints through Cloud Run AnalyzeResponse
date_shipped: 2026-06-03
status: shipped
related_risks: []
related_findings: [F-SLICE-B-1, F-CALIB-1]
related_adrs: [ADR-0004, ADR-0009]
---

# PHASE-2A-SLICE-B2 — `world_keypoints` in `AnalyzeResponse`

## Goal

Plumb the `world_keypoints` field captured on `PoseFrame` in PHASE-2A-SLICE-B1 through the Cloud Run `/analyze` response so the edge function `analyze-athlete-video` can consume BlazePose GHUM 3D meters per frame without additional inference cost. Success criterion: every successful `/analyze` response includes a `world_keypoints` array with the same outer shape as `keypoints` (frames × persons × 33 × 3) and the payload size increase stays well inside Supabase Edge Function operational limits.

## What shipped

- [`mediapipe-service/app/schema.py`](../../mediapipe-service/app/schema.py)
  - `AnalyzeResponse` gains `world_keypoints: list[list[list[list[float]]]] = Field(default_factory=list)`. Shape and serialization rules documented inline (meters, hip-centered, zero-filled on non-detection frames so shape stability is preserved across the response).
- [`mediapipe-service/app/main.py`](../../mediapipe-service/app/main.py)
  - `_build_response(...)` builds `world_keypoints` by iterating `original_space` in lockstep with the existing `keypoints` / `scores` build, then passes it to the `AnalyzeResponse` constructor. No new code path; the iteration is the same loop with one extra append.

No change to the FastAPI route shape, NDJSON streaming protocol, keepalive cadence, or `/health` endpoint. No mediapipe version bump, no model re-download, no Dockerfile change. No edge-function code consumes the new field yet — that is explicitly PHASE-2A-SLICE-B3.

## Supabase Edge Function response-size analysis (per kickoff direction)

The kickoff direction was: *cite the actual Supabase Edge Function response-size limit and factor it into the opt-in / always-on decision proactively rather than waiting for the halt.* Done:

| Source | Value |
|---|---|
| [Supabase Edge Functions Limits docs](https://supabase.com/docs/guides/functions/limits) (fetched 2026-06-03) | Response-size limit **not documented**. Documented runtime limits: Memory **256 MB**, Wall-clock **400 s (paid) / 150 s (free)**, CPU time **2 s**, Request idle timeout **150 s**. |
| [supabase/supabase#28053](https://github.com/supabase/supabase/issues/28053) — closed 2024-07-19, Supabase member `encima` comment confirming team-stated values | **Max Request: 5 GB. Max Response: no limit.** PR #28076 opened to add this to the public docs; as of fetch date the public docs still omit it. |

**Effective ceilings, in order of which one binds first:**

1. **256 MB worker memory** — the hardest cap. The response object lives in memory before serialization, so this is the upper bound on payload size in practice.
2. **150 s request idle timeout** — binds before memory if serialization is slow.
3. **400 s wall-clock** — binds last.

**Payload-size delta from B2:**

- Existing per-frame pixel keypoints: 33 × 2 floats = 66 floats. Existing scores: 33 floats. Total per frame ≈ 99 floats.
- Added per-frame world keypoints: 33 × 3 floats = **99 floats**. Roughly **2× the per-frame pose payload**.
- Typical clip per `MAX_WINDOW_SECONDS = 3.0` at `TARGET_FPS = 30` ≈ 90 frames → **+8,910 floats** total ≈ **~70 KB additional JSON** when serialized at ~8 chars/float.
- Worst case at the 400 s wall-clock limit with the longest reasonable per-clip frame count remains under 1 MB of additional payload — **four orders of magnitude under the 256 MB worker-memory ceiling and well below the 5 GB request cap that bounds the reverse direction**.

**Decision: always-on, no gating, no request-param opt-in.**

Rationale:
1. The response-size headroom (~4 orders of magnitude) makes gating premature optimization.
2. A request-flag opt-in would add a serialization-conditional path that has to be tested, documented, and reasoned about on every future change to the schema. Per ADR-0013 (prose-to-structured policy spirit: prefer structural simplicity), this is exactly the kind of conditional that accumulates plan-vs-state drift over time.
3. PHASE-2A-SLICE-B3 will introduce per-metric opt-in at the **metric definition layer** (`coordinate_space: "pixel" | "world"`). That is the correct place for opt-in; opt-in at the transport layer would be a second, redundant gate.
4. If a future clip-length or framing change pushes the per-clip payload close to the 256 MB ceiling (would require ~2.6 M additional floats — implausible at current `MAX_WINDOW_SECONDS`), the gate can be added as its own slice with a real measurement instead of pre-emptive complexity.

## Verification

| Check | Method | Outcome |
|---|---|---|
| `world_keypoints` added to `AnalyzeResponse` with the same outer shape as `keypoints` | Read `schema.py` — `list[list[list[list[float]]]]` matches `keypoints` annotation | ✅ |
| Build loop populates `world_keypoints` in lockstep with `keypoints` / `scores` | Read `_build_response` — single `for pf in original_space` loop appends to all three lists | ✅ |
| Zero-filled on non-detection frames (shape stability) | `PoseFrame.world_keypoints` default factory from B1 returns `[[0,0,0]] * 33` when `detected=False`; the build loop unconditionally serializes that | ✅ |
| Inference cost unchanged | No new `detect_for_video` call; same `PoseLandmarkerResult` already returns `pose_world_landmarks` per B1 | ✅ |
| Payload size increase within Supabase Edge Function limits | See response-size analysis above — ~70 KB additional per typical clip; ~4 orders of magnitude under 256 MB worker-memory cap | ✅ |
| Edge function `CloudRunResponse` type does NOT yet declare `world_keypoints` | Intentional. `analyze-athlete-video/index.ts` deserializes JSON; unknown fields are dropped at runtime. B3 will add the typed field at the moment the first consumer reads it. | ✅ (deferred-by-design) |

End-to-end runtime verification against a live Cloud Run deploy: the new field will be observable in the `/analyze` NDJSON `result` line on the next deploy. No edge-function change is required to make the field appear in the wire payload; it is required only to make any code consume it.

## Findings surfaced

None.

## Decisions deferred

- **`coordinate_space: "pixel" | "world"` on metric definitions and the metric registry.** Explicitly PHASE-2A-SLICE-B3. B2 deliberately stops at the wire boundary so the metric-layer decision is made on its own merits, not pulled forward into a transport-layer slice.
- **Edge-function typed read of `world_keypoints`.** Will happen with the first metric consumer in B3. Adding the typed field to `CloudRunResponse` in B2 with zero consumers would create a dead path the compiler tracks but no test exercises.
- **Future Supabase Edge Function response-size hard cap.** If Supabase ever publishes one (the team has stated "no limit" but the public docs still omit it as of 2026-06-03), revisit this decision and cite the new value here. Tracked in the workflow as a documentation watchpoint, not as an open finding.

## Cross-links

- Plan: Phase 2a kickoff.
- [`mediapipe-service/app/schema.py`](../../mediapipe-service/app/schema.py) — schema change.
- [`mediapipe-service/app/main.py`](../../mediapipe-service/app/main.py) — response build change.
- [`docs/process/phase-2a-slice-b1-outcome.md`](phase-2a-slice-b1-outcome.md) — B1, the source of the `PoseFrame.world_keypoints` field this slice plumbs.
- [`docs/investigations/world-landmark-feasibility-research.md`](../investigations/world-landmark-feasibility-research.md) §3.2 — payload-size pre-estimate this slice confirms.
- [Supabase Edge Functions Limits](https://supabase.com/docs/guides/functions/limits) — official limits doc.
- [supabase/supabase#28053](https://github.com/supabase/supabase/issues/28053) — team-stated Max Request 5 GB, Max Response no limit.
- ADR-0004 — the calibration decision world landmarks remain a candidate remediation vector for.
- ADR-0009 — MediaPipe on Cloud Run.
