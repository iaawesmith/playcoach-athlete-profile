# Phase 1c.2 — det_frequency Resolution Snapshot

> **Status:** Superseded. Snapshot captured in support of risk `R-06` resolution. R-06 is closed; consult the risk register for current state. Retained for historical context.

**Captured:** 2026-04-25 (pre-Slice-A baseline)
**Purpose:** Audit trail of admin intent at the moment `det_frequency` (root) is collapsed into the per-scenario columns. Captures what each node's resolution chain looked like _before_ Slice B's UPDATE persists the resolved values back into `det_frequency_solo` / `det_frequency_defender` / `det_frequency_multiple`.
**Finding:** Finding 1 from plan review.

## Method

Query against `athlete_lab_nodes` snapshotting:
- `det_frequency` (root, default 7)
- `det_frequency_solo`, `det_frequency_defender`, `det_frequency_multiple` (scenario overrides, nullable)
- Resolved value per scenario = `COALESCE(scenario_override, det_frequency_root, 7)`

Resolution rule (matches edge function lines 1111–1141):
```
resolved_solo      = det_frequency_solo      ?? det_frequency_root ?? 7
resolved_defender  = det_frequency_defender  ?? det_frequency_root ?? 7
resolved_multiple  = det_frequency_multiple  ?? det_frequency_root ?? 7
```

## Snapshot

| Node | id | det_frequency_root | det_frequency_solo | det_frequency_defender | det_frequency_multiple | resolved_solo | resolved_defender | resolved_multiple |
|---|---|---|---|---|---|---|---|---|
| Slant | `75ed4b18-8a22-440e-9a23-b86204956056` | 7 | 2 | 1 | 1 | 2 | 1 | 1 |

**Total nodes:** 1 (Slant only — all other nodes deleted in Phase 1c.1 cleanup)

## Resolution Chain — Slant

- **Solo scenario:** `det_frequency_solo = 2` is non-null → resolved value `2`. Root value (7) is **shadowed** and never used at runtime.
- **Defender scenario:** `det_frequency_defender = 1` is non-null → resolved value `1`. Root shadowed.
- **Multiple scenario:** `det_frequency_multiple = 1` is non-null → resolved value `1`. Root shadowed.

## Implications for Slice B

1. **Safe to drop `det_frequency` (root) in Slice E** — for the only existing node, the root is shadowed in all three scenarios. No runtime behavior change when the column is removed.
2. **Slice B pre-step UPDATE is a no-op for Slant** — the COALESCE already resolves to the existing scenario column values; no new persistence needed. The UPDATE statement is still safe to run (idempotent), but it will not change any values for the current dataset.
3. **R-06 assertion will trivially pass** for Slant: pre-collapse resolved values `(2, 1, 1)` will equal post-collapse persisted values `(2, 1, 1)`.

## Audit Note

This snapshot is the durable record of admin intent at collapse time. If a future engineer wonders "was the root `det_frequency = 7` ever the effective value for Slant in production?", the answer captured here is **no** — all three scenarios had explicit overrides authored by admin before Phase 1c.2 began. The root default served only as a hypothetical fallback that was never exercised.
