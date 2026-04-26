---
id: F-OPS-2
title: Missing error boundary around NodeEditor (Phase 3 ship blocker)
status: open
severity: Sev-2
origin_slice: 1c.2-Slice-E.5
origin_doc: TODO
related_adrs: [ADR-0006]
related_entries: [F-SLICE-E-4]
opened: 2026-04-26
last_updated: 2026-04-26
---
# F-OPS-2 — Missing error boundary around NodeEditor (Phase 3 ship blocker)
- **Severity:** **Sev-2** (upgraded 2026-04-26 from Sev-3 — reframed as Phase 3 athlete-UI ship blocker; remediation work bundled into Phase 2 per revised phase ordering)
- **Logged:** 2026-04-26 (severity upgraded same day; phase label updated 2026-04-26 PM)
- **Status:** Open. **Must land before Phase 3 athlete-facing UI ships** (i.e., during Phase 2 operational/security obligations track).
- **Finding:** A single null-deref inside any sub-editor (e.g., `MechanicsEditor` line 1015) unmounts the entire `NodeEditor` tree because there is no React error boundary at the tab-content level. During Slice E.5 first-attempt smoke, the `pro_mechanics` undefined dereference unmounted the whole admin shell — top nav, sidebar, all content blank — with no recovery path except a full page reload. For Phase 1c admin work this is uncomfortable but tolerable (admin user, technical, refresh-friendly). For Phase 3 athlete-facing UI it is unacceptable: an uncaught error mid-upload would blank an athlete's screen with no recovery path. Athletes are not technical users and will not understand a refresh-and-retry instruction; the perceived product failure mode is "the app broke and ate my upload."
- **Severity rationale (Sev-2):** Silent correctness failures in athlete UX are Sev-2 territory; "entire screen unmounts to root with no recovery" is the maximally bad version of that for a non-technical user. Containment is a non-negotiable prerequisite for athlete-facing surfaces.
- **Action (Phase 3 prerequisite, executed during Phase 2):** Add `ErrorBoundary` components at key React-tree positions before any Phase 3 athlete-facing surface ships:
  1. `AthleteLab` outer shell — admin work, last line of defense.
  2. `NodeEditor` tab-content level — wrap each `{tab === "..." && <SubEditor />}` block so a single sub-editor failure renders a "This tab failed to load — see console" panel and lets the admin keep using other tabs.
  3. **All future athlete-facing surfaces** (upload flows, result viewers, profile pages) — wrap at route level and at any subtree containing user-generated content rendering, with sensible recovery UI ("Something went wrong — your upload is safe, try refreshing this view").
- **Cross-references:**
  - **F-SLICE-E-4** — methodology gap that allowed the unguarded line 1015 to reach E.5; demonstrates that even with rigorous pre-flight audits, a single missed consumer can take the whole tree down.
  - **Slice E.5 first-attempt crash** — the empirical demonstration of the exposure. Artifacts: `/mnt/documents/slice-e-smoke/03-tab-04-mechanics-CRASH.png`, `console-cumulative.txt`.
- **Definition of done:** Phase 3 ship checklist must include "ErrorBoundary at AthleteLab, NodeEditor tab-content level, and every athlete-facing route" as a gate. Not a hand-wave "we should add error boundaries someday."
