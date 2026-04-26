---
id: F-SLICE-E-4
title: Mechanics tab crash post-`pro_mechanics` drop
status: resolved
severity: Sev-3
origin_slice: 1c.2-Slice-E.5
origin_doc: docs/process/phase-1c2-slice-e-outcome.md
related_adrs: [ADR-0015]
related_entries: []
opened: 2026-04-26
last_updated: 2026-04-26
---

# F-SLICE-E-4 — Mechanics tab crash post-`pro_mechanics` drop
- **Severity:** Sev-3
- **Logged:** 2026-04-26
- **Status:** Resolved via tab hide. Component deletion deferred to 1c.3.
- **Finding:** First E.5 browser smoke halted on `TypeError: Cannot read properties of undefined (reading 'trim')` when the Mechanics tab mounted `MechanicsEditor` at `NodeEditor.tsx:1015`. Root cause: `draft.pro_mechanics` is now `undefined` post-migration `20260426025918` and the read path lacks the defensive `?? ""` null-guard used at sibling sites. Crash unmounted the React tree.
- **Resolution:** Mechanics tab commented out of `TABS` array and removed from `ADVANCED_TAB_KEYS` in `NodeEditor.tsx`. Component file retained for 1c.3 deletion. Scope: 5-line edit. Avoided writing throwaway `?? ""` patches because `MechanicsEditor` is on the 1c.3 deletion list (content already migrated to phase coaching cues in Slice 2).
- **Process learning:** Slice E's frontend audit methodology checked existence of defensive patterns (e.g., `?? ""`) elsewhere in the file rather than verifying each individual consumer of dropped columns. The unguarded line 1015 was missed because most other consumers were guarded. **Going forward:** audits for data-shape-changing slices must verify each consumer site, not infer safety from pattern presence.
