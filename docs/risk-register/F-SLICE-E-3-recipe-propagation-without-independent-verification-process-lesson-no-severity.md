---
id: F-SLICE-E-3
title: Recipe propagation without independent verification (process lesson, no severity)
status: open
severity: none
origin_slice: TODO
origin_doc: TODO
related_adrs: []
related_entries: []
opened: 2026-04-26
last_updated: 2026-04-26
---
# F-SLICE-E-3 — Recipe propagation without independent verification (process lesson, no severity)

- **Logged:** 2026-04-26
- **Finding:** During Slice E plan-mode iteration, the hash `34a87126…` was propagated through approval messages by the executing agent without independent reproduction against its source upload. When E.0 verification began, the agent first hashed the wrong upload (`a164c815`, which is in Group B) and incorrectly concluded the recipe was wrong; the actual issue was wrong-upload selection. Both errors were caught by Option C scan.
- **Process correction adopted:** Any baseline hash cited in approval messages must be independently reproduced against its source upload before propagation. "Verifiable baselines or no baseline."
- **No code or data impact.** Documented as a process lesson.
