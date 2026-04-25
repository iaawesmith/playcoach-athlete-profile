# Phase 1c.2 — Slice D `camera_guidelines` Pre-Flight Result

**Captured:** 2026-04-25 (pre-Slice-A)
**Purpose:** Finding 4 from plan review. Determine whether Slice D's conditional JSON-vs-plain-text branching can collapse to a single column-drop in Slice E.

## Query

```sql
SELECT id, name, camera_guidelines, length(camera_guidelines) AS len,
  CASE
    WHEN camera_guidelines IS NULL OR camera_guidelines = '' THEN 'empty'
    WHEN left(ltrim(camera_guidelines), 1) IN ('{', '[') THEN 'json_shaped'
    ELSE 'plain_text'
  END AS shape
FROM athlete_lab_nodes
ORDER BY name;
```

## Result

| Node | id | length | shape |
|---|---|---|---|
| Slant | `75ed4b18-8a22-440e-9a23-b86204956056` | 1059 | **`json_shaped`** |

**Total nodes:** 1 (Slant only)

## Decision

**The branch cannot be eliminated.** All existing nodes (Slant, n=1) store `camera_guidelines` as a JSON object containing both metadata fields and a nested `camera_filming_instructions` text body.

Slice D's JSON-strip path is **required as planned**. Specifically, the JSON object includes:

- Metadata to **strip** (per Slice D scope): `camera_min_fps`, `camera_min_resolution`, `camera_min_distance`, `camera_max_distance`, `auto_reject_athlete_too_small`, `auto_reject_athlete_too_small_threshold`, `auto_reject_duration_out_of_range`, `auto_reject_resolution_below_min`, `auto_reject_keypoint_confidence_low`, `auto_reject_keypoint_confidence_threshold`, `skill_specific_filming_notes`
- Content to **preserve**: `camera_filming_instructions` (the athlete-facing filming guidance text body — currently 705 chars of authored content)

## Implications for Slice D / E Plan

1. **Slice D scope confirmed as planned** — surgical JSON sub-field strip on the `camera_guidelines` JSONB, preserving `camera_filming_instructions`.
2. **Slice E does NOT drop the `camera_guidelines` column** — the column survives because it still holds `camera_filming_instructions`. Only the metadata sub-fields are removed.
3. **Branching simplification not available** — proceed with the planned JSON-aware path. There is no "plain_text fallback" branch to remove because no node uses plain text.
4. **Forward-compat note:** the `shape` check is worth keeping in the migration script as a guard — if any future-authored node accidentally lands as plain text, the migration should skip cleanly rather than error.

## Slant Snapshot of `camera_guidelines` (full content for archival reference)

```json
{
  "camera_min_fps": 30,
  "camera_min_resolution": "1080p",
  "camera_min_distance": 8,
  "camera_max_distance": 15,
  "auto_reject_athlete_too_small": true,
  "auto_reject_athlete_too_small_threshold": 35,
  "auto_reject_duration_out_of_range": true,
  "auto_reject_resolution_below_min": true,
  "auto_reject_keypoint_confidence_low": true,
  "auto_reject_keypoint_confidence_threshold": 0.42,
  "camera_filming_instructions": "FILM YOUR SLANT ROUTE\n\nCamera position: Sideline opposite the \ndirection of the break, 10-15 yards \naway, waist height. The athlete should \nrotate toward the camera during the \ncut.\n\nVisibility: Full body must stay in \nframe throughout the rep — especially \nthe plant foot and both hands at the \ncatch.\n\nDuration: 6-7 seconds covering setup \nthrough 1-2 post-catch steps.\n\nCalibration: Field markings preferred. \nIf unavailable, the athlete's height \nin their profile will be used as a \nreference.\n\nSettings: 1080p minimum, 60fps minimum. \nStable camera (tripod preferred), even \nlighting, no zooming or panning.",
  "skill_specific_filming_notes": ""
}
```

**Note:** the `camera_filming_instructions` content includes the line "the athlete's height in their profile will be used as a reference" — this is admin-authored content referencing the `athlete_height` field that Tab 8 Option A is removing. After Slice C ships and athlete_height is gone, this sentence becomes stale. **Logged as a follow-up content edit** (admin authoring, not code work) for the user to update post-Slice-C in the same workflow as the post-Slice-3 template variable additions.
