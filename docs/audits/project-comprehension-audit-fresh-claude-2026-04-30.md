# Project Comprehension Audit, Fresh Claude, 2026-04-30 (post-prep re-run)

**Audit context.** This is the second fresh-Claude comprehension audit run today against the PlayCoach repo. The first (saved at `docs/audits/project-comprehension-audit-fresh-claude-2026-04-30`) named a set of gaps. PHASE-1C3-PREP shipped earlier today specifically to close those gaps and explicitly invited a re-audit as the success check (`docs/process/phase-1c3-prep-slice-outcome.md` → "Recommended re-audit"). I read the repo cold per the methodology, treated the existing audit as one of many docs in the repo (not as a substitute for my own read), and report what I actually found.

**Methodology followed.** Read order from the prompt: `README.md` → `docs/agents/onboarding.md` → `docs/INDEX.md` → `docs/glossary.md` → `docs/roadmap.md` → architecture overview docs → risk register index → ADR sample. Plus targeted lookups for the 32 specific questions. Roughly 90 minutes of reading. I did not read every doc in `process/`; I sampled enough to triangulate.

**Output discipline.** I follow EJS conventions (no em dashes, lead with the answer, prose over bullets where prose works). The audit prompt requested headed sections, so I use them where they aid scanability. Quoted text from source docs preserves their original em dashes.

---

## Step 1, baseline read

The read order in `docs/agents/onboarding.md` (READMEpoints to it, INDEX confirms it) is now: VISION, PRODUCT-SPEC, INDEX, roadmap, system-overview, pipeline-trace, conventions, workflows. Roughly 60 minutes claimed; I read in 75-90 because I went deeper into ADRs and risk register entries than required for working context.

The read order chains correctly. Each step linked the next. I never had to guess where to look.

---

## Step 2, the 32 questions

### Product

**Q1, what is PlayCoach?** HIGH. Athlete identity platform. One shareable link surfaces every dimension of an athlete: recruiting profile, highlights, AI development scores, stats, NIL. Two athlete-facing surfaces (Brand HQ at `/builder` for authenticated building, Athlete Profile at `/:athleteSlug` for public consumption) plus an internal-only Athlete Lab at `/athlete-lab` for admin authoring of nodes, scoring rules, and calibration. Sources: `README.md`, `docs/agents/onboarding.md`, `docs/architecture/system-overview.md`.

**Q2, target users and tiers.** HIGH. Audience-side users: athletes (Brand HQ), coaches/scouts/brands/fans (Athlete Profile), internal admins (Athlete Lab). Tier system has four IDs (`youth`, `high-school`, `college`, `pro`); only `college` is currently active, the other three render as "Coming Soon" in onboarding. `VISION.md` "Tier System (Canonical)" plus `src/features/onboarding/steps/AthleteTier.tsx` are the source of truth (per Tier resolution shipped in PHASE-1C3-PREP). The `docs/reference/tiers/_schema.md` documents the structured-content contract for tier-specific reference material rather than owning IDs.

**Q3, current product state.** HIGH. Phase 1c.3 closed 2026-04-30. PHASE-1C3-PREP shipped same day. What works: the Athlete Lab admin authoring surface (now 8 tabs), the upload to result pipeline (Supabase Storage trigger, `analyze-athlete-video` edge function, MediaPipe Cloud Run, calibration audit, Lovable AI Gateway feedback), determinism within ±1% (ADR-0005), backup-snapshot pattern for destructive migrations (ADR-0007/0012). What does not work yet: athlete-facing UI (deferred to Phase 3 per ADR-0006), multi-clip ground truth (n=1, gates Phase 2a), error boundaries (F-OPS-2, ship blocker for Phase 3), permissive RLS (F-SEC-1, ship blocker for Phase 3). Sources: `docs/roadmap.md`, `docs/process/phase-1c3-retrospective.md`, `docs/risk-register/INDEX.md`.

**Q4, admin tooling vs athlete surfaces.** HIGH. Admin authoring (Athlete Lab) produces node definitions, scoring rules, calibration parameters, prompt templates. Athlete consumption (Athlete Profile, future) reads through those nodes. ADR-0006 establishes the trust boundary: no athlete-facing surface ships before Phase 2 metric quality work completes, because shipping pretty UI on top of untrustworthy analysis either burns trust if athletes notice changes, or locks wrong metrics as expected ground truth if they don't. `docs/architecture/system-overview.md` §1 names this explicitly as the "trust boundary."

