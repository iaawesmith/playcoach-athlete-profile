# Repo + Information Architecture Audit

**Date:** 2026-04-26
**Scope:** Read-only audit of documentation organization, information architecture, future-state scaffolding, and creative/workflow opportunities. Findings only — no scaffolding created in this pass.
**Audience:** External agents (fresh Claude conversation, Claude Project, Claude Code, new contributor) joining this repo cold, plus the project owner deciding what to invest in next.
**Author posture:** opinionated, with reasoning. Self-critical of past choices including my own. Where I'm uncertain, flagged in §10.

---

## §1 — Executive summary

### Three biggest opportunities

1. **Promote the data dictionary pattern from one file to a discipline.** `docs/data-dictionary/fields.json` (110 fields, versioned, with status legend) is the only structured source-of-truth artifact in the repo and it is excellent. Almost every prose document — risk register, drift log, ground truth, tab inventory, slice outcomes — is a denormalized view of data that wants to be structured the same way. Converting 3-4 of them produces compounding leverage: agents read structured queries instead of paragraph-mining, and the existing prose can be auto-derived as views.

2. **Replace `README.md` and the `AGENTS.md` / `VISION.md` overlap with a navigable agent onboarding surface.** The current `README.md` is literally `TODO: Document your project here`. `AGENTS.md` and `VISION.md` partially duplicate each other (the bottom half of AGENTS is "LOVABLE — PROJECT KNOWLEDGE" which restates VISION). A 5-minute "land here, here's where everything lives" doc plus a real `docs/INDEX.md` would be the highest-leverage hour of work in the entire backlog. New agents are currently reconstructing context that should be served, not derived.

3. **Establish an ADR (Architecture Decision Record) directory and migrate the 6-8 buried decisions there.** The phase reorder, the Option A withdrawal, the ±1% determinism tolerance, the Slice E recovery scope reduction (delete Mechanics rather than patch), the indefinite backup retention — these are real architectural decisions with reasoning that currently live as preamble paragraphs inside larger prose docs. They will be re-litigated by every future agent who can't find them.

### Three biggest risks of doing nothing

1. **Phase 2 starts with the same context-loss tax 1c.2 paid.** The risk register is 47KB, the architecture audit is 43KB. A new session opens and either skims and misses critical context (F-SLICE-B-1 reframings, F-SLICE-E-2 bimodal hypothesis, the Phase 2/3 reorder) or spends an hour reading. Both outcomes shipped in this codebase already.

2. **The calibration ground-truth dataset stays at n=1 because adding clip #2 requires writing prose that conforms to the prose pattern of clip #1.** Structured CSV with a JSON metadata sidecar would let the next clip be added in 5 minutes; today it's a 30-minute writing exercise on top of the actual measurement. Prediction: dataset will not reach n=3 (the B2 pre-condition) on current trajectory.

3. **Permissive RLS (F-SEC-1) and missing error boundaries (F-OPS-2) are documented but easy to lose.** They're embedded in a Sev-2 risk register entry that gets re-read every few sessions. If the doc burden grows, attention will diffuse and Phase 3 will start without the gate having been remembered. A roadmap file pinning Phase 2 obligations as discrete milestones reduces this risk to near zero.

### Recommended overall approach

Three tiers, executable in order with each tier delivering value before the next starts:

- **Tier 1 (do now, ~2-3 hours of low-risk doc work):** README rewrite + `docs/INDEX.md` + `docs/glossary.md` + `docs/roadmap.md` extracted from risk register preamble. Pure consolidation of existing knowledge, zero net-new content. Pays off the next time anyone (you, me, an external agent) opens the repo cold.

- **Tier 2 (do next, ~4-6 hours, structural conversions):** Convert calibration ground-truth dataset and determinism drift log to structured formats (YAML or CSV+JSON). Establish `docs/adr/` with 6-8 backfilled decisions. Add `docs/agents/` onboarding folder. Pays off through Phase 2 work.

- **Tier 3 (defer until Phase 2 is in flight):** Metric registry, tier system scaffolding, event taxonomy, changelog automation. These pay off when the features they support are being built; building them now risks shape-mismatch with what Phase 2 actually needs.

Layer 4 ideas are evaluated separately in §5 — most are deferrable; 2-3 are worth folding into Tier 1.

---

## §2 — Layer 1 findings: documentation organization

### A. Folder structure

**Finding:** Flat `docs/` with 25 files and one subfolder (`data-dictionary/`). No grouping by lifecycle (current vs historical), topic (calibration vs admin UI vs process), or audience (agent vs human reader).

**Specifically:**
- 14 `phase-1c*-*` files mix slice outcomes, experiment writeups, baseline snapshots, and reference data (drift log, ground truth) at the same directory depth as long-lived architecture docs.
- `../investigations/claude-prompt-content-trace.md`, `../investigations/calibration-ppy-investigation.md`, `../investigations/release-speed-velocity-investigation.md`, `../investigations/first-real-test-diagnostic.md` — investigations that produced findings already absorbed into the risk register, but the investigation docs themselves remain at top level with no signal about their currency.
- `../reference/run-analysis-observability-audit-v2.md` has a `-v2` suffix with no v1 visible — implies a rename or a prior version was deleted. Either way the suffix is now noise.

**Recommendation:** Reorganize into `docs/architecture/`, `docs/process/` (slice outcomes, drift log), `docs/reference/` (ground truth, drift log, data dictionary), `docs/investigations/` (the four investigation docs, marked superseded if their findings are in the risk register), `docs/adr/` (new), `docs/agents/` (new). Do this as a single rename pass with stub redirects from the old paths if external links exist (none known).

### B. Documentation inventory

