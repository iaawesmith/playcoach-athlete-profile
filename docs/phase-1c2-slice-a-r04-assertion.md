# R-04 Backup Completeness Assertion — Phase 1c.2 Slice A

**Status:** FAIL
**Run at:** 2026-04-25T15:09:38.668Z
**Scope:** Slant node (`75ed4b18-8a22-440e-9a23-b86204956056`), 14 deletion-target fields
**Passes:** 12/14
**Failures:** 2

## Pass detail

| field_path | content_len |
|---|---|
| `pro_mechanics` | 3366 |
| `llm_tone` | 6 |
| `det_frequency` | 1 |
| `solution_class` | 9 |
| `performance_mode` | 8 |
| `tracking_enabled` | 4 |
| `det_frequency_defender` | 1 |
| `det_frequency_multiple` | 1 |
| `reference_object` | 241 |
| `reference_filming_instructions` | 310 |
| `camera_guidelines` | 1059 |
| `camera_guidelines.skill_specific_filming_notes` | 0 |

## Failure detail

### `reference_calibrations`

```json
{
  "node_id": "75ed4b18-8a22-440e-9a23-b86204956056",
  "field_path": "reference_calibrations",
  "reason": "byte_mismatch",
  "source_len": 2786,
  "backup_len": 2839,
  "first_diff_offset": 11,
  "source_preview": "\"[{\\\"status\\\":\\\"not_supported\\\",\\\"camera_angle\\\":\\\"endzone\\\",\\\"known_size_unit\\\":\\\"\"",
  "backup_preview": "\"[{\\\"status\\\": \\\"not_supported\\\", \\\"camera_angle\\\": \\\"endzone\\\", \\\"known_size_uni\""
}
```

### `camera_guidelines.metadata_thresholds`

```json
{
  "node_id": "75ed4b18-8a22-440e-9a23-b86204956056",
  "field_path": "camera_guidelines.metadata_thresholds",
  "reason": "byte_mismatch",
  "source_len": 357,
  "backup_len": 376,
  "first_diff_offset": 18,
  "source_preview": "\"{\\\"camera_min_fps\\\":30,\\\"camera_min_resolution\\\":\\\"1080p\\\",\\\"camera_min_distance\\\":8,\\\"\"",
  "backup_preview": "\"{\\\"camera_min_fps\\\": 30, \\\"camera_max_distance\\\": 15, \\\"camera_min_distance\\\": 8, \\\"c\""
}
```
