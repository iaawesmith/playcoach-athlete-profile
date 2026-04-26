---
id: R-01
title: Mechanics → Phases content migration loses or duplicates coaching cues
status: mitigated
severity: Sev-2
origin_slice: 1c.1
origin_doc: docs/process/phase-1c1-slice2-outcome.md
related_adrs: []
related_entries: []
opened: 2026-04-25
last_updated: 2026-04-25
---

# R-01 — Mechanics → Phases content migration loses or duplicates coaching cues
- **Phase:** 1c.1
- **Severity:** Sev-2
- **Likelihood:** Medium
- **Status (2026-04-25):** Mitigated — Slice 2 shipped. See `docs/phase-1c1-slice2-outcome.md` for the full verification record.
- **What happens:** `pro_mechanics` (string of multi-section markdown) gets parsed into `phase_breakdown[].coaching_cues`. Parser misattributes sections to phases (e.g., "Break" coaching cues land on "Stem"), or content is double-stored because both old and new locations are written during transition.
- **Why it's likely:** The audit notes admins have already been duplicating cues across `pro_mechanics[].content` and the lower half of `phase_breakdown[].description` under a `— Coaching cues —` separator (audit Tab 3). Two existing storage sites means migration must reconcile.
- **Mitigation (as shipped in Slice 2):**
  1. Migration is **read-only on `pro_mechanics`** during 1c.1; the new `phase_breakdown[].coaching_cues` field is populated via per-phase admin confirmation.
  2. Side-by-side render in `MigrateCoachingCuesModal` for every phase: legacy mechanics text, legacy inline-description block, and proposed new cue value all visible. Admin must explicitly confirm attribution before any write occurs (no silent migration).
  3. **Atomic strip at confirmation time** (revised from original plan): on confirm, `applyConfirmedCues` writes `coaching_cues` AND removes the `— Coaching cues —` separator block from `phase_breakdown[].description` in the same transaction. This closes the double-render window where slice 1's `phase_context` mode=full would otherwise emit cue text twice (once from `coaching_cues`, once from the inline block) until 1c.2 ships. Renderer-side dedup was rejected as more complex and higher failure surface than atomic strip.
  4. Lifecycle column `coaching_cues_migration_status` (`pending` → `in_progress` → `confirmed`, sticky-confirmed) tracks per-node progress; banner suppression on Phases-tab post-confirmation.
  5. Risk being mitigated remains **content misattribution**, which the side-by-side review continues to address. Post-confirmation behavior is now "atomic strip + new field populated" rather than the originally-planned "additive only." 1c.2 inherits a smaller surface: only column drop (`pro_mechanics` + cleanup of CHECK constraints from slice 1) — description-strip work is done.
- **Trigger to pause:** Any node where the count of detected sections in `pro_mechanics` doesn't equal the count of phases in `phase_breakdown`. (For Slant specifically: pattern is empirically 5 × INLINE_ONLY — `pro_mechanics` is empty — so the bulk-confirm-all shortcut does not apply and the admin must confirm 5 phases individually. This is the helper behaving correctly for the data shape, not a defect.)