**Q5, what is a node.** HIGH. A row in `athlete_lab_nodes` representing a drill definition. Contains JSONB fields for `key_metrics`, `phase_breakdown`, `knowledge_base`, `scoring_rules`, `error_definitions`, `llm_prompt_template`, calibration parameters, and detection-frequency scenario settings. Authoring a node defines the contract the analyze-athlete-video pipeline uses to score a clip and the prompt context Claude uses for feedback. The Slant route is the only currently-active node. Sources: `docs/glossary.md`, `docs/data-dictionary/fields.json` (110 fields, v1.5.0), `docs/architecture/athlete-lab-end-state-architecture.md`.

### Architecture

**Q6, tech stack.** HIGH. Frontend: React 18, Vite 5, Tailwind v3, TypeScript 5, Zustand for shared state. Backend: Lovable Cloud (managed Supabase) for Postgres, RLS, auth, storage, edge functions (Deno runtime). Pose pipeline: Python FastAPI on Google Cloud Run, RTMlib for pose estimation. LLM: Lovable AI Gateway, Claude Sonnet 4.5 (model pin `claude-sonnet-4-5` per `pipeline-trace.md` step 8). Sources: `README.md`, ADRs 0002, 0003, 0009, 0010.

**Q7, end-to-end trace.** HIGH. This is now genuinely answered in one place by `docs/architecture/pipeline-trace.md` (created in PHASE-1C3-PREP). Ten steps with file and line citations: upload INSERT (step 0), DB webhook fires `analyze-athlete-video` at line 607 (step 1), node config fetch and preflight (step 2), detection-frequency resolution and static calibration selection (step 3), POST to Cloud Run with 4-key payload through `callCloudRun` at line 3445/3484 (step 4), temporal smoothing and target-person lock (step 5), `resolveCalibration()` at line 1471 producing the `calibration_audit` payload per ADR-0014 (step 6), metric and scoring runs (step 7), Claude prompt construction and `callClaude` at line 3350 (step 8), `writeResults` at line 3595/3607 (step 9), upload status complete at line 870 (step 10). Maintenance contract is named explicitly: line numbers cite state as of 2026-04-30, durable shape but not durable line numbers.

**Q8, MediaPipe / Cloud Run / edge function roles.** HIGH. MediaPipe (the RTMlib pose model running inside the FastAPI service) is the pose estimator: it decodes video, runs RTMlib, attempts dynamic line-pair calibration, returns keypoints + scores + frame_count + fps + body_based_ppy + calibration metadata. Cloud Run is the deployment surface for that service (Python container, NDJSON keepalive streaming to defeat the GFE 30s idle-byte timeout, decision in ADR-0009). The Supabase edge function `analyze-athlete-video` orchestrates everything around it: preflight, calibration selection, smoothing, metric and scoring math, prompt assembly, LLM call, write-back. Sources: `docs/architecture/mediapipe-capability-inventory.md`, `docs/architecture/pipeline-trace.md`, ADR-0009.

**Q9, Lovable / Supabase / deployed app relationship.** HIGH. Lovable is the IDE plus build, branch preview, and production deploy. Lovable Cloud is the managed-Supabase backend that the app reads and writes (Postgres with RLS, auth, storage, edge functions). The deployed app at `happy-setup-hub.lovable.app` is what Lovable's deploy pipeline produces from `src/`. ADR-0002 records Lovable Cloud as the default backend. User-facing language calls Lovable Cloud "the backend"; Supabase is internal terminology, per `system-overview.md` §3.

**Q10, calibration paths.** HIGH. Two paths today, with selection priority `dynamic > body_based > static` enforced in `resolveCalibration` per `docs/investigations/calibration-source-trace.md`. (a) Dynamic: line-pair detection in the Cloud Run service, accepted only if PPY in [40, 120] and good_line_pairs >= 8 and source labeled `dynamic`. (b) Body-based: derived from athlete pixel-height versus claimed real height, computed in the edge function (Slice C.5 unified the two pre-C.5 body-based computations to the edge-function path per ADR-0014). (c) Static: hand-authored constant of 80, intended for sideline tactical-camera framing. Why multiple: F-SLICE-B-1 found both surviving paths produce 2-6× distance errors versus measured ground truth (~495 ppy on the only ground-truth clip). Static is more wrong than body_based, which is why "Option A" (delete body_based, keep static) was withdrawn. The architectural decision (B2) is deferred per ADR-0004 until ground truth has n>=3 entries across >=2 contexts.

### Data model

**Q11, athlete_lab_nodes contents.** HIGH. All node tab data is JSONB columns inside `athlete_lab_nodes`; there are no separate tables for metrics, phases, videos, mechanics, errors (per `data-dictionary/fields.json` schema_note). 110 fields documented in v1.5.0. Authoritative on this row: name, position, status, node_version, key_metrics, phase_breakdown, scoring_rules, score_bands, knowledge_base, llm_prompt_template, reference_calibrations, camera_guidelines, badges. Derived/computed at runtime: nothing here, derivations live in `athlete_lab_results.result_data`.

