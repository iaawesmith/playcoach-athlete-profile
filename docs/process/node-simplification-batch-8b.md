# Node simplification — Batch 8b setup guide

Restore point: `90cffd0290ad67f70378be7db43b7fc64c8b7b7a` (pre-Batch-8b repository revision).

## Delivered

- Replaced active Knowledge Base help with a shared, code-verified setup guide: one page per eight surviving NodeEditor tabs, plus New route setup checklist. About 1,620 words, approximately eight minutes at 200 words/minute.
- Covered visible fields, effect categories, MediaPipe's 33-landmark mapping, actual coaching variables/inclusion rules, anonymization timing, fixed cap/word guard, minimum setup, calibration-library provenance, display-only ground truth and stored overlay validation.
- All original `knowledge_base` JSON remains untouched in node storage and accessible through a read-only Archive selector. No rewrite, deletion or migration of old text; existing phase/error archives remain included. Active help is maintained in `setupGuide.ts`, not in per-node historical prose.
- Included Run Analysis in help navigation. Custom GuideButton uses existing semantic tokens; no shadcn or icon-library imports.

## Code findings documented, not changed

- Set Live readiness requires four phases, while the separate completeness check requires one. Guide/checklist explicitly states the stricter current four-phase requirement.
- Coach evidence is substituted only where placeholders appear in template/system instructions; it is not automatically appended. The request also includes word-budget guidance and a violation note on retry. Scored metric lines include unit, target relation and score, not only name/value/target.
- Flag Only excludes flagged scores from aggregate and excludes them from skipped-percent counting; Penalize includes zero. Guide describes executable behavior rather than contradictory old UI tooltip prose.
- Stored speed-retention end-before-phase logic remains honored, but no editor control is exposed. Manual/library runs start at zero. No invented setup input was added.

## Verification

- Read-only c6fa0895 before/after output files byte-identical: `fba7237f605f41960d27375977057819623d820906c28a57c148cce25fc72b21`, aggregate 94.
- All existing 171 tests pass (26 files). No scoring or rule change, so no new scoring test or model replay required.
- Real Slant editor at localhost: all nine guide pages load; Archive exposes 103 original pages, including complete Batch 4 Slant cues. Fresh whole-node reads before/after browsing are identical. No Save Node action.
- Run Analysis help opens its own page. Desktop and 390px viewport verified; no guide horizontal overflow or browser page errors. Archive preformatted prose wraps without altering stored HTML.
- Preview build OK. No database writes, analyzer/pose-service edits or deployments. Historical video playback issue is unchanged; this batch did not rerun video analysis.

Sources: NodeEditor, NodeReadinessBar, KeyMetricsEditor, CameraEditor, BadgesEditor, TestingPanel, analyzer index/prompt/scoring/coachRequest/groundTruth, libraryRunContext and poseOverlay.

Stopped after Batch 8b.