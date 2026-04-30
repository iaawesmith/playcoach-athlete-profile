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

## Annotation — Phase 1c.3-D: integration-decision halt + transactional-correctness sub-pattern (2026-04-29)

PHASE-1C3-SLICE-D (tab consolidation 13→8) added two more sub-patterns to the family, bringing the catalogue to **six distinct shapes**:

### Sub-pattern 5 — Integration-decision halt

Distinct from both pre-execution sweep and pre-execution decision-cluster. Surfaced **during** code execution (not pre-execution) when the consolidation reached integration boundaries the plan hadn't pre-resolved. Seven sub-decisions (B1, B2, F, G, H, C, I) all centered on **how consolidated data behaves at integration points**: how the readiness bar should re-route categories that no longer have a 1:1 tab; how copy-tab markdown should compose now that several sub-sections share a tab; how the help drawer should resolve a stale tabKey; whether checkpoints sub-section should fully hide or grey out when the segmentation method doesn't gate it.

Distinguishing characteristics:
- Surfaces **during** execution at integration boundaries, not before
- Plan correctly identified **what** to consolidate, but couldn't pre-specify **how merged surfaces behave** at every consumer
- Each sub-decision is small (binary or 2-3-way choice) and locally optimal once made
- Aggregate cost of the halt is dominated by enumeration, not analysis

Useful planning vocabulary refinement:
- Cleanup-shaped slices that **consolidate UI surfaces** will likely surface **integration-decision halts**
- Cleanup-shaped slices that **remove broken surfaces** will likely surface **scope-decision halts** (the 1c.3-C shape)

### Sub-pattern 6 — Transactional correctness on multi-source merges

A genuinely new shape: **not inspection-scope failure, but multi-step operations against shared state**. Surfaced during the 5-key knowledge-base merge migration in 1c.3-D.

Concrete example: the migration merged 5 source `knowledge_base` keys into 4 target keys with HTML provenance headers. Two of the source keys (`scoring`, `errors`) merged into the same target (`metrics`). The first iteration of the migration looped per-source-key with an in-loop UPDATE-then-reread pattern. The second source merge re-read a stale snapshot of `metrics` taken **before** the first source's UPDATE landed, silently overwriting the first merge.

Caught by post-merge length assertion: expected 30 sections in `metrics` (13 base + 8 scoring + 9 errors), actual 25 (13 base + 12 errors only — the 8 scoring sections were lost). Recovery: rolled back to slice backup, re-executed with a `v_kb` PL/pgSQL local accumulator that carried merged state across all iterations and committed once at the end.

Distinguishing characteristics:
- Not "inspection missed something" — inspection enumerated all 5 source keys correctly
- Failure mode is **read-during-write transactional shape**, not enumeration
- Scales with multi-source-to-single-target patterns; trivially absent from 1:1 transformations
- Caught by post-condition length assertion, not by pre-execution inspection
- Remediation is **algorithmic** (accumulator pattern) not **methodological** (sweep harder)

**Discipline:** future migrations with multiple operations against the same column or row should use **accumulator pattern** with a single terminal commit, not in-loop UPDATE-then-reread. Post-merge invariant assertions (length, key-count, byte-equal of expected substrings) catch this class of defect when the algorithm slips.

### Updated evolution log

This finding has now evolved through **four explicit annotations across four slices**, surfacing **six distinct sub-pattern shapes**. The evolution itself is the strongest evidence that the methodological lesson is generalizable rather than slice-specific:

1. **1c.3-B (origin)** — three concrete examples establishing the family:
   - **(1) Constraint discovery** — pre-execution inspection enumerated one CHECK constraint, missed two more.
   - **(2) Shape discovery** — pre-execution inspection verified outer container, missed element-level shape (JSON serialization escaping).
   - **(3) Location discovery** — pre-execution inspection verified file existence, missed inline definition + downstream cascade.