**Q12, athlete_uploads contents and lifecycle.** HIGH. Trigger table for the analyzer. Columns: id, athlete_id, node_id, node_version (snapshot at upload), video_url, camera_angle, start_seconds, end_seconds, analysis_context (JSONB), status, error_message, progress_message, created_at. Lifecycle: `pending → processing → complete | failed | cancelled`. INSERT fires the DB webhook that invokes `analyze-athlete-video`. F-OPS-1 names "zombie upload accumulation" (uploads stuck in `processing` past ~72h with no progress message) as a known operational gap, deferred to Phase 2 operational track.

**Q13, result_data and calibration_audit.** HIGH. `result_data` is the JSONB blob on `athlete_lab_results` carrying: `log_data` (the full PipelineLogData with preflight checks, rtmlib metadata, claude_api log, metric resolution trace), `calibration_audit` (the per-run calibration decision record per ADR-0014), Cloud Run metadata, and the feedback paragraph. Dedicated columns alongside: `metric_results`, `phase_scores`, `aggregate_score`, `detected_errors`, `confidence_flags`. The `calibration_audit` payload captures: body_based_ppy, body_based_status, body_based_confidence, static_ppy, static_status, dynamic_status, dynamic_failure_reason, selected_source, selected_ppy, athlete_height_provided, node_id, node_version, camera_angle. ADR-0014 mandates it as the single canonical contract; future paths must land via this same payload, never as parallel top-level fields.

**Q14, athlete_lab_nodes_phase1c_backup.** HIGH. Pre-migration snapshots of any column or JSON sub-field about to be dropped destructively. Schema columns: id, node_id, source_column, content, node_name, disposition, audit_pattern, audit_reason, original_intent, slice, captured_at. CHECK constraints on disposition (`dead | collapsed | relocated | partial_strip`), audit_pattern (the four patterns), and slice (slice tag, normalized to durable `<phase>-<slice>` form by 1c.3-E). Why: ADR-0007 codifies the pattern (how to take the snapshot); ADR-0012 commits to indefinite retention as Default B (how long to keep). R-04 backup completeness is mitigated by the snapshot pattern plus the `slice1c2_r04_backup_assert.ts` script. R-07 backup-disposition trustworthiness was mitigated in slice 1c.3-E.

### Phase / history

**Q15, what is Phase 1c?** HIGH. Phase 1c is the pipeline correctness, calibration unification, and admin UI consolidation arc. 1c.0 was architecture audit and end-state design (`mediapipe-capability-inventory.md`, `athlete-lab-end-state-architecture.md`, original migration risk register). 1c.1 was the Slice 2 plus Slice 3 Mechanics-to-Phases content migration. 1c.2 was the determinism stabilization plus 6-pass repo and IA cleanup (slices A through E, then the cleanup passes 1-6). 1c.3 was the 13-to-8 admin UI consolidation and write-path defect-class cleanup (six slices A through F). 1c.3-A R2 stub sweep, 1c.3-B Mechanics deletion plus kb.mechanics merge, 1c.3-C Training Status / Solution Class write-path resolution, 1c.3-D tab consolidation, 1c.3-E R-07 backup audit plus slice-tag normalization, 1c.3-F retrospective and close. Sources: `docs/roadmap.md`, `docs/process/phase-1c3-retrospective.md`.

**Q16, completed vs deferred.** HIGH. Completed: the structural cleanup work, determinism stabilization, calibration path unification (ADR-0014), admin UI consolidation, backup pattern hardening, knowledge-base merges. Mitigated risks: R-01, R-05, R-07. Closed: R-12. Deferred to Phase 2 or 3: F-SLICE-B-1 (multi-clip calibration architecture), F-SLICE-B1-2 (Release Speed verification), F-SLICE-E-1 (det_frequency consolidation), F-SLICE-E-2 (~0.78% drift root cause), F-OPS-1 (zombie cleanup), F-OPS-2 (error boundaries, ship blocker), F-SEC-1 (RLS hardening, ship blocker), V-1c.3-06 (CoachingCues subsystem retirement), V-1c.3-07 (score_bands consumer wiring), V-1c.3-09 (reference video quality guide audience separation), V-1c.3-10 (1c.2-E backup slice tag normalization).

