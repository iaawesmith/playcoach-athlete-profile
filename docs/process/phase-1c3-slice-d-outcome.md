---
slice_id: 1c.3-D
title: Tab consolidation 13 → 8 + R-05 mitigation + 5-key knowledge_base merge
date_shipped: 2026-04-29
status: shipped
related_risks: [R-05, R-12]
related_findings: [F-OPS-4, F-SLICE-E-1]
related_adrs: []
---

# 1c.3-D — Tab consolidation 13 → 8 + R-05 mitigation + 5-key knowledge_base merge

## Goal

Per Phase 1c.3 plan v2: collapse the editor's `TABS` array from 13 entries to either 8 or 9 (criterion-gated). Final tab set: **Basics, Videos, Phases, Metrics, Reference, LLM Prompt, Badges, Run Analysis** (8 tabs). Training Status folded into Basics; Pipeline Config inlined as a sub-section within Basics. Filming Guidance, Camera, Scoring, Errors, Checkpoints folded into their consolidated parents.

R-05 mitigation: ship the consolidation banner with explicit redirect list + URL-hash redirect map + HelpDrawer internal redirect map so admins whose bookmarks / muscle memory point at retired tabs are routed cleanly without empty-section confusion.

## Criterion check (resolved before execution)

| Condition | Required | Actual | Result |
|---|---|---|---|
| `det_frequency` triplet content fits within Basics without overwhelming it | Both must hold | Yes — three controls, single horizontal block | ✅ |
| No new det_frequency content surfaces during execution that re-justifies a separate tab | F-SLICE-E-1 stays open, no scope expansion | Confirmed — no new det_frequency content surfaced | ✅ |

**Final count: 8 tabs.**

## Q1–Q6 + B/C/F/G/H/I decisions resolved before / during execution

### Pre-execution decisions (Q1–Q6)

- **Q1 — Plan-vs-data key naming:** Treat plan-doc approximations as typos. Merge along **actual** key names (`checkpoints` → `phases`, `camera` → `reference`). Renaming for cosmetic conformance is migration churn.
- **Q2 — Training Status rebrand label:** **Pipeline Config** (sub-section heading inside Basics).
- **Q3 — `segmentation_method` gating value for Checkpoints:** verified by sampling. Distinct values present: `"proportional"` and `"checkpoint"`. Gate Checkpoints sub-section visibility on `segmentation_method === "checkpoint"`.
- **Q4 — `knowledge_base` key shape:** verified `{ id, sectionTitle, content }` array element shape across all 5 source keys. No element-shape variations.
- **Q5 — Disposition for `kb.overview` / `kb.test`:** deferred to 1c.3-F retrospective (V-1c.3-08 backlog).
- **Q6 — R-05 banner content shape:** explicit redirect list (not conceptual prose).

### Integration-decision halts (B1, B2, F, G, H, C, I) resolved during execution

A second halt class surfaced **during** execution at integration boundaries — distinct from pre-execution decision-cluster (which surfaces before execution). All defaults approved:

- **B1 — Training Status readiness category:** keep as separate category in `NodeReadinessBar`, route `tab: "basics"`. 20% weight allocation preserved; click target adjustment, not category restructure.
- **B2 — Camera readiness category:** keep separate from Reference Calibration; both route to `tab: "reference"`. Categories measure different concerns (capability requirements vs pixel calibration).
- **F — Checkpoints sub-section visibility:** fully hide when `segmentation_method !== "checkpoint"`, per plan.
- **G — Reference Video Quality Guide overlap with Filming Guidance:** leave + flag as **V-1c.3-09** for 1c.3-E disposition.
- **H — `generateTabMarkdown` consolidation:** combine on consolidated tabs. Copying Metrics → metrics+scoring+errors markdown; Reference → reference+camera; Phases → phases+checkpoints (when checkpoint-segmented); Basics → basics+pipeline-config.
- **C — DetectionFrequencyControls extraction:** inline into Basics tab branch as a single block under a "Pipeline Config" heading. No standalone component extraction.
- **I — `helpTabKey` stale-value bounce:** coerce in `useEffect` alongside the existing tab-key bounce, using the same `HASH_REDIRECT_MAP`. Prevents type errors when a stale persisted helpTabKey points at a retired key.

## Two F-OPS-4 halts during DB work

### Halt 1 — Constraint discovery (sub-pattern 1, replay)

The 5-key knowledge_base merge migration's first iteration enumerated the source keys correctly but didn't enumerate the existing `disposition` / `slice` CHECK constraints on the backup table for the merge-time backup row. Standard 1c.3-B precedent applied: enumerated all CHECK constraints via `pg_constraint` query, mapped values to allowed enum, retried clean.

