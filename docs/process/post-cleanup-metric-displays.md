# Post-cleanup metric documentation and displays

## Changes

- Updated only Slant WR's three `internal_documentation` strings: Speed into the break peak search ends before Break starts; Hip Stability uses height-derived measurement-window scale, not required Reference calibration; Release Speed derivation is 1.5–2 yards / 0.5 seconds × 3600 / 1760 = 6.14–8.18 mph. Targets, mapping, descriptions, version, historical knowledge and results remain untouched.
- Shared pure formatters render ratio values/targets as percentages in coaching, fallback and Analysis Log (including Copy Log); gaps are percentage points. Stored ratio numbers remain unchanged.
- Velocity Analysis Log label uses the inclusive span between recorded valid endpoints; c6fa0895-era fresh stored run reports 15 frames, minimum 3 elapsed frames. Three is the existing minimum interval gate, not three endpoint samples. Missing endpoints fall back to recorded window length. Editor no longer appends “3 frames” as if it were the measurement length.
- Static Reference calibration remains reachable: required height can fail per-frame/single-height and body-width quality gates. Saved scale is treated as a 1080p baseline and multiplied by clip height/1080, using existing service resolution or library resolution lookup. 80 at 1080p becomes 160 at 2160p; unknown resolution retains the baseline with `static_resolution_unknown`. This corrects the fallback only, not priority or height-based math. Resolution adjustment does not correct camera distance/framing changes.

## Verification

- Before/after identical stored input and fresh database read: `fba7237f605f41960d27375977057819623d820906c28a57c148cce25fc72b21`, aggregate 94. Canonical output byte-identical.
- 176 tests pass across 26 files; final targeted run: 53 pass. Added concrete tests for 1→100%, 0.9→90%, ten-percentage-point gap, 15-frame endpoint span, 80→160 scale.
- Browser fetched real stored result via existing service: aggregate 94; actual Analysis Log renders “100% of top stem speed”, target “90%”, and “Phase window, 15 frames; minimum 3 elapsed frames”. No page errors. No fabricated result data, node save or new pose run.
- Deployed analyzer stamp `5c1a706-2026-10-23`; submitted source SHA256 `23c1f2dc6c526a3d2a747752dd4d1e2afb8dc913a1c7d6b13e463b6d7a7e3a23`. No pose-service edits or deploy.
- Deployed read-only coaching replay on c6fa0895: HTTP 200, percentage evidence confirmed, 134 words, passed after one banned-word retry, no fallback. Replay intentionally uses its original stored 0.81 ratio (81%), whereas stored-data rescore calculates 1.00 (100%); no replay result writes.
- Preview build OK. Archived knowledge was not edited. Stopped after these fixes.