**Q17, current phase.** HIGH. Phase 1c.3 complete. Phase 2a (calibration robustness) is next, gated on ground-truth dataset growth from n=1 to n>=3 across >=2 contexts. The roadmap, the risk register INDEX phase-ordering note, and the onboarding doc all agree. (This question received LOW confidence in the prior audit because the roadmap had drifted; PHASE-1C3-PREP closed that gap.)

**Q18, phase reordering.** HIGH. Original ordering had athlete UI as Phase 2 and analysis quality as Phase 3. Reordered 2026-04-26 to flip them: metrics quality is Phase 2, athlete UI is Phase 3. Rationale per ADR-0006: athletes never see analysis surfaces built on untrustworthy data, calibration is 2-6× off (F-SLICE-B-1), Release Speed is metric-math-broken (F-SLICE-B1-2), pipeline drift is bimodal at 0.78% (F-SLICE-E-2). Shipping athlete UI on top of that means the perceived failure mode is "the AI was wrong about my technique," and trust on the public consumption surface is unrecoverable.

### Decisions

**Q19, why was Option A withdrawn.** HIGH. Option A was "delete `body_based`, keep `static`." Withdrawn 2026-04-26 per Section D of the determinism experiment doc and codified in F-SLICE-B-1 status. Ground-truth measurement on the only clip (`slant-route-reference-v1.mp4`, soccer training facility, ppy ~495 from converged circle-fit plus athlete-height methods) showed `body_based` (~234) is 1.7-2.4× off and `static` (80) is 5-6.9× off. Static is more wrong than body_based regardless of where ppy lands within the conservative uncertainty window; deleting body_based would leave the worse path as the only option. Replacement: keep both paths, unify body_based to the edge-function computation (ADR-0014, Slice C.5), defer the architectural decision to Slice B2 gated on ground-truth growth (ADR-0004). Long-term direction in ADR-0014 cross-links: Option B (migrate to MediaPipe world coordinates entirely, eliminate calibration as a concept).

**Q20, why was Mechanics tab hidden rather than patched.** HIGH. Slice E.5 first-attempt smoke crashed on `MechanicsEditor` line 1015 dereferencing `draft.pro_mechanics` (now undefined after migration `20260426025918`). A one-character `?? ""` patch would have unblocked. ADR-0015 generalizes the rule: when a component is on the immediate-next-phase deletion queue AND the hide is <=20 lines AND nobody is iterating on it AND deletion is in the immediate next phase, prefer hiding the entry-point. Patching code slated for deletion is throwaway work plus reviewer cost. Mechanics was commented out of TABS as a 5-line edit; full deletion shipped in 1c.3-B (2026-04-29).

**Q21, why is F-OPS-2 a Phase 3 ship blocker.** HIGH. F-OPS-2 (missing error boundary around NodeEditor) is the empirical demonstration that a single null-deref in any sub-editor unmounts the entire admin shell with no recovery except page reload. Tolerable for admin (technical user, refresh-friendly); unacceptable for athletes mid-upload, where the perceived failure mode is "the app broke and ate my upload." Severity Sev-2. Required action before Phase 3 (executed during Phase 2): ErrorBoundary at the AthleteLab outer shell, at the NodeEditor tab-content level, and at every athlete-facing route plus user-generated-content subtree.

**Q22, what is F-SLICE-E-3.** HIGH. "Recipe propagation without independent verification." Process lesson, no severity. Surfaced when a baseline hash (`34a87126…`) was propagated through approval messages without being independently reproduced against its source upload; a downstream agent then hashed the wrong upload and incorrectly concluded the recipe was broken. Process correction: any baseline hash cited in approval messages must be independently reproduced against its source before propagation. This finding is the philosophical basis for the Pass 6.3 verification recipe template requiring NAME, PHASE, VERIFIES, RECIPE, BACKLINKS, MAINTENANCE headers on every script under `scripts/verification/`. Recipes in code with backlinks stay current; recipes in prose drift.

### Operational

**Q23, verification methodology for shape changes.** HIGH. Destructive migrations: backup-before-drop into `athlete_lab_nodes_phase1c_backup` per ADR-0007, with R-04 backup-completeness assertion as a Sev-1 gate (`scripts/verification/slice1c2_r04_backup_assert.ts`). Pipeline-affecting changes: Option D protocol per ADR-0005, hash-exact pass OR categoricals-exact-plus-numeric-drift-≤±1% pass with drift CSV append OR halt. Verification artifacts: `scripts/verification/*.ts` (Pass 6.3 headers), `docs/reference/calibration-audit-rollup.csv` (calibration regression dataset), `docs/reference/determinism-drift.csv` (drift regression record). The new `docs/agents/testing-philosophy.md` frames per-slice manual verification as the test surface, with six load-bearing components and explicit CI/observability deferrals.

