---
id: F-OPS-6
title: Verification deferral across slice boundaries
status: open
severity: none
origin_slice: PHASE-2A
origin_doc: docs/process/phase-2a-slice-b1-outcome.md
related_adrs: [ADR-0005, ADR-0006]
related_entries: [F-OPS-3, F-OPS-4, F-SLICE-E-3]
opened: 2026-06-03
last_updated: 2026-06-03
---

# F-OPS-6 — Verification deferral across slice boundaries

## Observation

A slice ships its verification obligation **into** a successor slice that does not run it. Both slices ship. The verification check evaporates at the boundary. Neither slice's outcome doc carries a record of the missing check, because each one points at the other as the place it would land.

This is structurally distinct from F-OPS-3 (deferred work shipped earlier creates plan-vs-state drift) and F-SLICE-E-3 (recipe propagation without independent verification). Both adjacent findings describe failures where work moved across a boundary; this one describes the failure where **verification** moves across a boundary while the work it was supposed to verify lands anyway.

## Surfacing instances

All three opened together during Phase 2a kickoff and surfaced together during the 2026-06-03 remediation conversation:

| Slice | Form of the failure |
|---|---|
| `PHASE-2A-SLICE-B1` | Outcome doc Verification section stated "End-to-end runtime verification … is deferred to B2, when the field is observable in `AnalyzeResponse`." Marked Shipped on 2026-06-03 without the runtime check. |
| `PHASE-2A-SLICE-B2` | Inherited the deferral from B1, did not run the check, marked Shipped on the same day. |
| `PHASE-2A-SLICE-A2` | Different face of the same pattern. The only numerical check ran against the n=1 dataset — the very inadequacy Track A exists to remediate. The verification did not "defer into a future slice" in the literal sense, but it deferred into a dataset state that does not yet exist, which is the same shape: the check evaporated at a boundary (n=1 → n=3) that hasn't been crossed. |

In all three cases the slice was marked Shipped before its actual shipping bar (per [`agents/testing-philosophy.md`](../agents/testing-philosophy.md) §4: verification is constitutive of shipping) was cleared.

## Impact

The Phase 2a instance recovered cheaply because the user surfaced it within the same day; the operator-run drift-band script ([`scripts/verification/slice2a_b1_drift_band.ts`](../../scripts/verification/slice2a_b1_drift_band.ts)) makes the missing B1/B2 check executable. The cost was one wasted plan-approval cycle and one false "shipped" claim in STATUS.md / roadmap.md.

The recurring cost, if the pattern is not registered: future slices that legitimately cannot run their verification in-slice will defer it forward, the successor will inherit the deferral, and the chain will compound until someone notices a phase has shipped on documentation alone. This is the F-SLICE-E-3 failure mode generalized from "recipe propagation" to "verification propagation."

## Rule (added 2026-06-03 to `agents/workflows.md`)

> **A slice may not defer its own verification into a future slice.** If the verification check cannot run within the slice's scope, the slice halts and the missing precondition becomes its own slice. "By inspection" is a defensible verification method for some claims (e.g., structural-only changes where runtime corroboration cannot exist yet, like B1's additive-field claim), and that case is preserved — but it must be named and bounded in the outcome doc, not phrased as a deferral.

Halt-as-feature applied to verification: the missing-check is treated as a halt condition, not a backlog item.

## Remediation

- **Per-instance (Phase 2a):** the operator-run drift-band script covers B1 and B2 together. A2's interim bar is methodology cross-check on the first clip admitting ≥2 references (may be addressable now via re-inspection of the n=1 clip; otherwise waits on intake). Tracked in [`STATUS.md`](../STATUS.md) under "Code-complete, verification pending."
- **Pattern-level:** the rule above is now in `workflows.md` Step 4 of slice-close. Future slices halt rather than defer.
- **Detection:** none mechanized yet. `check-roadmap-sync` validates presence of outcome-doc references, not the `status` field's truth. A future helper script could parse outcome-doc frontmatter for `status: code-complete-verification-pending` rows older than N days and surface them on each Phase 2a milestone, but is out of scope for the current remediation.

## Cross-links

- [`docs/process/phase-2a-slice-b1-outcome.md`](../process/phase-2a-slice-b1-outcome.md) — surfacing slice; carries the structural-vs-runtime verification split that informed the rule.
- [`docs/process/phase-2a-slice-b2-outcome.md`](../process/phase-2a-slice-b2-outcome.md) — second instance.
- [`docs/process/phase-2a-slice-a2-outcome.md`](../process/phase-2a-slice-a2-outcome.md) — third instance, different face (verification deferred into a dataset state).
- [`docs/agents/workflows.md`](../agents/workflows.md) § Drafting a slice outcome → Step 4.
- [F-OPS-3](F-OPS-3-deferred-work-shipped-earlier-creates-plan-vs-state-drift.md) — adjacent: work-deferral causing plan-vs-state drift.
- [F-OPS-4](F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md) — adjacent: inspection scope underestimation.
- [F-SLICE-E-3](F-SLICE-E-3-recipe-propagation-without-independent-verification-process-lesson-no-severity.md) — adjacent: recipe propagation without verification. F-OPS-6 generalizes from recipes to verification.
- [ADR-0005](../adr/0005-determinism-tolerance-1pct.md) — Option D bar; the standard B1/B2 must clear.
- [ADR-0006](../adr/0006-phase-ordering-metrics-before-ui.md) — phase-ordering principle (athletes don't see surfaces built on unverified work) — the deep reason verification is constitutive of shipping.
