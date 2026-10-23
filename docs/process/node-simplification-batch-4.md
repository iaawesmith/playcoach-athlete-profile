# Node simplification — Batch 4 (Phases)

Approved and completed 2026-10-23 UTC. Stop after this batch.

## Restore point

Pre-Batch-4 source history: `d01004d52ffcd3d966ca119651d7c85b860ff000`.
Slant remains LIVE, node version 12. No analyzer or pose-service deployment.

## Archive prerequisite — verified before hiding

The historical Mechanics documentation archive did not contain the complete current Release, Stem, Catch Window or YAC cues; only Break matched completely. A documentation section named Coaching Cues was not treated as proof.

Appended one section to Slant's existing `knowledge_base.phases`:

- ID: `batch4-slant-phase-notes-20261023`
- Title: `ARCHIVE: Slant phase descriptions and coaching cues (Batch 4)`
- Complete original description and coaching-cue text for all five phases, with phase IDs and names.
- Explicitly labeled admin-only historical prose, not sent to the coach model or endorsed as measured feedback.

A fresh database read confirmed complete HTML-decoded text equality for every cue and description before the UI edits. Existing 19 Phases knowledge sections remained identical; the archive is section 20. Saved phase records and node version were unchanged. This knowledge-base append was the only node-data write.

## Presentation changes

- Hide Phase Description and the retired coaching-cue migration banner/modal and its unused editor handlers.
- Hide Phase Context Mode and remove `{{phase_context}}` from advertised variables; preserve saved prompt text and `phase_context_mode`.
- Retain phase name, clip weight, sequence/order and operational Frame Buffer controls.
- Phase/Basics text exports omit hidden descriptions, cues and migration status; the existing full knowledge-base export includes archived prose.
- Correct Set Live's phase requirement text to match the existing count-only check.
- Saved descriptions, cues, migration status and phase-context mode remain preserved. No scoring, analyzer, service, readiness-gate or phase-window changes.

## Verification

`bun scripts/fingerprint-rescore.ts c6fa0895 --expect fba7237f605f41960d27375977057819623d820906c28a57c148cce25fc72b21`

Pass before edits, after edits on the identical saved input, and after edits on a fresh stored-data read:

- Fingerprint: `fba7237f605f41960d27375977057819623d820906c28a57c148cce25fc72b21`
- Aggregate: 94; 90 stored frames; Slant v12.
- Hip Stability: 0.01 / 100 / scored.
- Plant Leg Extension: 139.61 / 100 / scored.
- Release Speed: 3.76 / 68.9765 / scored.
- Speed into the break: 1 / 100 / scored.

All 160 existing tests pass (46 targeted). Preview build OK. Browser exercised the real Slant phase editor, edited Release in the local draft and restored its name without submitting Save Node; Frame Buffer remains available and retired controls are absent. No runtime errors. Screenshots: `/tmp/browser/batch4/phases.png` and `prompt.png`.

Batch 5 and later were not started.