**Q24, plan-mode and slice pattern.** MEDIUM. The repo describes the slice pattern operationally: copy `templates/slice-outcome.md`, populate frontmatter, fill scope/shipped/verification/decisions/follow-ups, update roadmap (now hard-required per `workflows.md` step 4 and `check-roadmap-sync.ts`), register risks. Plan-mode itself (the Lovable convention of "propose then approve then execute then verify then ship") is named in this Project's instructions but not formally documented in repo conventions; the repo describes the verification and outcome side, not the plan-mode prompting side. MEDIUM because the workflow descriptions cover how to ship, not the conversational pattern with Lovable. This is intentional, the repo is meant to be agent-agnostic.

**Q25, what costs money.** MEDIUM. Cloud Run pose analysis (per-clip GPU/CPU compute, model load on cold start), LLM inference (Anthropic via Lovable AI Gateway, prompt-construction in `claude-prompt-content-trace.md`), Supabase Storage (video files), Postgres queries. ADR-0009 and the F-SLICE-E-2 escalation gate (Phase 2b telemetry) imply Cloud Run cost is real but currently unobserved per-run. There is no canonical cost model document. The prior audit recommended `docs/reference/cost-model.md`; not shipped in PHASE-1C3-PREP, deferred. MEDIUM because I assembled the answer from architecture and findings rather than a single cost reference.

### Workflow

**Q26, who builds, who reviews, who decides.** MEDIUM. The repo's `workflows.md` describes the rituals (verification scripts, slice outcomes, risk registration, ADR creation, splitting investigations, R2 stubs, tab inventory regen, cross-reference sweeps) but does not name role assignments. From this Project's instructions: Lovable executes code, Claude advises plans reviews and judges, EJS makes decisions. The repo treats role assignment as a Project-level concern, not a repo concern. MEDIUM only because the question asks about who, and the repo answers "what" and "how."

**Q27, conventions for findings and decisions.** HIGH. Findings: pick next ID (`F-<area>-<n>` scoped to area or originating slice; `F-SLICE-B-1`, `F-OPS-2`, `F-SEC-1`); create `docs/risk-register/<ID>-<kebab-slug>.md` with frontmatter per `_schema.md`; append row to risk-register `INDEX.md`; update `related_entries` lists bidirectionally. Decisions: create an ADR at `docs/adr/NNNN-<kebab-slug>.md` with frontmatter (id, title, status, date, deciders, related_risks, related_findings, supersedes, superseded_by) and body sections (Context, Decision, Consequences, Cross-links). ADRs are append-only; supersession via new ADR with frontmatter linkage. IDs are immutable, never renumbered.

**Q28, R2 stub policy.** HIGH. Leave a redirect stub at the old path only if the doc is (a) referenced from outside the repo, (b) referenced from `README.md`, `PRODUCT-SPEC.md`, `VISION.md`, or `agents/conventions.md`, or (c) the historical entry point for a major workstream. Otherwise move cleanly and update in-repo references in the same pass. Stubs are removed at the start of the next phase unless an `rg` sweep shows live references. Each stub gets an entry in the next phase's prep backlog "stub cleanup queue" (mandatory). Catalog docs (`INDEX.md`, `repo-architecture-audit.md`) are exempt from the >30 cross-reference threshold.

**Q29, when does a slice doc get created.** HIGH. When a bounded unit of work ships. Template at `docs/templates/slice-outcome.md`. Frontmatter required: slice_id, title, date_shipped, status, related_risks, related_findings, related_adrs. Body sections: scope, what shipped, verification, decisions made, follow-ups. Step 4 is now hard-required: a slice is not "shipped" until the roadmap reflects it (workflows.md, enforced by `scripts/verification/check-roadmap-sync.ts`).

### Forward-looking

**Q30, Phase 2 starting prereads.** HIGH. The repo answers this directly. Prereads in priority order: ADR-0004 (the deferral threshold gating Phase 2a), ADR-0006 (phase ordering rationale), F-SLICE-B-1 (calibration error magnitude), F-SLICE-B1-2 (Release Speed correctness), F-SLICE-E-2 (drift root-cause investigation), `docs/reference/calibration/_schema.md` and `ground-truth.yaml` (the dataset that needs to grow), `docs/reference/calibration-audit-rollup.{md,csv}` (regression baseline), `docs/architecture/pipeline-trace.md` (where to instrument), `docs/agents/testing-philosophy.md` (what counts as verification). The prior audit recommended a `docs/process/phase-2a-kickoff.md` bundling these; that doc was not part of PHASE-1C3-PREP and remains a synthesis opportunity for Phase 2a kickoff itself.

