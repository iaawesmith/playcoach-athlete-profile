# Roadmap

- [x] Audit the specified 15 nodes' phase descriptions, coaching cues, and metric descriptions without changing node data.
- [x] Change only the ALL-tab display order to WR, TE, RB and official route order.
- [x] Verify filtered tabs and node records remain unchanged; WR Slant remains LIVE.
- [x] Calibration Video Library: direct-to-storage uploads (500MB), archive-instead-of-delete for clips with runs, chosen depth metric comparison, library-run tag + history filter.
- [ ] Lock Video Library to signed-in admins (blocked: needs admin login, tracked in F-SEC-1).
- [x] Slant 4K30 fixes: velocity whole-window, confidence gate 0.8 (window-only) + keypoint_warning flags, plausibility bounds, error-rule fix + detected_errors objects, results display parsing, low-quality LLM guard; reran clip.
- [ ] Node review: "Hands Extension at Catch" measures distance between both index fingers (kp 19↔20), not extension (left unchanged by request).

## Calibration v2 (approved Oct 20)
- [ ] Height-based per-frame scale + candidate audit + depth_motion_present + static resolution flag (analyzer)
- [ ] Calibration block in Testing Panel
- [ ] Pose-service diff (item 2) prepared separately — deploy order: repo service as-is → analyzer → diff
