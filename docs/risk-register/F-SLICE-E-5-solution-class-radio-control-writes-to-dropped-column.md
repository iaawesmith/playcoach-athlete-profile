---
id: F-SLICE-E-5
title: Solution Class radio control writes to dropped column
status: open
severity: Sev-3
origin_slice: 1c.2-Slice-E.5
origin_doc: docs/process/phase-1c2-slice-e-outcome.md
related_adrs: []
related_entries: [F-SEC-1, F-SLICE-E-4]
opened: 2026-04-26
last_updated: 2026-04-26
---

# F-SLICE-E-5 — Solution Class radio control writes to dropped column
- **Severity:** Sev-3
- **Logged:** 2026-04-26 (post-Slice-E.5 re-run report observation, §2.2 row 13)
- **Status:** Open. Scheduled for Phase 1c.3 cleanup.
- **Finding:** The Solution Class radio control on the Training Status tab is reachable and interactive: all three cards (Body, Body with Feet, Wholebody) render in an unselected state (the expected post-drop visual), and the click handler still binds form state for `solution_class`. If an admin clicks one of the cards and triggers Save, the form state would attempt to write `solution_class` to a column that no longer exists in the schema (dropped in migration `20260426025918`). Read paths were verified null-safe in the Slice E.5 §1.2 audit; the **write path was not audited** and remains coupled to the dropped column at the form-state level.
- **Failure mode:** PATCH `4xx` from PostgREST with `column "solution_class" of relation "athlete_lab_nodes" does not exist` (error code `42703`). **Graceful save failure**, not a render crash — distinguishes this from F-SLICE-E-4 (Mechanics tab unmount). Admin sees a toast / network error rather than a white screen, and other tabs remain usable.
- **Why latent in the re-run:** The Slice E.5 save validation toggled `phase_context_mode` (compact ↔ full), which exercises a different field. The Solution Class radio was visually inspected ("unselected, expected") but not clicked, so the write-path exposure was not triggered. PATCH 200 OK on the toggle does not generalize to all fields on the tab.
- **Mitigation options for 1c.3** (any one resolves):
  1. **Hide the Solution Class radio control** on the Training Status tab (analogous to the Mechanics tab hide pattern from F-SLICE-E-4 recovery). Lowest-effort defensive move if the tab itself stays.
  2. **Disconnect form state binding from the save payload at the source.** The save payload was already cleaned in Slice E.4 (Resolution A — payload excludes `solution_class`), but `update("solution_class", …)` calls in the radio's click handler still mutate `draft.solution_class`. A subsequent save would not actually transmit it (since payload construction is allow-list, not deny-list — verify), but the state coupling is fragile and should be removed.
  3. **Remove the entire Training Status tab** if Phase 1c.3 consolidation eliminates it per `docs/athlete-lab-tab-inventory.md` (tab 13 disposition: "consolidate or rename"). This resolves F-SLICE-E-5, the per-scenario `det_frequency_*` tab-content question, and the orphaned-radio question in one move.
- **Verification needed during 1c.3 audit:** Confirm whether the save-payload allow-list in `NodeEditor.tsx` (lines ~600–625, the post-Slice-E.4 cleaned payload) actually filters out `draft.solution_class` even when the form-state has it set. If yes, Sev-3 stays; if no (i.e., payload is spread-based and would transmit any field on `draft`), upgrade to Sev-2 immediately because the exposure is one click away from a failing save.
- **Root cause (shared with F-SLICE-E-4):** Slice E's frontend audit methodology checked read paths for null-safety but did not enumerate write-path bindings (click handlers, controlled-input `onChange`, form-state `update()` calls) for dropped columns. Going forward, data-shape-changing slices must audit **read paths AND write paths AND form-state bindings** for every dropped column.
- **Cross-references:**
  - **F-SLICE-E-4** — same root-cause methodology gap; different failure mode (render crash vs save failure).
  - **F-SEC-1** — pending Phase 3 athlete UI; both are pre-Phase-3 cleanup obligations executed during Phase 2 (analysis quality + operational/security track), tracked under different severities.
  - `docs/athlete-lab-tab-inventory.md` — tab 13 (Training Status) disposition rationale.
