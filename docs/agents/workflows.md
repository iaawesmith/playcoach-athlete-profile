# Common Workflows

How to do recurring multi-step things in this repo without re-deriving the steps every time. When a workflow you're doing isn't here, consider adding it.

---

## Running a verification script

Verification scripts live in `scripts/verification/` (post-Pass 3e move; currently `scripts/slice*.ts`). Each script has a `// VERIFIES:` header naming the risk or finding it certifies, and a `// RECIPE:` block describing the steps.

```bash
bun run scripts/verification/<script>.ts
```

Read the `// RECIPE:` header before running so you know what the expected output is and what divergence means. Recipes that live in code with a backlink stay current; recipes that live in prose drift (process learning from F-SLICE-E-3).

---

## Drafting a slice outcome

Slice outcomes capture the result of a bounded unit of work shipped during a phase.

1. Copy [`do../templates/slice-outcome.md`](../templates/slice-outcome.md) (created in Pass 3f) to `docs/process/phase-<phase>-slice-<slug>-outcome.md`.
2. Populate frontmatter (`slice_id`, `status`, `date`, `related_risks`, `related_adrs`, `verification_script`).
3. Fill the standard sections: scope, what shipped, what didn't, verification, decisions made (link to ADRs), follow-ups.
4. Add the slice to the phase's roadmap entry in `docs/roadmap.md`.
5. If new risks surfaced, add them to the risk register (see workflow below).

---

## Registering a new risk or finding

1. Pick the next available ID. Risks: `R-NN` (next sequential). Findings: `F-SLICE-X-N` (next sequential within the originating slice).
2. Create `docs/risk-register/<ID>-<kebab-slug>.md` with the standard frontmatter (see [`../risk-register/_schema.md`](../risk-register/_schema.md)).
3. Append a row to the appropriate table in [`../risk-register/INDEX.md`](../risk-register/INDEX.md).
4. If the new entry references existing entries, update both `related_entries` lists (the new entry → others; others → the new entry).
5. If the entry surfaces an architectural decision, also create an ADR (see workflow below) and link it via `related_adrs`.

**IDs are never renumbered.** A closed risk keeps its ID forever.

---

## Splitting or superseding an investigation doc

Investigation docs (`docs/investigations/*` post-Pass 3a, currently top-level `docs/`) sometimes get superseded when their findings are absorbed into the risk register or when the original framing is reframed.

1. Insert a status banner at the top of the original doc:

   ```md
   > **Status:** Superseded. Findings absorbed into [`<target>`](<target>) under `<ID>`. Retained for historical context.
   ```

2. Do **not** delete the original doc. Investigation docs are reasoning artifacts; they retain value as a record of how a conclusion was reached.
3. Cross-link from the absorbing doc back to the investigation if the investigation contains detail not preserved in the absorption.

---

## Creating an ADR

When a meaningful architectural decision is made (path chosen over alternatives, tolerance set, scope boundary drawn), capture it as an ADR.

1. Pick the next sequential `NNNN` (zero-padded) by checking `docs/adr/`.
2. Copy `docs/adr/template.md` (or a variant from `docs/adr/templates/` if applicable) to `docs/adr/NNNN-<kebab-slug>.md`.
3. Populate frontmatter: `id`, `title`, `status` (`proposed` | `accepted` | `superseded`), `date`, `related_risks`, `superseded_by` (if applicable).
4. Fill standard sections: Context, Decision, Alternatives Considered, Consequences.
5. Cross-link from any risk register entries that contributed to the decision.

ADRs are short. Most fit on a screen.

---

## Renaming or moving a doc (R2 stub policy)

See [`conventions.md` § File moves & stubs](conventions.md#file-moves--stubs-r2-stub-policy) for the policy. Operational steps:

1. Decide whether the doc qualifies for a stub (heavy-traffic only).
2. If yes:
   - Create the new file at the new path.
   - Replace the old file's contents with a redirect stub.
   - Add an entry to the next phase's prep backlog stub-cleanup queue.
3. If no:
   - Move the file (`git mv` semantics — but this repo uses Lovable's file tools, so create new + delete old in same pass).
4. Sweep for in-repo references (`rg <old-path>`) and update each.
5. Confirm zero broken backlinks.

---

## Re-running the calibration audit aggregation

After a new ground-truth clip is added or a canonical-clip verification run completes:

```bash
bun run scripts/aggregate-calibration-audit.ts
```

Script reads `docs/reference/calibration/*.yaml` to discover registered clips, queries `athlete_lab_results.result_data.calibration_audit` for the upload_ids tied to those clips, and rewrites `docs/reference/calibration-audit-rollup.csv` deterministically.

If row count changes unexpectedly: this is information about pipeline state, not a script failure. Investigate the divergence and consider logging a finding (see "Registering a new risk or finding" above).

---

## Regenerating the tab inventory

After any change to the `TABS` array in `src/features/athlete-lab/components/NodeEditor.tsx`:

```bash
bun run scripts/generate-tab-inventory.ts
```

Script regenerates the auto-section of [`docs/architecture/athlete-lab-tab-inventory.md`](../architecture/athlete-lab-tab-inventory.md) (post-Pass 3a, currently `docs/athlete-lab-tab-inventory.md`) between the marker comments. Manual descriptions live in the sidecar `docs/architecture/tab-inventory-content.yaml` and are preserved across regenerations.

If the regenerated section diverges materially from the existing content, surface the diff before overwriting — manual content may have drifted from the TABS array.

---

## Cross-reference integrity sweep

After any rename, move, or split:

```bash
grep -rln "<old-name>" --include='*.md' . | grep -v node_modules | grep -v .git
```

Every hit is either:
- The new file at the new path (expected)
- A historical artifact that should not be retroactively edited (audit docs, ship records, ADRs that captured the old name as part of a decision context)
- A live backlink that needs updating (bug — fix in same pass)

Document which category each hit falls into when surfacing the verification.

---

## Pass execution (during cleanup phases)

When executing a multi-pass cleanup plan:

1. Mirror passes into the task tracker before starting (one parent task per pass; sub-tasks for internally distinct work).
2. Mark pass `in_progress` before first write.
3. Execute writes in parallel where possible (independent files).
4. After each pass: surface deliverable (file list, cross-reference check, structure diff, prior-passes-intact confirmation).
5. Mark pass `done` only after verification passes.
6. Halt and surface immediately if any halt condition triggers — do not silently work around it.