| File | Size | State | Notes |
|---|---|---|---|
| `AGENTS.md` | 9.7KB | Current | Half is real instructions, half duplicates VISION |
| `VISION.md` | 28KB | Current | Authoritative product brief |
| `README.md` | 30 bytes | **Stub** | Literal `TODO` placeholder |
| `docs/migration-risk-register.md` | 47KB | Current, growing | Mixes risks (R-*) and findings (F-*); no longer purely a risk register |
| `docs/athlete-lab-architecture-audit.md` | 43KB | Mostly current | Phase 1c.0 era; some sections superseded by end-state doc |
| `docs/athlete-lab-end-state-architecture.md` | 11KB | Current target | The "where we're going" doc |
| `docs/athlete-lab-tab-inventory.md` | 11KB | Current | Snapshot at close of 1c.2 |
| `docs/data-dictionary/fields.json` | (110 fields) | Current | The good example |
| `docs/calibration-ground-truth-dataset.md` | 10KB | Current, n=1 | Wants to be structured |
| `docs/calibration-ppy-investigation.md` | 6.6KB | Superseded | Findings absorbed into F-SLICE-B-1 |
| `docs/calibration-source-trace.md` | 6.3KB | Reference | Code-trace; ages with code |
| `docs/claude-prompt-content-trace.md` | 17KB | Reference | Same |
| `docs/first-real-test-diagnostic.md` | 17KB | Historical | Pre-1c.2 diagnostic; not clearly marked |
| `docs/mediapipe-capability-inventory.md` | 13KB | Current | Sibling of end-state arch |
| `docs/release-speed-velocity-investigation.md` | 5.3KB | Reframed | Original framing superseded; doc not updated to reflect F-SLICE-B1-2 reframe |
| `docs/run-analysis-observability-audit-v2.md` | 22KB | Current | `-v2` suffix is fossil |
| `docs/phase-1c1-slice2-outcome.md` | 7.8KB | Historical | Ship record |
| `docs/phase-1c1-slice3-outcome.md` | 6.9KB | Historical | Ship record |
| `docs/phase-1c2-baseline-slant-analysis.md` | 8.7KB | Reference | Baseline numbers |
| `docs/phase-1c2-camera-guidelines-preflight.md` | 4.1KB | Historical | Pre-flight check record |
| `docs/phase-1c2-determinism-drift-log.md` | 5.9KB | Current, append-only | Wants to be CSV |
| `docs/phase-1c2-determinism-experiment.md` | 27KB | Reference | The definitive determinism writeup |
| `docs/phase-1c2-detfreq-resolution-snapshot.md` | 2.8KB | Historical | Snapshot for R-06 |
| `docs/phase-1c2-diagnostic-snapshot-2026-04-26.md` | 22KB | Reference | Field-level snapshot |
| `docs/phase-1c2-slice-a-r04-assertion.md` | 0.8KB | Historical | Tiny ship record |
| `docs/phase-1c2-slice-b1-outcome.md` | 7.7KB | Historical | Ship record |
| `docs/phase-1c2-slice-d-outcome.md` | 8.0KB | Historical | Ship record |
| `docs/phase-1c2-slice-e-outcome.md` | 13KB | Historical | Ship record |
| `docs/phase-1c3-prep-backlog.md` | 3.5KB | Current | New, will grow |

**Total: ~367KB of prose across 25 files.** That's a medium-sized book. No agent reads it all; without an index, attention scatters.

**State markers missing.** No doc has a `Status: current | superseded | historical` frontmatter. State is implicit in filename or first paragraph, inconsistently.

### C. Coverage gaps

**Well-covered:**
- Calibration history, math, and ground-truth reasoning (almost over-covered)
- Phase 1c migration risks and mitigations
- Determinism investigation
- Field-level data dictionary (the JSON)

**Partial:**
- Athlete Lab admin tab structure (just got the inventory; no field-by-tab map distinct from `fields.json`)
- Edge function contracts (in code only; the request/response shapes for `analyze-athlete-video`, `admin-*`, `firecrawl-*` are not documented anywhere)
- Cloud Run service interface (Pydantic schema in `mediapipe-service/app/schema.py` is the only contract; no markdown summary)

