# Batch 7 — Scoring and fixes

Restore point before Batch 7: `23a5862801b8859d1afebf9e9a730e98c572170a`.

## Changes
- Hide score bands and free-text scoring rules in the editor/export; remove obsolete scoring_rules from the advertised prompt variables. Saved legacy values are untouched: score_bands, scoring_rules and llm_max_words are omitted from editor saves, not cleared.
- Remove the adjustable feedback word control. Both Anthropic and Lovable AI requests use the shared fixed 500-output-token cap in coachRequest.ts, including retries, normal runs and read-only replay/comparison paths.
- Always append 120–140-word guidance, reject above 160 using the unchanged word check, retry once with exact violations, then use checked data-only fallback.
- Rename the skipped-metric limit to Max skipped metrics %. Help/count now describes strictly greater-than, not greater-than-or-equal. Scoring math is untouched.
- Zero confidence produces an inline validation message and blocks metric Save/Add; node Save and service update validation also block it. Invalid saved thresholds surface in readiness without rewriting node data.

## Verification
- Identical stored input and fresh database read: c6fa0895-744a-450a-aca6-80a252c42470 fingerprint `fba7237f605f41960d27375977057819623d820906c28a57c148cce25fc72b21`, aggregate 94. Before/after outputs, including error evaluations, are byte-identical. Only Slow release off the line triggers.
- 170 tests pass, including fixed caps on both providers, 160 accepted / 161 rejected even below the token cap, checked fallback, and zero/positive confidence validation.
- Real Slant editor browser verification: hidden controls absent, skipped limit editable/restored, zero shows validation and cannot save metric, 0.05 clears error; metric edit cancelled, no node save, no page errors.
- Analyzer stamped immediately before deployment: `6ea905e-2026-10-23`; deployed successfully, source SHA256 `b8d841a9390ca2042676231252159302ebc6f0098933a37545a7127b32d387c4`.
- Deployed read-only replay on c6fa0895: HTTP 200, output 131 words, feedback_check passed, no violations/retry/fallback. Replay reads the stored metric results (historical speed ratio 0.81); the fingerprint rescore recomputes it as 1.0 from stored diagnostics, without writing either result.
- Build OK. No node data, stored-result, scoring math or pose-service changes.

Stopped after Batch 7. Batch 8 not started.