**Q31, what would break if athletes started using PlayCoach next week.** HIGH. Multiple things, ranked: (1) F-SEC-1, permissive RLS on admin tables plus public storage bucket listing, would expose data and allow uploads by unauthorized users; Sev-2, ship blocker. (2) F-OPS-2, missing error boundaries, would unmount the whole shell on any uncaught error and athletes would interpret it as "the app broke and ate my upload"; Sev-2, ship blocker. (3) F-SLICE-B-1, calibration off by 2-6×, would produce wildly wrong distance and speed metrics that athletes would see and either lose trust or lock into expectation. (4) F-SLICE-E-2, ~0.78% drift, would produce metrics that subtly change between viewings of the same upload. (5) F-OPS-1, zombie uploads, would accumulate without admin visibility. ADR-0006 names exactly this risk profile as the reason Phase 3 is gated.

**Q32, scaffolding for content added later.** HIGH. The `_schema.md` scaffold pattern landed across `reference/tiers/`, `reference/metrics/`, `reference/events/`, `reference/observability/`. Each schema documents the contract before any content lands. Tiers IDs are now canonicalized to `AthleteTier.tsx`. Metrics and events directories are empty at content level (Phase 2c populates metrics; events depend on Phase 3). The `phases.md` registry holds phase IDs. The `data-dictionary/fields.json` is the structured exemplar (110 fields versioned, with status legend). The CSV-aggregator pattern (`aggregate-calibration-audit.ts`) is also reusable scaffolding. There are no committed placeholder content files in any of the structured directories, which is correct per the Project's "no scaffolding with committed placeholder content" rule.

---

## Step 3, gaps

### A, LOW or CANNOT-ANSWER questions

In this re-audit run, none. All 32 questions cleared HIGH or MEDIUM. The two MEDIUMs (Q24 plan-mode, Q26 role assignment) are intentional repo-level abstractions: the repo answers "how to ship work" and "what conventions apply"; the Project instructions answer "who does what and how to converse with Lovable." Treating these as gaps would be over-reading the question. They feel like gaps to a fresh agent only because the Project instructions are not part of the repo, which is by design.

### B, conflicting answers

I found three small inconsistencies, all easily reconciled and probably worth fixing:

1. **`docs/INDEX.md` is stale at the top.** It still reads "Status: Current as of Phase 1c.2 cleanup Pass 3a" and "12 backfilled ADRs (Pass 3d) … `adr/0001` … `adr/0012`" when the actual state is 15 ADRs (0001-0015) and Phase 1c.3 has closed. The body of INDEX is mostly accurate; the header status banner and the ADR table row have not been refreshed. PHASE-1C3-PREP updated several other docs but did not refresh INDEX header. Severity: low confusion risk because the body of INDEX is still navigable, but a fresh agent does have to discount the "current as of 1c.2" framing and discover the 1c.3-era docs by following onboarding rather than INDEX.

2. **`docs/INDEX.md` does not list `docs/audits/`.** The prior audit doc lives at `docs/audits/project-comprehension-audit-fresh-claude-2026-04-30` (no `.md` extension based on what I saw, which is itself slightly odd). INDEX has no `Audits` section. A fresh agent who follows INDEX as "the doc index" would not find the existing audit. Whether the audit doc itself should be discoverable is a judgment call (it is a one-shot deliverable, not ongoing reference), but the same will apply to my output here.

3. **Risk register INDEX phase-ordering note** mentions "Phase 2a is next" but the risk-register count narrative now matches reality (25 entries, 12 risks plus 13 findings, 10 V tasks). Earlier "26/14/9" wording was reconciled in 1c.3-F. This is fine; flagging only because I checked it.

### C, synthesis costs

Most of the prior audit's synthesis costs were eliminated by `system-overview.md` and `pipeline-trace.md`. One genuine remaining synthesis is **Phase 2a kickoff prereads**. Q30 above pulls from ADR-0004, ADR-0006, three F-SLICE entries, two reference YAML/MD pairs, and the testing-philosophy doc. A `docs/process/phase-2a-kickoff.md` that bundles them with one-line "why each matters" prose would compress kickoff context cost. The prior audit recommended this; it was correctly deferred to Phase 2a kickoff itself rather than fabricated in the prep slice.

### D, important topics not in the question list

