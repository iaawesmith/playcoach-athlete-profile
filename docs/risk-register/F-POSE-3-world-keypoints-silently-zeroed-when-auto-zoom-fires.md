---
id: F-POSE-3
title: world_keypoints silently zeroed when auto-zoom fires (reverse-map omission)
status: open
severity: Sev-2
origin_slice: PHASE-2A
origin_doc: docs/process/phase-2a-slice-b2-outcome.md
related_adrs: [ADR-0005]
related_entries: [F-POSE-1, F-SLICE-E-2]
opened: 2026-08-24
last_updated: 2026-08-24
---

# F-POSE-3 — `world_keypoints` silently zeroed when auto-zoom fires (reverse-map omission)

- **Phase:** PHASE-2A (introduced by SLICE-B1, surfaced during Step 0 inspection)
- **Severity:** Sev-2 — shape-stable zeros are indistinguishable from real data to any future consumer.
- **Status:** Open. Deliberately **not patched**: HEAD is under measurement by the B1/B2 drift band and must not move mid-band. Fix lands after the band closes.

## Mechanism

`auto_zoom.reverse_map_landmarks` reconstructs each `PoseFrame` as:

```python
PoseFrame(detected=True, keypoints=new_kps, scores=pf.scores[:])
```

`world_keypoints` is not carried across. Because `PoseFrame`'s field default is a
zero-filled 33×3 list, every reverse-mapped frame emerges with structurally valid
but all-zero world landmarks. The failure is shape-stable, so nothing downstream
raises.

The condition is `state.applied` being true — i.e. **whenever auto-zoom fires**.
Evidence from the 2026-08-24 read-only query: auto-zoom fired on **15 of 15**
stored runs carrying auto-zoom metadata, always at the `MAX_FACTOR = 1.75` cap.
In practice this means world landmarks are zeroed on essentially every real run,
not on an edge case.

## Correct fix (pass-through only)

`world_keypoints` are BlazePose GHUM landmarks in **metres, hip-centred**. They
are not in pixel space, so the crop scale factors `sx`/`sy` and offsets
`ox`/`oy` must **not** be applied to them. Applying crop geometry to metric
hip-centred coordinates would be actively wrong. The fix is a verbatim
pass-through: `world_keypoints=pf.world_keypoints[:]` (or a deep copy of the
rows) in the reconstructed `PoseFrame`.

## Required regression check (lands with the fix, written now)

A doc entry does not fix invisibility. The fix must land with a check that
**fails when `world_keypoints` are all-zero on a run where auto-zoom fired**.
Asserting non-zero unconditionally is insufficient — a no-detection frame is
legitimately zero — so the check must be conditioned on `auto_zoom_applied` and
on frames where `detected` is true.

## Blocking relationships

- **PHASE-2A-SLICE-B3 is formally blocked on this fix.** B3 is the first real
  `world_keypoints` consumer; consuming zeros would produce plausible-looking
  joint angles derived from nothing.
- Not a drift-band concern: the ratified Option D comparison hashes
  `result_data.calibration_audit` only, and `world_keypoints` appears in no
  compared field (verified 2026-08-24 against the audit object literal in
  `supabase/functions/analyze-athlete-video/index.ts` and against a
  zero-consumer grep). So the zeroing cannot produce a false drift signal.
