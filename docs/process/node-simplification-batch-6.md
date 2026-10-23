# Node simplification — Batch 6 (Reference)

Completed 2026-10-23 UTC. Restore point: `834c703d8c7ca1150dfc0c0f71839159690cd1e3`.

## Approved Wheel follow-up

Wheel WR `c1000010-0001-4a00-8a00-0000000000aa`:

1. Added admin knowledge section `batch6-wheel-sideline-admin-20261023` under Metrics, preserving the original name and exact correction: “Hold a lane inside the boundary so there is room to finish the catch in bounds.”
2. Fresh read confirmed the archive before removing the disabled, empty-condition “Drifting to the sideline” rule.
3. Retained all four other rules byte-for-byte. Only `common_errors`, `knowledge_base` and automatic `updated_at` changed. Version remains v1. No metric or scoring changes.

The archive is explicitly admin-only, not a measured error and not sent to the coach model. No invented sideline condition.

## Reference simplification

Scope follows the original audit plan, Section 6, Batch 6: camera angle plus pixels per yard.

- Three camera-angle scale inputs: Sideline, Endzone, Behind QB. Behind WR unchanged (not added).
- Hidden angle status, object, known size/unit, placement, per-angle instructions and calibration notes; all original stored fields preserved.
- Hidden obsolete fallback selector, including “estimate field lines” and misleading pixel-scoring copy. Stored `reference_fallback_behavior` preserved; no replacement value is written.
- Skill-specific filming notes and Filming Guidance remain editable.
- Copy identifies saved scale as a fallback and explains that no-scale distance/speed metrics are skipped.
- Human-readable Reference export matches the simplified controls; stored JSON remains intact.

`withReferenceScale` updates only `pixels_per_yard` on the existing object, preserving unknown fields and array order. New angles do not fabricate legacy reference guidance. Analyzer, pose service, readiness and scoring untouched. No deployments.

## Verification

```text
bun scripts/fingerprint-rescore.ts c6fa0895 --save-input /tmp/batch6-before-input.json --errors --expect fba7237f605f41960d27375977057819623d820906c28a57c148cce25fc72b21
bun scripts/fingerprint-rescore.ts c6fa0895 --errors --expect fba7237f605f41960d27375977057819623d820906c28a57c148cce25fc72b21
```

Before/after responses identical, aggregate 94, fingerprint matches. Detected errors and rule evaluations unchanged: only Slow release off the line triggers; Sinking too deep in the plant remains false at 139.61.

- All 165 tests pass, including three new scale-preservation tests.
- Real Slant Reference: three scale inputs; retired fields absent; filming guidance present; changed scale to 180 then restored original 80 without saving.
- Real Wheel Errors: removed rule absent, no runtime errors.
- Fresh full-row comparison: Slant entirely unchanged; Wheel only approved changes above. Stored result untouched.
- Build OK. Screenshot: `/tmp/browser/batch6/reference.png`.

Stopped after Batch 6. Batches 7 and 8 not started.