- **The data dictionary `fields.json`** is the structured exemplar that everything else models on. v1.5.0, 110 fields, JSONB-path-aware. Anyone working in the data layer must know it exists; onboarding does not currently call it out as required reading. Worth a one-liner in onboarding step 5 or 6.
- **The Slant route as the only active node.** Many docs assume this context implicitly. The single ground-truth clip is `slant-route-reference-v1.mp4`. The FIXED_TEST_ATHLETE_ID for admin smoke testing is `8f42b1c3-…`. A new agent encountering "the canonical clip" or "the test athlete" needs this context.
- **F-OPS-3 plus F-OPS-4 plus F-SLICE-E-3 form a methodological triad.** All three are "trusting a prior assertion without re-verifying against current reality" failures. They are not severity findings; they are the discipline-of-the-house. Worth understanding as a unit before any Phase 2 work.
- **The 6-pass cleanup model.** Pass 3a, 3b, 5e-bis, 6.3 are repo-internal milestones. CHANGELOG maps them to dates and deliverables; onboarding does not. New agents encountering "Pass 5e-bis" should know to look at CHANGELOG.
- **`PRODUCT-SPEC.md` is read by Lovable every session.** This is mentioned in onboarding ("Lovable reads it every session") but its operational meaning, that PRODUCT-SPEC has different edit semantics than VISION, deserves explicit framing.
- **`claude-prompt-content-trace.md`** documents the actual prompt text that the LLM receives. For Phase 2c metric quality work and any prompt-engineering, this is the starting point. Not in the onboarding read order; should be referenced from the metrics schema or from a Phase 2c kickoff doc when that exists.

### E, repo structure observations

What worked well:

- The README → onboarding → INDEX → roadmap → system-overview → pipeline-trace → conventions → workflows chain is now the right read order and links chain correctly.
- `system-overview.md` and `pipeline-trace.md` together close the largest comprehension gap from the prior audit. Maintenance contract on pipeline-trace ("line numbers as-of 2026-04-30, durable shape but not durable line numbers") is honest about staleness risk.
- The risk register split (one file per ID, INDEX aggregator with frontmatter) genuinely makes individual entries readable in isolation. F-SEC-1 was the test case; I read it in 30 seconds.
- ADR-0007 vs ADR-0012 distinction note in `adr/INDEX.md` correctly anticipates the "wait, two backup ADRs?" question.
- The Pass 6.3 verification-script header convention (NAME / PHASE / VERIFIES / RECIPE / BACKLINKS / MAINTENANCE) is unusually disciplined. The roadmap-sync detector script is a clean example.
- `testing-philosophy.md` answers a question I would have asked ("where are the tests?") in advance, with structural framing rather than apology.
- The glossary's "Retired terms" section reconciles old language to new ("Elite Tier" → milestone-driven badges; "Option A calibration" → body_based plus C.5 unified path).

What was confusing:

- INDEX.md header banner is stale, as noted. Easy fix.
- I had to triangulate "what does the verification recipe template look like" across `agents/conventions.md` Pass 6.3 section, the actual `_template.ts`, and one example script. A single one-page doc at `scripts/verification/README.md` (which the prior audit recommended) would compress that. The prior audit suggested it; not shipped.
- Pre-template legacy slice outcome docs (1c.1 era) are silently tolerated by the roadmap-sync detector. Fine for now, but a new agent reading those legacy docs may not realize the frontmatter contract evolved. A one-line "legacy" banner on those docs would help; it is also low priority.
- The `audits/` subdirectory is unindexed. If audits are meant to be one-shot deliverables that don't need permanent indexing, that's defensible but worth saying explicitly somewhere (e.g., "audits/ holds historical audit deliverables, see CHANGELOG for index" in INDEX or in a `_audits/README.md`).

---

## Step 4, self-assessment

**High execution-ready.** I could plan and execute most Phase 2 work without further onboarding. I have a working understanding of architecture, history, current state, the calibration problem space, the determinism noise floor, the backup pattern, the slice and ADR conventions, and the discipline of halt-and-decide. Where I would stop and ask before executing: (a) any architectural decision in Phase 2a or 2b (the calibration architecture, the telemetry shape) where I would want to read deeper into specific code paths, (b) anything touching `analyze-athlete-video/index.ts` because the file is 3700 lines and I have only spot-read sections cited in pipeline-trace, (c) specific RLS policy designs for F-SEC-1.

This is a noticeable improvement over what I would have rated for the same repo before PHASE-1C3-PREP. The prior audit (whose author was the same model on the same day) rated some areas LOW because the roadmap had drifted, the system-overview was missing, and the pipeline-trace did not exist. Those are now closed. The remaining gaps (Phase 2a kickoff doc, INDEX.md header refresh, scripts/verification/README.md, audits/ indexing) are all discoverable and small.

---

## Step 5, recommendations

### High-impact, low-effort