### Halt 2 — Transactional correctness on multi-source merges (sub-pattern 6, NEW)

Genuinely new shape. Two source keys (`scoring`, `errors`) merged into the same target (`metrics`). The first iteration looped per-source-key with an in-loop UPDATE-then-reread pattern. The second source merge re-read a stale snapshot of `metrics` taken **before** the first source's UPDATE landed, silently overwriting the first merge.

- **Detection:** post-merge length assertion. Expected 30 sections in `metrics` (13 base + 8 scoring + 9 errors); actual 25 (13 base + 12 errors only — 8 scoring sections lost).
- **Recovery:** rolled back to slice backup (atomic backup-before-merge pattern from ADR-0007), re-executed with a `v_kb` PL/pgSQL local accumulator that carried merged state across all iterations and committed once at the end.
- **Final verification:** `basics` (13), `phases` (19), `metrics` (30), `reference` (16). Source keys (`scoring`, `errors`, `camera`, `checkpoints`, `training_status`) dropped.

This sub-pattern is **algorithmic**, not methodological. No amount of pre-execution sweep would have caught it; the failure mode is read-during-write transactional shape. Remediation: future migrations with multi-source-to-single-target patterns must use accumulator pattern + post-condition invariant assertions. Captured as F-OPS-4 sub-pattern 6.

## Code refactor scope

### `src/features/athlete-lab/components/NodeEditor.tsx`

- `TABS` array shrunk 13 → 8 (basics, videos, phases, metrics, reference, prompt, badges, test).
- `CRITICAL_TABS` updated to `["metrics", "phases", "prompt", "basics"]`.
- `ADVANCED_TAB_KEYS` / `showAdvancedTabs` state / UI toggle / advanced-tabs localStorage retired entirely. Stale storage key left in place (harmless).
- `HASH_REDIRECT_MAP` added (10 entries) for legacy URL hash anchors and stale stored tab keys.
- `useEffect` hooks added: coerce stale persisted `tab` value, coerce URL hash anchor (with strip-after-redirect to prevent bounce on render), coerce stale persisted `helpTabKey`.
- Sub-editors inlined: Metrics tab now hosts Scoring + Common Errors sub-sections; Reference hosts Filming Guidance (CameraEditor); Phases gates Checkpoints sub-section on `segmentation_method === "checkpoint"`; Basics hosts Pipeline Config (det_frequency triplet) inline.
- `ConsolidationRedirectBanner` mounted above tab row.

### `src/features/athlete-lab/utils/nodeExport.ts`

- `TabKey` shrunk to 7 markdown-emitting tabs; `LegacyTabKey` added for stale callers.
- `TAB_GENERATORS` updated to combine merged sub-section markdown:
  - `metrics` → metrics + scoring + errors
  - `reference` → reference + camera
  - `phases` → phases + checkpoints (when `segmentation_method === "checkpoint"`)
  - `basics` → basics + pipeline-config
- `generateTabMarkdown` redirects legacy keys to consolidated parents before lookup.
- `generateFullNodeMarkdown` `tabOrder` shrunk to 7 keys (down from 12 with retired entries). **Latent runtime bug fixed** — old array referenced retired keys; with `strict: false` in tsconfig, TypeScript didn't catch it. `TAB_GENERATORS[key]` would have returned `undefined` for retired keys, crashing on call. Surfaced in the post-execution reference sweep.

### `src/features/athlete-lab/components/NodeReadinessBar.tsx`

- `TabKey` union shrunk to 8.
- Training Status category routes to `tab: "basics"`.
- Camera category routes to `tab: "reference"`.
- Reference Calibration category continues to route to `tab: "reference"`.

### New files

- `src/features/athlete-lab/components/ConsolidationRedirectBanner.tsx` — one-time per-browser banner with explicit redirect list + Got-it dismiss; localStorage key `athleteLab.consolidationBannerDismissed.v1`.

### `src/features/athlete-lab/components/HelpDrawer.tsx`

- `KB_REDIRECT_MAP` + `resolveTabKey` helper added.
- `tabKey` prop coerced through `resolveTabKey` before `knowledgeBase[tabKey]` lookup. Sections never silently empty when caller passes a retired key.

## R-05 mitigation shipped

R-05 status: **open → mitigated**.

- ✅ ConsolidationRedirectBanner shipped with explicit redirect list (5 retired tabs → consolidated parents + named sub-section).
- ✅ Hash-anchor redirects active (`HASH_REDIRECT_MAP` in NodeEditor).
- ✅ HelpDrawer internal redirects active (`KB_REDIRECT_MAP` in HelpDrawer).
- ✅ `helpTabKey` stale-value coercion active.