2. **1c.3-A retroactive** — **(4) Stated-vs-actual scope** named as the F-OPS-4 default planning assumption for cleanup slices.
3. **1c.3-C** — **(5a) Pre-execution decision-cluster** named as a distinct halt category alongside pre-execution sweep. Sweep can be thorough yet still surface decisions the plan didn't specify.
4. **1c.3-D (this annotation)** — two additional shapes:
   - **(5b) Integration-decision halt** — sibling to pre-execution decision-cluster but surfaces **during** execution at integration boundaries, not before.
   - **(6) Transactional correctness on multi-source merges** — genuinely new shape; not inspection-scope failure, but algorithmic failure on shared-state writes. Stale-read defect on the 5-key knowledge_base merge (expected 30 sections, got 25; recovered via accumulator pattern + length assertion).

Sub-patterns 1–5 share a common methodological remediation (anticipate halts, plan for them as the system working correctly). Sub-pattern 6 has an algorithmic remediation (accumulator pattern + post-condition assertions) that exists alongside, not within, the methodological frame.

## Annotation — Phase 1c.3-E: taxonomy drift across slices over time (sub-pattern 7, NEW) (2026-04-30)

PHASE-1C3-SLICE-E (R-07 backup disposition audit) surfaced a **seventh distinct sub-pattern** that is structurally different from sub-patterns 1–6.

### Sub-pattern 7 — Taxonomy drift across slices over time

Sub-patterns 1–6 all concern failures **within a single slice's execution**. Sub-pattern 7 concerns failures that **emerge over time as the slice numbering scheme grows**: a single-letter slice tag (`B`, `C`, `D`, `E`) that was unambiguous when written becomes ambiguous when reused across phases.

**Concrete example:** Phase 1c.2-D backup rows tagged `slice='D'` on 2026-04-25 collided semantically with Phase 1c.3-D rows tagged `slice='D'` on 2026-04-29. Same value, different referents. The collision was invisible until the R-07 audit ran during 1c.3-E and asked "what slice produced this row?" — at which point the answer "D" was no longer unique. Remediated via taxonomy upgrade: single-letter form → `<phase>-<slice>` form, with the `alb_phase1c_slice_chk` CHECK constraint expanded to allow both legacy and new forms during the transition.

### Distinguishing characteristics

- **Temporal**, not execution-time. The drift exists in the data the moment a second slice reuses the letter; the **failure** only surfaces when something asks the data to disambiguate.
- **Silent until queried.** No constraint, assertion, or runtime check fires. Inspection passes. Only an audit that treats the tag as an identifier (rather than an opaque label) surfaces it.
- **Scope-bounded by the taxonomy's lifetime.** A short-lived identifier scheme never accrues drift; a long-lived one (e.g., a backup table retained indefinitely per ADR-0012) accrues it monotonically.
- **Cheap to fix at audit time, expensive to fix at restore time.** A normalization migration during a verification slice costs minutes; the same drift surfacing during an actual rollback would cost hours of disambiguation under pressure.

### Remediation

Different from sub-patterns 1–6:

| Sub-pattern | Remediation |
|---|---|
| 1 (constraint discovery) | Enumerate possible surfaces explicitly via `pg_constraint` |
| 2 (shape discovery) | Sample N elements at every level of nesting before composing assertions |
| 3 (location discovery) | `rg` for the symbol globally, not just the asserted file path |
| 4 (stated-vs-actual scope) | Expect scope underestimation; build halt-tolerance into slice plans |
| 5a (pre-execution decision-cluster) | Surface decisions before code edits; plan for both sweep and decision halts |
| 5b (integration-decision halt) | Enumerate consumer integration points alongside the data transformation |
| 6 (transactional correctness on multi-source merges) | Accumulator pattern + single terminal commit + post-condition invariant assertions |
| **7 (taxonomy drift across slices over time)** | **Use durable identifiers (full phase-slice form) from the start, OR audit periodically + remediate via normalization** |

### Discipline for future taxonomies