**Missing:**
- Project-level README (literal stub)
- Glossary of PlayCoach-specific terms (Brand HQ, ProCard, Athlete Profile, ppy, det_frequency, Slice nomenclature, R-* vs F-* IDs, Phase 1c.X conventions)
- Architecture overview at the system level (how Brand HQ + Athlete Lab + Athlete Profile + Cloud Run + edge functions + Supabase fit together — the closest thing is `athlete-lab-end-state-architecture.md` but that's lab-scoped)
- Roadmap (phase plans live in risk register preamble)
- ADR / decision log
- Changelog
- Onboarding guide for new agents
- Per-tier (youth/college/pro) anything — the data model implies tiers, no doc defines them

### D. Stale content

- **`docs/calibration-ppy-investigation.md`** — its Recommendation B was the basis for Option A (delete `body_based`). F-SLICE-B-1 has now withdrawn Option A. The investigation doc still reads as if Option A is live. Should carry a `Superseded: see F-SLICE-B-1` banner or be archived.
- **`docs/release-speed-velocity-investigation.md`** — F-SLICE-B1-2 reframed the "single-sample lottery" hypothesis from confirmed to "needs verification." The investigation doc still presents the original confirmed-bug framing.
- **`docs/athlete-lab-architecture-audit.md`** — 734 lines. Sections about end-state are now duplicated/superseded by `end-state-architecture.md`. The audit value is in the *current-state* sections (Tabs 1-8 walkthrough) which remain useful.
- **`docs/run-analysis-observability-audit-v2.md`** — predates several Phase 2 reorder decisions; recommendations reference "Phase 3" in the old ordering even though the rest of the corpus was relabeled (worth a re-grep).
- **Phase numbering on `phase-1c*-*` filenames** — permanent fossil. The phase reorder relabeled prose content but filenames keep the old slice IDs forever. This is fine (slice IDs are historical references) but worth naming explicitly so no future agent tries to "fix" it.

### E. Naming consistency

**Filenames:**
- `../process/phase-1c1-slice2-outcome.md`, `../process/phase-1c2-slice-b1-outcome.md` — inconsistent separator placement (`slice2` vs `slice-b1`).
- `../reference/phase-1c2-detfreq-resolution-snapshot.md` (no `slice-X` prefix) sits next to `../process/phase-1c2-slice-d-outcome.md` (with prefix).
- `../reference/phase-1c2-diagnostic-snapshot-2026-04-26.md` is the only doc with a date in its filename.
- `../reference/run-analysis-observability-audit-v2.md` carries a version suffix; nothing else does.
- Topical docs (`calibration-*`, `mediapipe-*`, `claude-*`) use lower-kebab consistently — that's fine.

**Inside-doc identifiers:**
- `R-01` through `R-12` for risks, `F-SLICE-X-N` for findings, `F-OPS-N`, `F-SEC-N`. The dual scheme is not bad but `F-SLICE-E-5` and `R-12` look like different things and aren't (both are ledger entries with severity). Recommend folding into one ID space (`RISK-001` or similar) when migrating to ADR.
- Phase IDs (`Phase 1c.2 Slice D`) are well-formed and consistent.

### F. Index and navigation

**Finding:** No root entry point. New agents see `README.md = TODO`, then have to guess between `AGENTS.md` (instructions) and `VISION.md` (product). Once inside `docs/`, no doc index exists. Cross-references between docs are ad-hoc backlinks in prose ("see `docs/X.md` §3") with no machine-readable graph.

**Recommendation:** `docs/INDEX.md` with:
- "Start here" links by audience (new agent, fresh contributor, debugging a determinism issue, picking up Phase 2)
- One-line description of each doc with a status pill
- Cross-reference graph (or at least: which docs cite which)

### G. Architecture documentation

**Finding:** Single zoom level (Athlete Lab admin surface). No system-level "what runs where" diagram showing:
- Browser (React + Zustand) → Supabase Edge Functions → (a) Cloud Run MediaPipe service, (b) Supabase DB, (c) Lovable AI / Claude
- Storage flow (athlete-media bucket → analyze-athlete-video → result_data)
- Auth flow (or lack thereof — currently permissive)

**Interfaces:**
- Cloud Run interface defined in `mediapipe-service/app/schema.py` (Pydantic). Not echoed anywhere as markdown.
- Edge function interfaces undocumented except in code.
- Supabase JSONB column shapes documented in `fields.json` — good, but `result_data` shape (the calibration_audit substructure especially) is not.

### H. Glossary

**Finding:** None. PlayCoach-specific terminology is defined inline in whichever doc happens to introduce it first. A new agent encounters `ppy`, `det_frequency_solo`, `body_based vs static`, `Slice X.Y`, `Brand HQ`, `ProCard`, `Athlete Profile`, `Reference video`, `phase_context_mode = compact|full`, `R-XX`, `F-XX` — all without a single landing reference.

**Recommendation:** `docs/glossary.md` — one-liner definitions, link to the authoritative deep doc for each term. ~30-40 entries based on what I've seen across docs.

### I. Decision log

**Finding:** None. Major decisions exist but are paragraph-buried:
- Phase reorder (2026-04-26): preamble of risk register
- Option A (delete `body_based`) WITHDRAWN: F-SLICE-B-1 status block
- ±1% determinism tolerance (Option D): F-SLICE-E-2 decision block
- Indefinite backup retention (Default B): inline in end-state arch preamble
- Mechanics tab → delete-not-patch recovery: chat history; partially in slice E outcome
- "No new athlete UI in Phase 1c" (Default A): inline in end-state arch preamble
- Phase 2 = analysis quality before athlete UI: phase-ordering preamble (correctly applied)
- C.5 unified to edge-function `body_based` path (away from Cloud Run service-side): F-SLICE-B-1 finding addendum

These are the kind of decisions that get forgotten and re-debated. ADR format (one file per decision, status, context, decision, consequences) is the standard answer.

### J. Phase planning

**Finding:** Phase 2 and Phase 3 plans exist as ~10 lines of bullets in the risk-register phase-ordering preamble. There is no `docs/roadmap.md`, no per-phase plan doc, no Phase 2 breakdown beyond "2a world coordinates / 2b metric audits / 2c tier-aware scoring + operational obligations."

For comparison, Phase 1c got `mediapipe-capability-inventory.md` + `athlete-lab-end-state-architecture.md` + `migration-risk-register.md` *before* execution started. Phase 2 currently has nothing equivalent.

**Recommendation:** A lightweight `docs/roadmap.md` now (extract the existing bullets, add explicit ownership of the Phase 2 obligations), and a Phase 2 planning trio analogous to the 1c.0 trio when Phase 2 kicks off.

---

## §3 — Layer 2 findings: information architecture

For each information type: where it lives today, source-of-truth designation, structure recommendation, migration path, automation that becomes possible.

### 1. Calibration ground truth

- **Today:** `docs/calibration-ground-truth-dataset.md` (10KB prose with markdown tables). n=1 entry (slant-route-reference-v1).
- **Authority:** Single source. Good.
- **Recommendation: convert to structured.** YAML or JSON per-clip file under `docs/reference/calibration-ground-truth/` plus an aggregating `index.json`. Keep prose narrative for the Slant clip's measurement methodology because it's genuinely narrative (circle-fit reasoning, posture compression argument) — but the per-clip *measurements* should be structured.
- **Migration path:** One-time conversion of the existing entry. New entries use a template.
- **Automation unlocked:** Cross-clip regression (does `body_based` consistently under-report by N% across clips?), automated B2 pre-condition check ("≥3 clips spanning ≥2 contexts: not yet met"), feeding determinism drift log with cross-references.

### 2. Metric definitions

- **Today:** Scattered. Formulas live in `supabase/functions/analyze-athlete-video/index.ts`. Score bands live in `athlete_lab_nodes.score_bands` JSONB. Plausibility bounds live partly in `mediapipe-service/app/calibration.py` and partly nowhere. Athlete-facing labels live in node `key_metrics`. Known issues (e.g., Release Speed) live in F-SLICE-B1-2.
- **Authority:** Multiple competing places. No single doc per metric.
- **Recommendation: structured metric registry.** `docs/reference/metrics/<metric_id>.md` or single `docs/reference/metrics.json` with: id, label, formula (or pointer to code), units, score bands, plausibility bounds, known issues (FK to risk-register entry), test fixtures, last verified date.
- **Migration path:** Inventory all metrics currently computed by `analyze-athlete-video` (Plant Leg Extension, Hip Stability, Release Speed, Hands Extension, etc.); generate one stub per metric; backfill known content from risk register and node data.
- **Automation unlocked:** Phase 2b metric audits become checklist-driven; admin UI can read this directly to render "metric details" panels; consistency check between admin-displayed score bands and registry-defined bands.

### 3. Risk register findings

- **Today:** `docs/migration-risk-register.md` 47KB single file mixing R-* (forward-looking risks per slice) and F-* (post-hoc findings).
- **Authority:** Single. Quality is high. Format is the bottleneck.
- **Recommendation: split entries to one file per finding, keep a TOC.** `docs/risk-register/R-01-mechanics-coaching-cues.md`, etc., with frontmatter (`severity`, `phase`, `status`, `cross_refs`). Index file aggregates. Status updates touch a small file instead of editing a 47KB monster.
- **Migration path:** Mechanical split of existing file; preserve original IDs verbatim. Add frontmatter from the inline severity/phase/status text.
- **Automation unlocked:** Filter views ("show all Sev-2 open"), automated check that every closed finding has a "Status: closed" line, ADR backlinks, easier multi-edit when a finding is mitigated.

### 4. Phase progress and slice outcomes

- **Today:** One markdown per slice (`../process/phase-1c1-slice2-outcome.md`, etc.). Inconsistent shape — some have a Verification table, some have prose, some are 0.8KB and others 13KB.
- **Authority:** Single per slice. Ordering is implicit in filename.
- **Recommendation: keep per-slice markdown, standardize a frontmatter + section template.** Required sections: Scope shipped, Verification (table form), Findings raised, Cross-refs.
- **Migration path:** Template doc; existing slices retroactively get frontmatter only (don't rewrite content).
- **Automation unlocked:** Auto-generated phase summary (which slices in which phase, status, findings raised).

### 5. Tab/admin UI structure

- **Today:** `docs/athlete-lab-tab-inventory.md` (just created in this session). Mirrors `NodeEditor.tsx` `TABS` array.
- **Authority:** Code is authority; this doc is a snapshot. Drift risk.
- **Recommendation: keep the doc, but add a generation step.** A small script reads the `TABS` array out of `NodeEditor.tsx` and regenerates the inventory's first-paragraph summary block. Manual content (disposition predictions, descriptions) lives in a separate sidecar file keyed by tab id, merged at generation time.
- **Migration path:** Defer until 1c.3 stabilizes the tab list. Premature generation while the tab set is changing is wasted work.
- **Automation unlocked:** Tab inventory always matches code; PR check fails if `TABS` changes without inventory update.

### 6. Determinism drift observations

- **Today:** `docs/phase-1c2-determinism-drift-log.md` — markdown table, ~7 rows. Append-only by intent.
- **Authority:** Single. Format is almost CSV already.
- **Recommendation: convert to CSV (`docs/reference/determinism-drift.csv`).** Keep a tiny markdown header doc that defines the schema, decision matrix, and links to F-SLICE-E-2.
- **Migration path:** One-time conversion. New entries appended via script or by hand to the CSV.
- **Automation unlocked:** Plot drift over time, automated halt-condition check, cross-reference to upload IDs in DB.

### 7. Backup table contents (`athlete_lab_nodes_phase1c_backup`)

- **Today:** Structured in DB (good). No in-repo manifest of what was backed up, when, or why.
- **Authority:** DB is authority for data; nothing in repo describes the structure of the rollback buffer.
- **Recommendation: `docs/reference/backup-tables.md`** — for each backup table, the schema, retention policy (per Default B: indefinite), what slice populated it, restore procedure (the SQL).
- **Migration path:** Single doc, ~1-2 KB.
- **Automation unlocked:** A new agent who needs to roll back can do it without spelunking; a future audit can verify backup completeness against the manifest.

### 8. Athlete data model

- **Today:** Authoritative in `supabase/migrations/*.sql` (59 migrations) and `src/integrations/supabase/types.ts` (auto-generated). Partially echoed in `src/store/athleteStore.ts` and `AGENTS.md` Zustand interface section.
- **Authority:** DB is authority. Multiple downstream views.
- **Recommendation: don't try to centralize, but document the divergence intentionally.** A short `docs/reference/data-model-map.md` listing each entity, where its schema lives in DB, where the TypeScript type lives, where the Zustand store mirrors it, and what the divergence rules are (Zustand can be a subset; nothing should silently differ).
- **Migration path:** Single doc.
- **Automation unlocked:** Rare divergence becomes obvious; new agent doesn't need to triangulate from three sources.

### 9. Edge function endpoints and contracts

- **Today:** 13 functions in `supabase/functions/`. Contracts only in code. Some have inline comments; most do not. `analyze-athlete-video` is 3,695 lines.
- **Authority:** Code.
- **Recommendation: `docs/reference/edge-functions.md`** with one section per function: name, purpose, request shape, response shape, callers (admin UI / athlete UI / pipeline), auth requirements, secrets used, deployment notes. Generated by hand initially; could be partially auto-generated from TypeScript types later.
- **Migration path:** One doc, manually populated. ~5-8 KB.
- **Automation unlocked:** PR checklist item ("did you update edge-functions.md?"); easier code review; new agent doesn't open `analyze-athlete-video/index.ts:1-50` to figure out what the function is for.

### 10. Cloud Run service interface

- **Today:** Pydantic models in `mediapipe-service/app/schema.py` (good). `mediapipe-capability-inventory.md` describes capabilities but not the wire contract directly.
- **Authority:** `schema.py`.
- **Recommendation: short `docs/reference/cloudrun-service.md`** — endpoint list (`/health`, `/analyze`), request/response shapes (copy of Pydantic types), version notes, deployment URL constants, the "accepted-but-ignored" fields and why they're there.
- **Migration path:** Single doc.
- **Automation unlocked:** Nothing huge; primarily makes the surface readable without opening Python.

---

## §4 — Layer 3 findings: future-state scaffolding

For each feature category: priority, effort, what to do now, what it pays off in Phase 2 vs Phase 3.

### 1. Roadmap visibility

- **Recommendation:** `docs/roadmap.md` now. Single page. Sections per phase (1c.3, 2a, 2b, 2c, 3). Each item gets a one-line status. Lifts content directly from risk-register preamble; risk register continues to be the deep source.
- **Don't bother with GitHub Issues / Milestones yet.** This repo doesn't use GH issues today; introducing them now is heavyweight infrastructure for low-volume work. Worth revisiting if multi-contributor work begins.
- **Pays off in Phase 2:** Pinned operational obligations (F-SEC-1, F-OPS-1, F-OPS-2) don't get lost between sessions.
- **Pays off in Phase 3:** Source for athlete-facing release notes when the time comes.
- **Effort:** Small (~30 min). **Priority: do now.**

### 2. Decision history (ADR)

- **Recommendation:** `docs/adr/` with one file per decision. Format: `ADR-NNNN-slug.md`, frontmatter `status: accepted | superseded | deprecated`, sections: Context / Decision / Consequences / Alternatives considered. Backfill 6-8 existing decisions (listed in §2.I).
- **Pays off Phase 2 + Phase 3:** Decisions stop getting re-litigated. New agents read the ADR and don't re-propose Option A.
- **Effort:** Small per ADR (~15 min); medium total for backfill (~2 hours).
- **Priority: do now after roadmap.**

### 3. Metric registry

- **Recommendation:** `docs/reference/metrics/` directory, one MD per metric, with structured frontmatter. Stub all metrics currently emitted by the pipeline (Plant Leg Extension, Hip Stability, Release Speed, Hands Extension, plus any score-band-only metrics). Backfill from risk register where known issues exist (F-SLICE-B1-2 → Release Speed).
- **Pays off Phase 2:** Phase 2b is metric audits; this is the audit checklist.
- **Pays off Phase 3:** Athlete-facing "what does this score mean" UI reads directly.
- **Effort:** Medium (~3-4 hours for 8-12 metrics with stubs + backfill).
- **Priority: do at Phase 2 kickoff, not now.** Premature without knowing Phase 2 audit scope.

### 4. Tier system (youth / college / pro)

- **Recommendation:** `docs/reference/tiers.md` with a stub even today: tier IDs, target audience, score-band shifts, content variations. Even an empty placeholder lets Phase 2c and Phase 3 plug in.
- **Pays off Phase 2c:** tier-aware scoring has somewhere to land.
- **Pays off Phase 3:** Athlete UI tier branching has a defined contract.
- **Effort:** Small to stub (~30 min); content fills in as decisions get made.
- **Priority: stub now, fill later.**

### 5. Calibration dataset growth

- **Recommendation:** Already covered in §3.1 — convert ground-truth dataset to structured. Add a `docs/reference/calibration-clips/` directory ready to receive new clip entries.
- **Pays off Phase 2a:** B2 pre-condition (≥3 clips, ≥2 contexts) becomes a script-checkable gate, not a prose-comprehension exercise.
- **Pays off Phase 3:** Indirectly — better calibration → trustworthy athlete-facing scores.
- **Effort:** Small (~1 hour).
- **Priority: do now alongside drift log conversion.**

### 6. Event taxonomy (for Phase 3 analytics)

- **Recommendation:** Don't build now. Sketch on paper at Phase 3 kickoff.
- **Reasoning:** Phase 3 is far enough out that current guesses about events will be wrong. Taxonomy designed without product context is shelfware.
- **Effort:** N/A. **Priority: defer.**

### 7. Changelog and release notes

- **Recommendation:** `CHANGELOG.md` at repo root, manually maintained, one entry per slice ship. Distinct from per-slice outcome docs (which are detailed). Changelog is the 1-3 line "what changed this week" view.
- **Pays off Phase 2:** Track of what shipped vs what's still open.
- **Pays off Phase 3:** Source for athlete-facing release notes when athlete UI ships.
- **Effort:** Small to start (~30 min for backfill of 1c slices); ongoing maintenance is one line per ship.
- **Priority: do now.**

### 8. Test artifacts

- **Recommendation:** Move `scripts/slice1c2_*.ts` to `scripts/verification/` and add `scripts/verification/README.md` describing each script's purpose, inputs, expected outputs. The scripts themselves are good; they just live in a flat directory with no signal about which are still useful.
- Calibration ground-truth fixtures (the slant clip metadata) become the seed of a regression-test dataset.
- **Pays off Phase 2:** Verification scripts get reused for Phase 2 metric audits.
- **Effort:** Small (~30 min).
- **Priority: do now.**

### 9. Documentation structure for agents

- **Recommendation:** `docs/agents/` with:
  - `onboarding.md` — first 15 minutes for a fresh agent: read this, read README, read AGENTS, read INDEX, you're ready.
  - `conventions.md` — slice ID format, finding ID format, how to update the risk register, where ADRs go, how to add a calibration ground-truth entry, how to log determinism drift.
  - `workflows.md` — repeated workflows: "starting a new slice," "shipping a slice," "raising a finding," "deferring scope."
- **Pays off immediately**, but compounds for every future session.
- **Effort:** Medium (~2 hours total).
- **Priority: do now (Tier 1).**

### 10. Configuration registry

- **Recommendation:** Light. A single `docs/reference/configuration.md` listing where configuration lives: Supabase secrets, edge function env vars, Cloud Run env vars, Lovable Cloud connectors, hardcoded constants in code (with file:line citations), Zustand store defaults. Don't try to centralize the actual config — just inventory where it is.
- **Pays off Phase 2 + Phase 3:** Onboarding agents stop guessing where API keys live.
- **Effort:** Small (~1 hour).
- **Priority: do now.**

---

## §5 — Layer 4 findings: creative opportunities

**Observation horizon — explicit framing.** I have direct visibility into PlayCoach work: this repo, prior sessions on Brand HQ build, hex color cleanup, pitch deck work, the entire 1c.x arc including Slices A/B1/C/D/E and the post-Slice-E recovery and documentation closeout. The longitudinal patterns I cite below are drawn from that body of work spanning roughly the last several weeks of intensive sessions.

I do **not** have visibility into your Garner sales work or other domains. Where you've described workflow patterns from those domains in your message, I'll infer that the same patterns likely apply (you re-state context across sessions, you structure work in slices with halt conditions, you push for documentation discipline) — but I'll mark inferred patterns as inferred. Recommendations grounded in PlayCoach observation are the strongest; cross-domain recommendations are weaker.

Capped at 10 ideas across A/B/C, ranked. Plus 5 substantive rejections per Refinement 3.

### A. Workflow pain points observed

#### A1. Chat-to-doc reconstruction tax (HIGH value)

**The problem:** Each session begins with the same warm-up: I read the latest slice outcome, the risk register, then 1-2 referenced docs to reconstruct context. You similarly re-state context that lives in the docs because it's faster than waiting for me to read. Both sides pay this tax every session. I've watched this happen across 1c.1, 1c.2 slices A through E, and the recovery work — the cost is real and consistent. You've described the same pattern in non-PlayCoach contexts in your prompts, suggesting this is a workflow constant, not a project quirk.

**What infrastructure would address it:** `docs/agents/onboarding.md` + `docs/INDEX.md` + a "current state" pinned section (what slice is in flight, what the immediate next decision is, what's blocking). Possibly a single `docs/CURRENT.md` that gets updated at session-end with "where we left off."

**Effort:** Small (~2 hours initial, then ~3 minutes per session-end).

**Value:** Saves ~10-15 min per session in faster context-load. Across the 3-6 month Phase 2 horizon at current cadence, that's hours, with the additional benefit of catching context I currently miss.

**Ranking: HIGH.**

#### A2. Per-slice "verification recipe" reconstruction (MEDIUM value)

**The problem:** Each slice's verification (R-04 backup assertion, post-strip determinism, hash recipes) requires reconstructing the recipe from a prose description in the risk register or slice outcome doc. F-SLICE-E-3 ("recipe propagation without independent verification") is a process lesson born directly from this — the agent (me) propagated a hash without independently regenerating it.

**Infrastructure:** Verification recipes as runnable scripts in `scripts/verification/` with frontmatter linking back to the risk register entry they verify. The recipe IS the doc.

**Effort:** Small per slice (already partially exists — see `scripts/slice1c2_*.ts`). Standardize structure.

**Value:** Eliminates a class of error that has bitten us once already. Modest time savings on top.

**Ranking: MEDIUM.**

#### A3. Phase-label fragility (MEDIUM-LOW value, but cheap to fix)

**The problem:** When you reordered Phase 2 / Phase 3 on 2026-04-26, I had to touch 8 docs to relabel. The risk of missing a doc was real (and `../reference/run-analysis-observability-audit-v2.md` may still have stale references — worth a re-grep). Phase identifiers are copy-pasted strings, not references.

**Infrastructure:** A `docs/reference/phases.md` defining the canonical phase IDs and labels. Other docs reference by ID (e.g., "see PHASE-2A") and the label resolution happens at read time (or at least: an agent grepping for `PHASE-2A` finds all references; today, "Phase 3a" was both the old and new label of different things during the reorder window).

**Effort:** Small (~30 min). Convention-only; no automation.

**Value:** Modest. Reorders are rare. But the cost is low and the next reorder is much cheaper.

**Ranking: MEDIUM-LOW (do as part of roadmap doc work; not on its own).**

### B. Information opportunities currently missed

#### B1. Calibration audit cross-clip aggregation (HIGH value)

**The problem:** Every analysis writes `calibration_audit` to `result_data` (Slice C.5 work). That's potentially dozens to hundreds of structured observations per future month. We currently have no aggregation view — drift across clips, body_based vs static disagreement distribution, confidence floor by camera angle. The data is there; the view isn't.

**What to capture:** Already captured. Just needs aggregation.

**Where it lands:** A small admin-only page or a periodic-export script writing to `docs/reference/calibration-audit-rollup.{md,csv}`.

**Phase 2 enabling:** Multi-clip dataset for B2 architectural decision becomes a query against existing data, not a manual measurement campaign.

**Effort:** Small to medium (~2-3 hours for first pass).

**Ranking: HIGH.**

#### B2. Pipeline run timing and Cloud Run cost telemetry (MEDIUM value)

**The problem:** Cloud Run cost per analysis isn't tracked. Edge function execution time isn't tracked. Determinism drift might correlate with cold-vs-warm Cloud Run instances (F-SLICE-E-2 bimodal hypothesis explicitly invokes this) but we have no way to test the hypothesis without instrumentation.

**What to capture:** Cloud Run request duration, instance ID (cold/warm marker), edge function wall-clock per analysis. Stored on `athlete_uploads` or in a sibling `pipeline_telemetry` table.

**Phase 2 enabling:** Tests the bimodal hypothesis directly. Lets us decide when to investigate vs accept the noise floor.

**Effort:** Medium (~3-4 hours including a lightweight dashboard).

**Ranking: MEDIUM. Worth doing if F-SLICE-E-2 drift becomes a higher-priority blocker; not urgent today.**

#### B3. Findings → slice outcome backlinks (MEDIUM value)

**The problem:** When a finding (F-OPS-1, F-SLICE-E-5) is raised in a slice outcome doc and copied to the risk register, the cross-reference goes one way (slice doc → risk register). The reverse — "which slice produced this finding?" — is not consistently captured. F-OPS-1 has it; F-SEC-1 partially does; some don't.

**What to capture:** Required `origin_slice` and `origin_doc` fields on every finding.

**Phase 2 enabling:** Provenance for re-investigation; an agent picking up a Phase 2 finding can read its origin slice for context.

**Effort:** Small (~1 hour for backfill of existing findings).

**Ranking: MEDIUM. Folds naturally into the risk-register-split work.**

### C. Cross-system integration possibilities

#### C1. Supabase result_data → docs/reference auto-rollup (HIGH value, MEDIUM complexity)

**What connects:** Supabase (`athlete_lab_results.result_data`) → script → `docs/reference/calibration-audit-rollup.csv` (B1 above).

**Capability produced:** Calibration ground-truth dataset grows automatically (every analysis is a data point); cross-clip analysis becomes a CSV query.

**Replaces:** Manual measurement and prose entry per clip.

**Complexity:** Medium. Script is straightforward; deciding cadence (cron vs on-demand) and storage (in repo vs sidecar) needs a call. Brittleness risk: low if script is idempotent and append-only.

**Ranking: HIGH (subset of B1; same recommendation, different framing).**

#### C2. Cloud Run logs → determinism drift CSV (MEDIUM value)

**What connects:** Cloud Run logs → log query → drift CSV append.

**Capability produced:** Drift log writes itself instead of being manually appended after each verification run.

**Replaces:** Manual append to `../reference/phase-1c2-determinism-drift-log.md`.

**Complexity:** Medium. Cloud Run log query is straightforward. The fragility is in matching log lines to upload IDs cleanly.

**Ranking: MEDIUM. Wait until drift log is CSV (do C1 first), then revisit.**

#### C3. Edge function deploy → regression suite trigger (LOW value)

**What connects:** Lovable edge function deploy → automated re-run of `scripts/verification/*` against the canonical Slant clip → output compared to baseline.

**Capability produced:** Regression catch on every deploy.

**Replaces:** Manual post-ship verification (but: post-ship verification is currently the *valuable* part of slice work — automating it removes the human pause moment that catches edge cases).

**Complexity:** High. Lovable's deploy hooks are not straightforward, and Cloud Run cost per run is real (~$0.05). At slice cadence (a few deploys per week), automated re-runs would add noise more than safety.

**Ranking: LOW. Not recommended at current cadence. Revisit if Phase 2 introduces multi-deploy-per-day rhythm.**

---

### Considered and rejected — substantive

#### R1. CI/CD pipeline with automated tests on every PR

- **The idea:** Add GitHub Actions, Vitest in CI, pre-commit hooks, branch protection.
- **Why it might seem valuable:** Industry default. "Mature" projects have it.
- **Why I'd reject for PlayCoach:** Lovable owns the build/deploy pipeline; introducing parallel CI either duplicates work or fights it. Tests barely exist (`src/test/example.test.ts` is the only test file). Vitest infra exists but is unused. Adding CI without first writing tests creates maintenance burden with no safety. **Bigger reason:** the verification model in this project is per-slice, manual, run-against-the-real-pipeline. That model has caught real bugs (F-SLICE-E-4 Mechanics crash, F-SLICE-E-3 hash propagation). CI testing the unit-test layer would not have caught either. Don't replace what works with the generic answer.

#### R2. Centralized observability stack (Sentry / Datadog / similar)

- **The idea:** Wire frontend errors, edge function exceptions, Cloud Run errors into a hosted observability tool.
- **Why it might seem valuable:** Aggregated error visibility, alerting, dashboards.
- **Why I'd reject:** Single-developer project at low traffic. Console + Supabase function logs + Cloud Run logs cover current needs. F-OPS-2 (error boundary) and F-OPS-1 (zombie cleanup) are operational gaps that don't require an observability stack to fix — they require code changes that are already on the Phase 2 list. Adding a third-party tool now adds account management, secrets, a recurring cost, and a tool to keep current — for an app with no real users yet. Revisit when athletes are on the platform and you have actual error volume to triage.

#### R3. GitHub Issues for everything (findings, slices, risks)

- **The idea:** Migrate the risk register to GitHub Issues, one per finding. Use labels and milestones. Close issues as findings resolve.
- **Why it might seem valuable:** Native UI, link to PRs, free, "standard."
- **Why I'd reject:** The project doesn't use GH PRs in the traditional sense (Lovable is the editing surface). Issues exist in a UI agents don't reach naturally; conversation already happens in chat with me. Splitting findings between GH (issue tracker) and `docs/` (long-form writeups) creates two-source-of-truth problems. And the markdown-with-IDs pattern works — the bottleneck is file size, not the medium. A risk-register-split (one file per finding) gets 80% of the benefit without a tool migration. **Caveat:** if a second contributor joins, revisit immediately.

#### R4. Strict schema validation (JSON Schema, Zod) for all docs

- **The idea:** Frontmatter on every doc validated against a schema; CI fails if a doc is missing required fields.
- **Why it might seem valuable:** Enforces consistency; structured queries become reliable.
- **Why I'd reject:** Premature. Most docs are prose-dominant; the structured part is the metadata. Convention + a checklist achieves 90% of the value at 10% of the cost. Once `docs/reference/metrics/`, `docs/adr/`, and the split risk-register exist (all structured-friendly), revisit then. Today: write the ADR template and trust authors to follow it.

#### R5. Auto-generated documentation from TypeScript types

- **The idea:** Run typedoc or similar against `src/integrations/supabase/types.ts` and edge function code; generate API reference docs.
- **Why it might seem valuable:** "Docs that never go stale."
- **Why I'd reject:** typedoc-style output is dense, machine-friendly, agent-unfriendly. The valuable doc is the one explaining *why* and *which-callers* — not the regurgitated type signatures. A 5-KB hand-written `docs/reference/edge-functions.md` is more useful than 200 KB of auto-generated reference. Auto-generation also hides drift between the type and the runtime contract (Pydantic vs TypeScript: the schema.py "accepted-but-ignored" fields wouldn't be visible in a generated TS doc). Hand-write the small surface; let the code be the code.

---

## §6 — Recommended new docs / files / structures (consolidated)

| Item | Where | Priority | Effort | Pays off in |
|---|---|---|---|---|
| Real `README.md` | repo root | **Now** | S | Every session |
| `docs/INDEX.md` | docs/ | **Now** | S | Every session |
| `docs/glossary.md` | docs/ | **Now** | S | Onboarding |
| `docs/roadmap.md` | docs/ | **Now** | S | Phase 2/3 |
| `docs/CURRENT.md` (where we left off) | docs/ | Now | S, ongoing | Every session |
| `docs/agents/onboarding.md` | docs/agents/ | Now | M | Every new agent |
| `docs/agents/conventions.md` | docs/agents/ | Now | M | Every new agent |
| `docs/agents/workflows.md` | docs/agents/ | Now | M | Every new agent |
| `docs/adr/` directory + 6-8 backfilled ADRs | docs/adr/ | Now | M | Phase 2/3 |
| `docs/reference/calibration-ground-truth/` (structured) | docs/reference/ | Now | S | Phase 2a |
| `docs/reference/determinism-drift.csv` + header | docs/reference/ | Now | S | Phase 2 |
| `docs/reference/backup-tables.md` | docs/reference/ | Now | S | Rollback safety |
| `docs/reference/data-model-map.md` | docs/reference/ | Now | S | Onboarding |
| `docs/reference/edge-functions.md` | docs/reference/ | Now | S-M | Onboarding |
| `docs/reference/cloudrun-service.md` | docs/reference/ | Now | S | Onboarding |
| `docs/reference/configuration.md` | docs/reference/ | Now | S | Onboarding |
| `docs/reference/phases.md` | docs/reference/ | Now | S | Reorders |
| `CHANGELOG.md` | repo root | Now | S, ongoing | Phase 2/3 |
| `scripts/verification/README.md` | scripts/ | Now | S | Verification reuse |
| `docs/reference/tiers.md` (stub) | docs/reference/ | Now | S | Phase 2c, 3 |
| `docs/reference/metrics/` directory | docs/reference/ | **Phase 2 kickoff** | M | Phase 2b, 3 |
| Risk register split (one file per finding) | docs/risk-register/ | Phase 2 kickoff | M | Phase 2 |
| Slice outcome template + frontmatter | docs/ | Now | S | Every slice |

S = small (≤1 hr), M = medium (1-4 hr), L = large (>4 hr).

---

## §7 — Recommended reorganization of existing content

| Existing | Issue | Proposed change |
|---|---|---|
| `docs/calibration-ppy-investigation.md` | Recommendation B basis for withdrawn Option A; reads as if Option A is live | Add `Status: superseded by F-SLICE-B-1` banner; move to `docs/investigations/` |
| `docs/release-speed-velocity-investigation.md` | Original framing superseded by F-SLICE-B1-2 reframe | Add `Status: reframed — see F-SLICE-B1-2` banner |
| `docs/first-real-test-diagnostic.md` | Pre-1c.2 era; not marked | Add `Status: historical` banner; move to `docs/investigations/` |
| `docs/run-analysis-observability-audit-v2.md` | `-v2` suffix is fossil; may have stale phase labels | Drop `-v2` suffix; re-grep for stale Phase 2/3 labels |
| `AGENTS.md` bottom half ("LOVABLE — PROJECT KNOWLEDGE") | Duplicates VISION.md | Replace with a pointer ("See VISION.md"); keep AGENTS focused on instructions |
| `docs/migration-risk-register.md` | 47KB single file; mixes R-* risks and F-* findings | Split into `docs/risk-register/` directory with one file per ID; keep aggregating index |
| `docs/calibration-ground-truth-dataset.md` | Prose where structured belongs | Convert measurements to YAML/JSON sidecar per clip; keep narrative for the Slant methodology |
| `docs/phase-1c2-determinism-drift-log.md` | Markdown table; wants to be CSV | Convert to CSV; keep tiny header MD with schema |
| `docs/athlete-lab-architecture-audit.md` | 43KB; some sections superseded by end-state arch | Annotate superseded sections inline; do not delete (current-state value remains) |
| 25 flat files in `docs/` | No grouping | Subdivide into `docs/architecture/`, `docs/process/`, `docs/reference/`, `docs/investigations/`, `docs/adr/`, `docs/agents/` |
| `scripts/slice1c2_*.ts` | Flat directory, no signals | Move under `scripts/verification/`; add a README |

---

## §8 — Recommended automation opportunities

Three categories: **(1) determinism + calibration data flow**, **(2) doc-drift catchers**, **(3) verification recipe self-documentation**.

| # | Manual today | Automation source | Category | Effort | Priority |
|---|---|---|---|---|---|
| 1 | Append a row to determinism drift log after each verification run | Script reads upload_id → CSV append | 1 | S | Phase 2 |
| 2 | Re-derive baseline hash from prose for verification recipe | Recipe lives inside the verification script with backlink to risk-register entry | 3 | S | Now |
| 3 | Cross-clip calibration analysis | Aggregator over `result_data.calibration_audit` → CSV rollup in `docs/reference/` | 1 | M | Phase 2a |
| 4 | Tab inventory drift when 1c.3 changes the tab set | Generator reads `NodeEditor.tsx` `TABS` array, regenerates inventory section | 2 | S | Post-1c.3 |
| 5 | Phase reorder relabel across multiple docs | Reference IDs (`PHASE-2A`) instead of copy-pasted label strings | 2 | S | Now |
| 6 | Backup table provenance / completeness check | Generalize existing `slice1c2_r04_backup_assert.ts` to a per-backup-table script | 1 | S | Phase 2 |
| 7 | Stale-doc detection | Linter flags any doc >N days unmodified as `stale_check_required` | 2 | S | Tier 2 |

**Notably absent — explicitly rejected as automation here, with reasoning in §5:**
- CI test runs on PR (R1)
- Auto-generated TypeScript reference docs (R5)
- Cloud Run deploy-triggered regression suite (Layer 4 C3, ranked LOW)
- Hosted observability webhook integrations (R2)

---

## §9 — Suggested execution sequence

If all recommendations approved, this order minimizes rework and delivers value early:

**Pass 1 — Tier 1 (consolidation, no new content). ~2-3 hours.**

1. Write real `README.md`. Pointer to AGENTS, VISION, INDEX, CURRENT.
2. Write `docs/INDEX.md`. One-line per doc, status pill, audience-based "start here" sections.
3. Write `docs/glossary.md`. ~30-40 entries.
4. Write `docs/roadmap.md`. Lift from risk-register preamble.
5. Establish `docs/CURRENT.md` (where we left off — ongoing 3-min/session maintenance).
6. Strip duplicated content from `AGENTS.md` (point to VISION instead).
7. Drop `-v2` suffix on observability audit + re-grep stale phase labels.
8. Add status banners to superseded investigation docs (calibration-ppy-investigation, release-speed-velocity-investigation, first-real-test-diagnostic).

**Pass 2 — Tier 1 continued (agent infrastructure). ~2 hours.**

9. `docs/agents/onboarding.md`, `conventions.md`, `workflows.md`.
10. `docs/reference/configuration.md`, `cloudrun-service.md`, `edge-functions.md` (initial pass).
11. `docs/reference/data-model-map.md`, `backup-tables.md`, `phases.md`, `tiers.md` (stub).

**Pass 3 — Tier 2 (structural conversions). ~3-4 hours.**

12. Convert calibration ground-truth to structured (YAML per clip + index).
13. Convert determinism drift log to CSV.
14. Establish `docs/adr/` with 6-8 backfilled ADRs (phase reorder, Option A withdrawal, ±1% tolerance, indefinite backup retention, mechanics delete-not-patch, no-new-athlete-UI in 1c, edge-function body_based unification, Phase 2-before-3 ordering).
15. Reorganize `docs/` into subdirectories (architecture / process / reference / investigations / adr / agents).
16. Move `scripts/` verification scripts under `scripts/verification/` with README.
17. `CHANGELOG.md` — backfill 1c slices, then ongoing.

**Pass 4 — Tier 2 continued (risk register split). ~2 hours.**

18. Split `migration-risk-register.md` into `docs/risk-register/` files (one per R-* and F-* ID).
19. Add `origin_slice` / `origin_doc` frontmatter to each finding.
20. Aggregate index.

**Pass 5 — Tier 3 (defer until Phase 2 kickoff).**

21. Metric registry stubs.
22. Calibration audit rollup automation (B1/C1).
23. Cloud Run telemetry (B2) if F-SLICE-E-2 escalates.

**Dependencies:**
- Roadmap (4) before ADRs (14) — ADR ordering follows phase order.
- Glossary (3) before reorganization (15) so new agents can navigate post-reorg structure.
- Risk-register split (18) after directory reorganization (15) so files land in their final home.
- Metric registry (21) after Phase 2b scope is defined — building it earlier risks shape mismatch.

---

## §10 — Open questions for product direction

These I cannot decide without input from you:

1. **Doc reorganization timing.** Reorganizing `docs/` into subdirectories breaks any external links and may invalidate references in chat history. OK to do now, or wait until 1c.3 is done?

2. **Risk register split — preserve IDs or renumber.** Splitting into per-file format preserves R-01...R-12 and F-* IDs verbatim. Do you want that, or take the opportunity to unify into a single `RISK-NNN` namespace? (My preference: preserve verbatim. Renaming costs cross-references to existing chat and docs.)

3. **CHANGELOG audience.** Single CHANGELOG covering both internal slice ships and (eventually) athlete-facing release notes? Or two from the start (internal `CHANGELOG.md`, eventual `docs/release-notes.md`)?

4. **Tier definitions.** Stub now uses placeholder IDs (`youth`, `college`, `pro`). Are those the canonical IDs, or are there others (`high-school` distinct from `youth`, `nfl`/`nba` distinct from `pro`)?

5. **Phase 2 trio.** When Phase 2 kicks off, do you want the same Phase 1c.0 trio approach (capability inventory → end-state arch → risk register) before execution, or a leaner Phase 2 plan?

6. **External linking discipline.** If outside surfaces (a Claude Project, a pinned message, a notion doc) link to `docs/` files, those links break on reorg. Do you have any external links I should preserve?

7. **`docs/CURRENT.md` ownership.** Who updates it at session-end — you, me, or both? If me: which session-end events trigger the update (every slice ship? every meaningful pause?)?

8. **Observability investment threshold.** At what point does B2 (Cloud Run telemetry) cross from "nice to have" to "needed"? Concrete threshold helps me know when to surface it again.

---

**End of audit.**
