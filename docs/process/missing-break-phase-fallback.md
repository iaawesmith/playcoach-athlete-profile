# Missing-break phase fallback — November 11, 2026

Scope: phase window derivation and its Analysis Log only. No event detection, metric definitions, scoring math, node records, badges, Reference controls, or pose-service changes.

When break detection fails but snap and catch are detected, the existing proportional splitter divides snap (inclusive) to catch (exclusive) using all configured pre-catch phase weights. The genuine break phase's share is reserved but not measured; other pre-catch phases receive windows and depend only on snap and catch. Existing boundary buffers apply. Catch Window and post-catch paths remain untouched, as does the entire detected-break path.

Each measured phase records `derivation`; fallback runs record a `Phase window derivation` WARN check. No stored results or fingerprints are replaced.

## Fresh production verification

Analyzer build: `db8fb82-2026-11-11`. Submitted source SHA256: `7d3d2f2419ce00b08020e1734694b158d9a056cd65d947efc6d1fae40f44296a`.

Both clips submitted through the real calibration library / Testing Panel, then saved results read back through the UI and database.

- Slant Sideline 932b91df: before result 65866318, after e704d9a2-62fd-4e32-9f64-d0f2ee0a5361. **94 → 94**. Plant Leg Extension 138.89° / 100; Hip Stability 0.01 yd / 100; Release Speed 3.76 mph / 68.9765; Speed into the break 100% / 100. All unchanged. 90 decoded frames; 68.0 seconds submit-to-result.
- Cross Behind WR 678cbac1: before result 701ac613 (three skipped metrics, no aggregate due to skip ceiling; displayed 0), after 064b73f0-e751-4554-8018-6d2bda2b7947. **0 → 48**. Snap 26, catch 95, break still undetected (`direction_change_below_peak`). 186 decoded frames; 60.3 seconds submit-to-result.

| Cross phase | Frames | Derivation |
|---|---|---|
| Release | 26–44 | proportional fallback (break not detected) |
| Shallow Stem | 39–72 | proportional fallback (break not detected) |
| Cross | none | event_not_detected:break |
| Catch Window | 85–100 | event-anchored (unchanged) |
| YAC (After Catch) | 101–185 | event-anchored (unchanged) |

Cross Release Speed now measures 1.65 mph (16.3164), Crossing Depth Consistency 0.06 yd (100), Hands Extension at Catch remains 0.07 yd (39.0640). Speed Retention, assigned to Cross, remains skipped. Skips fall from 75% to 25%, below the existing 50% ceiling. Analysis Log shows WARN and derivations in UI and export.

All 200 tests pass; preview build OK. Original c6fa0895 stored-data fingerprint remains `fba7237f605f41960d27375977057819623d820906c28a57c148cce25fc72b21`, aggregate 94. No approval to replace it was assumed.