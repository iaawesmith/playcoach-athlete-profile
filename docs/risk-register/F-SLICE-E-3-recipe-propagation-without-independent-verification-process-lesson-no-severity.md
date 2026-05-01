---
id: F-SLICE-E-3
title: Recipe propagation without independent verification (process lesson, no severity)
status: open
severity: none
origin_slice: 1c.2-Slice-E
origin_doc: docs/process/phase-1c2-slice-e-outcome.md
related_adrs: []
related_entries: []
opened: 2026-04-26
last_updated: 2026-04-26
---

# F-SLICE-E-3 — Recipe propagation without independent verification (process lesson, no severity)

## Related findings (methodological triad)

This finding is one face of a methodological triad. F-OPS-3, F-OPS-4, and F-SLICE-E-3 each describe a distinct failure mode of one underlying discipline: **trusting a prior assertion without re-verifying against current reality**. [F-OPS-3](F-OPS-3-deferred-work-shipped-earlier-creates-plan-vs-state-drift.md) covers plan-vs-state drift; [F-OPS-4](F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md) covers pre-execution inspection scope underestimating reality; F-SLICE-E-3 covers recipe propagation without independent verification.

- **Logged:** 2026-04-26
- **Finding:** During Slice E plan-mode iteration, the hash `34a87126…` was propagated through approval messages by the executing agent without independent reproduction against its source upload. When E.0 verification began, the agent first hashed the wrong upload (`a164c815`, which is in Group B) and incorrectly concluded the recipe was wrong; the actual issue was wrong-upload selection. Both errors were caught by Option C scan.
- **Process correction adopted:** Any baseline hash cited in approval messages must be independently reproduced against its source upload before propagation. "Verifiable baselines or no baseline."
- **No code or data impact.** Documented as a process lesson.