Trigger to pause (admin support thread reports >1 "I lost my X field" within 48h) remains the same.

## Verification

| Check | Method | Outcome |
|---|---|---|
| TypeScript build | `npx tsc --noEmit` | ✅ exit 0, no output |
| Knowledge base merge correctness | Length assertion per consolidated key | ✅ basics(13), phases(19), metrics(30), reference(16) |
| Source keys dropped | `jsonb_object_keys` on athlete_lab_nodes | ✅ scoring/errors/camera/checkpoints/training_status absent |
| Tab inventory regenerated | `npx tsx scripts/generate-tab-inventory.ts` | ✅ "wrote …(8 tabs, 0 hidden)" |
| Reference sweep for retired tab keys outside redirect maps | `rg` for retired strings across `src/` | ✅ remaining hits are unrelated enum values, comments, or column names (not tab keys); `nodeExport.ts:436` `tabOrder` runtime bug discovered + fixed in same sweep |
| F-SLICE-E-5 stays resolved | Status check | ✅ resolved (1c.3-C) |
| F-SLICE-E-1 stays open | Criterion-check confirmation | ✅ open; no new det_frequency content surfaced |

## Findings annotated

- **[F-OPS-4](../risk-register/F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md)** — fourth annotation added. Catalogue now lists **six distinct sub-pattern shapes**:
  1. Constraint discovery
  2. Shape discovery
  3. Location discovery
  4. Stated-vs-actual scope (structural)
  5. Pre-execution decision-cluster + integration-decision halt (sibling halt categories — pre-exec vs during-exec at integration boundaries)
  6. Transactional correctness on multi-source merges (genuinely new shape; algorithmic remediation, not methodological)

  Sub-pattern 6 is the most significant evolution: it sits **alongside** the F-OPS-4 methodological remediation rather than within it. The remediation is the accumulator pattern + post-condition invariant assertions, not "sweep harder."

## Risks closed / mitigated

- **R-05** — open → **mitigated**. ConsolidationRedirectBanner + hash-anchor redirects + HelpDrawer internal redirects all shipped.
- **R-12** — remained closed (closed in 1c.3-B). This slice **completes the broader knowledge_base consolidation pattern** R-12 originally named — R-12 closed the Mechanics-only case; 1c.3-D extended the same merge pattern to 5 additional source keys. Cross-link added.

## Decisions deferred

- **V-1c.3-07** — Wire `score_bands` consumer into athlete-facing UX (R-11 mitigation tracking). Phase 2/3 owner.
- **V-1c.3-08** — Disposition decision for `kb.overview` and `kb.test` keys. Deferred to 1c.3-F retrospective per Q5.
- **V-1c.3-09** — Reference Video Quality Guide overlap with Filming Guidance section. Deferred to 1c.3-E disposition per integration-decision G.

## Process observation

This slice surfaced **two halt categories simultaneously**: pre-execution decision-cluster (Q1–Q6, the 1c.3-C shape) and integration-decision halts (B1/B2/F/G/H/C/I, a new sibling shape). Plus the genuinely new transactional-correctness sub-pattern from the 5-key merge.

The vocabulary refinement is useful: cleanup-shaped slices that **consolidate UI surfaces** will likely surface integration-decision halts; cleanup-shaped slices that **remove broken surfaces** will likely surface scope-decision halts. Both belong in the F-OPS-4 family.

The transactional-correctness sub-pattern is structurally different from the other five: it's **algorithmic, not methodological**. Worth preserving as the strongest evidence yet that F-OPS-4 covers a family of related-but-distinct failure modes, not a single root cause.

## Cross-links

- Slice plan: Phase 1c.3 plan v2 + clarifications.
- Predecessor slice: [1c.3-C outcome](phase-1c3-slice-c-outcome.md).
- Risk-register entries mitigated: [R-05](../risk-register/R-05-tab-consolidation-hides-existing-draft-state-content-from-admins.md).
- Risk-register entries cross-linked: [R-12](../risk-register/R-12-mechanics-tab-deletion-strands-knowledge-base-sub-sections-keyed-to-mechanics.md) (closed in 1c.3-B; this slice completes the broader pattern).
- Risk-register entries annotated: [F-OPS-4](../risk-register/F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md).
- Tab inventory: [`docs/architecture/athlete-lab-tab-inventory.md`](../architecture/athlete-lab-tab-inventory.md) — regenerated, 8 tabs.
