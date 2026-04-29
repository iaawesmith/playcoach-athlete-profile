---
id: R-05
title: Tab consolidation hides existing draft-state content from admins
status: mitigated
severity: Sev-3
origin_slice: 1c.3
origin_doc: docs/migration-risk-register.md  # original-batch entry
related_adrs: []
related_entries: [R-12, F-OPS-4]
opened: 2026-04-25
last_updated: 2026-04-29
mitigated: 2026-04-29
---

# R-05 — Tab consolidation hides existing draft-state content from admins
- **Phase:** 1c.3
- **Severity:** Sev-3
- **Likelihood:** Medium
- **What happens:** Collapsing 13 → 8 tabs reroutes editors. An admin who was mid-edit on, say, the Filming Guidance tab returns and can't find the field they were editing.
- **Mitigation:**
  1. 1c.3 ships a one-time "what moved" banner with a tab-by-tab redirect map.
  2. Old tab anchors (`#filming-guidance`) auto-redirect to the new tab + scroll to the moved section.
- **Trigger to pause:** Admin support thread reports >1 "I lost my X field" within 48h.

## Mitigation status — shipped 2026-04-29 (PHASE-1C3-SLICE-D)

R-05 status: **open → mitigated**.

Three mechanisms shipped together in PHASE-1C3-SLICE-D:

1. **`ConsolidationRedirectBanner`** (`src/features/athlete-lab/components/ConsolidationRedirectBanner.tsx`) — one-time per-browser banner mounted above the tab row in `NodeEditor`. Explicit redirect list (not conceptual prose) covering all 5 retired tabs:
   - Filming Guidance → Reference (Filming Guidance section)
   - Scoring → Metrics (Scoring section)
   - Errors → Metrics (Common Errors section)
   - Checkpoints → Phases (Checkpoints section, shown when segmentation method is checkpoint-based)
   - Training Status → Basics (Pipeline Config section)

   Dismissible "Got it" CTA; persists dismissal in `localStorage` key `athleteLab.consolidationBannerDismissed.v1`.

2. **Hash-anchor redirects** (`HASH_REDIRECT_MAP` in `NodeEditor.tsx`) — 10 retired anchor names (e.g., `#scoring`, `#filming-guidance`, `#training_status`, `#mechanics`) auto-redirect to the consolidated parent tab. Hash is stripped after redirect to prevent bounce on render.

3. **HelpDrawer internal redirects** (`KB_REDIRECT_MAP` in `HelpDrawer.tsx`) — stale `tabKey` props (e.g., persisted from a prior session pointing at a retired key) coerce to the consolidated parent before `knowledgeBase[tabKey]` lookup. Sections are never silently empty for content that still exists under a different parent name.

Plus: `helpTabKey` stale-value coercion in `useEffect` (decided as integration-decision I in 1c.3-D).

**Trigger to pause** unchanged: admin support thread reports >1 "I lost my X field" within 48h. If the banner / redirect surfaces don't catch the case, that's the signal to investigate.

## Cross-links

- [R-12](R-12-mechanics-tab-deletion-strands-knowledge-base-sub-sections-keyed-to-mechanics.md) — closed in 1c.3-B (Mechanics-only case); 1c.3-D extended the same merge pattern to 5 additional source keys, completing the broader knowledge_base consolidation pattern R-12 originally named.
- [F-OPS-4](F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md) — fourth annotation captures the integration-decision halt sub-pattern that surfaced during the consolidation work.
- [docs/process/phase-1c3-slice-d-outcome.md](../process/phase-1c3-slice-d-outcome.md) — slice that shipped the mitigation.
