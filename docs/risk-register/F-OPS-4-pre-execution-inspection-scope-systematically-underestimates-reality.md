---
id: F-OPS-4
title: Pre-execution inspection scope systematically underestimates reality
status: open
severity: none
origin_slice: 1c.3-B
opened: 2026-04-29
last_updated: 2026-04-29
classification: process-lesson
---

# F-OPS-4 — Pre-execution inspection scope systematically underestimates reality

## Observation

Slice 1c.3-B surfaced **three distinct examples** of the same root-cause family during a single slice's execution. Each example was a case where pre-execution inspection had a narrower scope than reality, and each surfaced as a halt-and-decide point during execution.

### Example 1 — Constraint discovery (V-1c.3-02 → V-1c.3-03)

Pre-execution inspection enumerated the `disposition` CHECK constraint on `athlete_lab_nodes_phase1c_backup` (caught: my planned `merged_into_phases` value was invalid). The fix mapped to `relocated`. But execution then surfaced a **second** CHECK constraint (`alb_phase1c_slice_chk`) restricting `slice` values to `B|C|D|E` — my planned `'1c.3-B'` was rejected. A **third** constraint (`alb_phase1c_pattern_chk` on `audit_pattern`) existed but did not trigger because that field was left NULL.

**Lesson:** enumerate **all** CHECK constraints on write-target tables via `pg_constraint` query, not just constraints suspected to apply. A 3-line query catches all three constraints at once:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = '<target_table>'::regclass AND contype = 'c';
```

### Example 2 — Shape discovery (V-1c.3-04)

Pre-execution inspection verified the source data outer container existed (mechanics array of 3 sections, phases array of 6 sections, both on Slant node). The merge migration's substring assertion compared raw text content against the JSON-serialized phases array — and failed because JSON serialization escapes `<`, `>`, `"`, and newlines, so raw text never matches.

**Lesson:** pre-execution inspection should sample array-element shapes (e.g., `SELECT jsonb_object_keys(elem) FROM ... LIMIT N`), not just confirm container existence. And verification assertions should compare extracted values (`elem->>'content'`) against source text, not against serialized JSON containers.

### Example 3 — Location discovery (V-1c.3-05)

The prep inventory and ADR-0015 asserted that `MechanicsEditor.tsx` was a separate file already deleted with zero imports. Pre-execution audit confirmed: no separate file, no separate-file imports. Execution then revealed the function was actually defined **inline** within `NodeEditor.tsx` (line 2180+), with 5 additional reference sites (validation block, dead JSX, prop passes, type imports). Beyond that, the inline function turned out to be a downstream consumer of `pro_mechanics` data still feeding an active migration subsystem (`MigrateCoachingCuesModal`, `migrateCoachingCues.ts`, `CoachingCuesMigrationBanner`) — a 6-file cascade well beyond the slice's stated scope.

**Lesson:** pre-execution inspection should `rg` for the **symbol** independently of file-existence assumptions. "File X deleted" does not imply "symbol exported from X is gone" — symbols can be redefined inline, re-exported elsewhere, or referenced through type-only imports.

## Meta-lesson

Each pre-execution inspection has an implicit scope. The pattern of failures here is that scope kept being **narrower than reality**:
- Inspection 1: enumerated one CHECK constraint, missed two more
- Inspection 2: verified outer container, missed element-level shape
- Inspection 3: verified file existence, missed inline definition + downstream consumers

Future discipline: **enumerate possible surfaces explicitly rather than letting scope follow from prior assumptions.** Concretely:
- For DB write targets: enumerate all CHECK / FK / UNIQUE constraints via `pg_constraint`
- For data shape: sample N elements at every level of nesting before composing assertions
- For symbol references: `rg` for the symbol globally, not just the asserted file path

## Remediation strategy

The remediation is **not** "inspect harder before every slice" — that's not realistic and would balloon every slice's pre-work indefinitely. The realistic remediation is:

**Expect pre-execution inspection scope to underestimate reality. Build halt-and-decide tolerance into slice plans. Treat halts during execution as the system working correctly.**

In Slice 1c.3-B, the three halts each prevented a worse outcome:
- V-1c.3-03 halt → prevented invented disposition values being committed (would have required cleanup migration)
- V-1c.3-04 halt → prevented committing mismatched merge with broken assertion logic (caught by atomic transaction rollback)
- V-1c.3-05 halt → prevented premature subsystem retirement without migration-completion verification (would have risked data loss for unmigrated nodes)

**The halts ARE the value, not inefficiency.** They surface what inspection missed. A slice that ships zero halts is either trivially-scoped or has invisible drift.

## Process observation

This finding evolved from one example to three within a single slice. The pattern of "same root-cause family, multiple distinct surfacings" is itself a signal that the methodological lesson is generalizable, not a one-off correction. Captured deliberately as a single finding (rather than three separate F-* entries) to preserve the connection.

## Annotation — Phase 1c.3-C: pre-execution decision-cluster sub-pattern (2026-04-29)

Process observation from PHASE-1C3-SLICE-C: this slice introduced a new halt pattern — **pre-execution decision cluster**. After the standard pre-execution sweep surfaced expanded scope (per F-OPS-4 standard discipline), a second halt surfaced before any code edits to resolve four sub-decisions (det_frequency scope, second readiness gate, dead helper cleanup approach, type cleanup) that the sweep raised but didn't answer.

Both halt patterns belong in the F-OPS-4 family but represent distinct planning postures:

- **Pre-execution sweep halt** — "inspection scope was narrower than reality"
- **Pre-execution decision halt** — "inspection surfaced decisions the plan didn't anticipate"

Pre-execution decision halt is structurally different — sweep was thorough, but the surfaced reality required scope decisions beyond what the plan specified. The remediation is the same (treat halts as system working correctly) but planning posture should anticipate both: pre-execution sweep AND pre-execution decision-cluster.

This is the third consecutive slice where actual scope exceeded planned scope. The pattern is now structural enough that future cleanup-shaped slices should plan for both halt types as standard, not exceptional.

### Evolution log

This finding has now evolved through three explicit annotations across three slices, which is itself worth preserving as evidence the methodological lesson is generalizable rather than slice-specific:

1. **1c.3-B (origin)** — three concrete examples of constraint+shape+location discovery establishing the family.
2. **1c.3-A retroactive** — "stated scope < actual scope" structural pattern named as the F-OPS-4 default planning assumption for cleanup slices.
3. **1c.3-C (this annotation)** — pre-execution decision-cluster sub-pattern named as a distinct halt category alongside pre-execution sweep.

## Same root-cause family

- **F-OPS-3** — deferred work shipped earlier creates plan-state drift (related: trusting a prior plan assertion without re-verification)
- **F-SLICE-E-3** — recipe propagation without independent verification (related: trusting a prior recipe assertion without re-verification)

All three share the pattern: trusting a prior assertion without verifying against current reality.

## Cross-links

- `docs/process/phase-1c3-slice-b-outcome.md` — slice where all three examples surfaced
- `docs/process/phase-1c3-prep-backlog.md` V-1c.3-06 — discovered work captured for future planning
- ADR-0007 — backup snapshot pattern (the table whose constraints surfaced examples 1 and the third unenforced constraint)