**Prefer durable identifiers over short forms even when the short form is unambiguous at write time.** Future-proof against expansion. When a short form has already shipped, schedule periodic audits (cost: low; verification slice cadence) rather than waiting for the drift to surface during a high-stakes operation (cost: high; under-pressure disambiguation).

### Updated evolution log

This finding has now evolved through **five explicit annotations across five slices**, surfacing **seven distinct sub-pattern shapes**:

1. **1c.3-B (origin)** — sub-patterns 1, 2, 3 (constraint / shape / location discovery)
2. **1c.3-A retroactive** — sub-pattern 4 (stated-vs-actual scope)
3. **1c.3-C** — sub-pattern 5a (pre-execution decision-cluster)
4. **1c.3-D** — sub-patterns 5b (integration-decision halt) and 6 (transactional correctness on multi-source merges)
5. **1c.3-E (this annotation)** — sub-pattern 7 (taxonomy drift across slices over time)

Sub-patterns 1–5 share a methodological remediation. Sub-pattern 6 has an algorithmic remediation. Sub-pattern 7 has a **structural** remediation: change the identifier scheme itself, OR establish an audit cadence that treats taxonomy as data subject to drift like any other.

## Annotation — Phase 1c.3-F: sub-pattern 1 replay + slice CHECK cadence observation (2026-04-30)

PHASE-1C3-SLICE-F (retrospective + V-1c.3-08 disposition) surfaced sub-pattern 1 again — the V-1c.3-08 merge migration first iteration failed on `alb_phase1c_slice_chk` because `1c.3-F` was not in the enumerated whitelist (the constraint had been extended in 1c.3-E to allow `1c.3-A`–`1c.3-E` but not `1c.3-F`). Constraint extension shipped as the first statement of the slice migration; second iteration clean.

**Not a new sub-pattern** — this is sub-pattern 1 (constraint discovery) replaying. **What is new is the cadence observation**: the enumerated-whitelist CHECK requires extension in *every* slice that writes a new backup row with a new slice tag. 1c.3-E extended it; 1c.3-F extended it again; every future backup-writing slice will need to extend it.

### Phase 2 prep recommendation

**Convert `alb_phase1c_slice_chk` to a pattern CHECK or a validation trigger** (per ADR-0008 — validation triggers over CHECK for non-immutable constraints). Two options:

1. **Pattern CHECK:** `CHECK (slice ~ '^(B|C|D|E|1c\.[0-9]+-[A-Z])$')` — accepts both legacy single-letter and durable phase-slice form without enumeration. Cheap, immutable.
2. **Validation trigger:** runs a regex match in PL/pgSQL; allows future logic (e.g., reject slice tags from already-closed phases).

Either eliminates the per-slice constraint-extension cadence permanently. Recommend option 1 (pattern CHECK) unless future taxonomy logic requires option 2.

This recommendation is captured in `docs/process/phase-1c3-retrospective.md` §J as a Phase 2 prep input.

- **F-OPS-3** — deferred work shipped earlier creates plan-state drift (related: trusting a prior plan assertion without re-verification)
- **F-SLICE-E-3** — recipe propagation without independent verification (related: trusting a prior recipe assertion without re-verification)

All three share the pattern: trusting a prior assertion without verifying against current reality.

## Cross-links

- `docs/process/phase-1c3-slice-b-outcome.md` — slice where sub-patterns 1–3 surfaced
- `docs/process/phase-1c3-slice-c-outcome.md` — slice where sub-pattern 5a surfaced
- `docs/process/phase-1c3-slice-d-outcome.md` — slice where sub-patterns 5b and 6 surfaced
- `docs/process/phase-1c3-slice-e-outcome.md` — slice where sub-pattern 7 surfaced
- `docs/process/phase-1c3-prep-backlog.md` V-1c.3-06, V-1c.3-10 — discovered work captured for future planning
- ADR-0007 — backup snapshot pattern (the table whose constraints surfaced examples 1 and the third unenforced constraint)
- ADR-0012 — backup retention indefinite (the policy that creates the long-horizon drift surface sub-pattern 7 addresses)
