# Admin Video Library for Athlete Lab calibration

## Goal
Upload each calibration clip once, along with its test context and ground truth. Then pick it from the library and run it in the existing Testing Panel without uploading it again or retyping anything.

## Access model (your choice: backend-only for now)
- The new clip table has no browser-facing permissions. Only the service role can read or write it, through admin backend functions. This matches how the admin upload tools already work.
- Limitation: anyone who can open the Athlete Lab page can still use the library, because the app has no admin login yet. This gets closed as part of F-SEC-1. I'll add a note to the F-SEC-1 entry in the risk register.

## What gets built
1. **Storage.** Clips go into the existing private athlete-videos bucket under `calibration-library/{clipId}/{filename}`. Files are checked against 500MB in the browser before upload, and again on the server. A file over the limit shows: "File is X MB — library limit is 500 MB."
2. **Table `calibration_clips`.** Columns:
   - Clip info: title, storage_path, node_id, duration_seconds, resolution, fps, created_by, created_at, updated_at
   - Test context: camera_angle, people_in_video, route_direction, catch_status, athlete_level, athlete_height, athlete_height_unit, athlete_wingspan, athlete_wingspan_unit
   - Ground truth: yard_lines_visible (boolean), yard_line_notes, start_yard_line (number), break_yard_line (number), and expected_route_depth_yards, which is calculated automatically as abs(break − start) and can't be edited. Also expected_calibration_source (allowed values dynamic / body_based / static / unknown, enforced by a validation trigger per ADR-0008) and hand_timed_splits
   - Camera: camera_setup (tripod / handheld), camera_distance_notes
   - notes
   - Duration, resolution and fps are read from the file in the browser when it's uploaded.
3. **Library UI.** A new "Video Library" admin tab in Athlete Lab. It lists every clip with its title, node name, a LIVE or DRAFT chip, route depth and expected calibration source. Actions:
   - Upload (file plus a full metadata form)
   - Edit metadata
   - Preview, using a short-lived signed link in a video player
   - Delete, which asks for confirmation and removes both the database row and the stored file
   - Empty and loading states follow the design system.
4. **Use in test.** This button opens the Testing Panel with the clip's node selected and every context field prefilled.

## How a library run avoids duplicating the file
- A new backend function, `admin-calibration-clips`, handles list, create, update, delete and `sign`. For `sign`, it makes a fresh signed link for the clip's existing storage path.
- The Testing Panel calls the existing `submitRunAnalysisJob` with `externalVideoUrl` set to that signed link and no `uploadedFile`. That path skips `admin-test-upload` entirely, so nothing is copied.
- `admin-create-athlete-upload` then creates the normal `athlete_uploads` row, with `video_url` pointing at the library file. One stored file can back any number of runs.
- analyze-athlete-video, Cloud Run and the 3-second window logic stay untouched.

## How the library tag is stored
- Library runs add these keys inside the existing `analysis_context` JSON: `source: "calibration_library"`, `calibration_clip_id`, and a `ground_truth` snapshot (start and break yard lines, expected depth, expected source).
- No schema change to athlete_uploads is needed. analyze-athlete-video already carries `analysis_context` through as-is.
- Admin History gets a "Library runs / Athlete uploads / All" filter based on `analysis_context.source`.

## Ground-truth comparison (results view, library runs only)
A "Ground Truth vs Pipeline" panel, built from fields that already exist in `athlete_lab_results.result_data`:
- **Calibration source:** expected source compared with `result_data.calibration_audit.selected_source`, with a match or mismatch chip.
- **Pixels per yard:** `calibration_audit.selected_ppy`, shown next to `dynamic_ppy` and `body_based_ppy` from the same audit.
- **Distance:** expected route depth in yards shown next to every entry in `metric_results` whose unit is yards. Distance metrics include each metric's measured value, its elite target and the difference from ground truth.
- If the audit is missing, the panel says "Not reported by pipeline" instead of guessing.

## Not changing
analyze-athlete-video, the Cloud Run service, the clip window logic, any node's status or data, Google Drive import.

## Technical details
- Migration: create the table, grant ALL to service_role only, enable RLS with no browser policies, add an updated_at trigger, add the validation trigger, and use a generated column for the depth.
- New code: an edge function `admin-calibration-clips` (validated with Zod, 500MB check, uploads with the service role), `src/services/calibrationLibrary.ts`, and `src/features/athlete-lab/components/VideoLibraryTab.tsx`.
- Testing Panel: a small Zustand slice holds the pending library clip. The Testing Panel reads it on open to prefill and sends the signed link. No new analysis path.
- Large uploads: a browser upload through an edge function is limited by request size. If 500MB is too large for that, the function issues a signed upload link (`createSignedUploadUrl`) and the browser uploads straight into storage.
- Tests: depth calculation, the 500MB limit, and tagging (the `analysis_context.source` value).
- Note: test runs still can't finish until Cloud Run is back online. The library and prefill can be verified now, and the comparison panel can be checked against the last completed upload.