1. **Refresh `docs/INDEX.md` header.** Status banner is stale ("Pass 3a", "12 backfilled ADRs"). Update to reflect Phase 1c.3 closed plus PHASE-1C3-PREP shipped, and 15 ADRs (0001-0015). Add a row for `system-overview.md` and `pipeline-trace.md` in the Architecture section. Add an `Audits` row pointing at `audits/`. Effort: 15 minutes.

2. **Add `scripts/verification/README.md`.** The prior audit recommended this; not shipped. One-page doc enumerating each script's NAME / PHASE / VERIFIES line, plus the runtime command convention. Five lines per script, eight or nine scripts. Effort: 30 minutes. Pays off every Phase 2 verification reuse.

3. **Add the data dictionary to onboarding read order.** One line in `docs/agents/onboarding.md` after step 3 ("INDEX") or in the "where things live" section: "data-dictionary/fields.json — 110 fields with JSONB paths and field-level status; consult before any data-layer work." Effort: 5 minutes.

### Medium-impact, medium-effort

4. **`docs/process/phase-2a-kickoff.md`** when 2a kicks off (not before, to avoid placeholder content). The prior audit suggested this; the right time is at 2a kickoff, with the kickoff doc itself bundling the prereads and adding the 2a-specific scope. Effort: 30 minutes at kickoff.

5. **Methodological triad doc, or expanded testing-philosophy section.** F-OPS-3 plus F-OPS-4 plus F-SLICE-E-3 share one root: "trusting a prior assertion without re-verifying against current reality." The three findings each describe one face of this. A single explanatory paragraph at the top of `docs/agents/testing-philosophy.md` §4 (which already covers F-OPS-4) framing the triad, with explicit links to the other two findings, would let a new agent absorb the discipline without reading three risk-register entries. Effort: 30 minutes.

6. **Project Glossary entry for "Slant" plus FIXED_TEST_ATHLETE_ID.** One row each in the glossary noting Slant as the only currently-active node and the test athlete UUID as the canonical smoke-test target. Effort: 5 minutes.

### Lower-impact, optional

7. **`docs/audits/_README.md`** explaining what lives in `audits/` and how it relates to INDEX. Or alternatively, if audits are meant to disappear after their gap-closure work ships, an explicit rotation policy (e.g., "audit docs are retained for 1 phase past their kickoff, then archived to release notes"). Effort: 15 minutes.

8. **Cost-model reference doc.** `docs/reference/cost-model.md` enumerating per-analysis cost surfaces (Cloud Run minutes, LLM tokens, storage), even if values are marked "to-measure." This forces F-SLICE-E-2 cold-start cost analysis to have a home and gives Phase 2b telemetry a place to land observed numbers. Effort: 1 hour.

### What feels missing entirely but I cannot fully articulate

A "Phase 2 readiness map" diagram or table that visualizes which items gate which others. F-SLICE-B-1 deferred status gates ADR-0004 re-decision gates Phase 2a closure gates Phase 2b kickoff. F-SLICE-E-2 escalation gates Phase 2b. F-OPS-2 plus F-SEC-1 gate Phase 3. The information exists across roadmap, ADR-0006, ADR-0004, individual finding entries, but I have to assemble it. Even a flat dependency table in `roadmap.md` would help: "to start Phase 2a, we need X. To close Phase 2a, we need Y. To start Phase 3, we need A, B, C." This is similar to what `phases.md` does for IDs, but for prerequisites rather than identifiers.

---

## Optional, project instruction improvements

The Project instructions are tight and well-aligned with what I encountered in the repo. Three small adjustments would have helped me onboard faster:

1. **Explicitly call out the relationship between Project instructions and repo docs.** The instructions say "Read authoritative docs rather than relying on these instructions for facts." A new Claude session might still try to apply Project-instruction terminology directly. Adding "When repo and Project instructions disagree, repo wins; surface the gap" would be cleaner than the current "defer to repo" phrasing.

2. **Name the current phase explicitly in the instructions.** Project instructions say "Phase 1c.2 complete (admin tooling + repo foundation cleanup shipped). Phase 1c.3 (admin UI consolidation) is next." This is now stale; Phase 1c.3 has closed and Phase 2a is next. The instructions are themselves drifting against the roadmap, the same F-OPS-3 pattern the repo discipline is designed to catch. Either point at `docs/roadmap.md` as the single source of truth and remove the phase mention, or commit to updating instructions whenever roadmap moves. The first option is more durable.

3. **The "halt conditions are features" line is good but unexplained.** It's clear once you read F-OPS-3 and F-OPS-4. A new agent encountering only the instructions might read it as terse mysticism. One sentence pointing at "`docs/agents/testing-philosophy.md` §4 explains why" would close the loop.

---

**End of audit.**
