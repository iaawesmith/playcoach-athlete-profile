# Glossary

Canonical terminology used across PlayCoach docs and code. When in doubt, defer to this list. New terms enter via PR; deprecated terms are listed in the "Retired" section so old docs remain interpretable.

---

## Product

| Term | Meaning |
|---|---|
| **Brand HQ** | The authenticated builder where athletes create and manage their identity. Lives at `/builder`. Desktop-primary. |
| **Athlete Profile** | The public, shareable page at `/:athleteSlug`. Mobile-first. The "magazine" to the ProCard's "cover." |
| **ProCard** | The visual athlete trading card — the centerpiece of the identity. Appears in builder center column and Athlete Profile Hero chapter. |
| **Profile Strength** | The completion percentage shown in the SideNav. Computed from weighted signals (see [`PRODUCT-SPEC.md`](../PRODUCT-SPEC.md)). |
| **Section** | One of the six Brand HQ areas (Identity, Performance, Develop, Pulse, Connect, Settings). |
| **Chapter** | One of the eight Athlete Profile scroll units (Hero, Story, Highlights, Development Lab, Stats, Recruiting, NIL, Connect). |
| **Development Lab** | The AI drill scoring + progress section of the Athlete Profile. |
| **teamColor** | The hex color driving dynamic accents. Default `#00e639`. Stored in Zustand and exposed as CSS variable `--team-color`. |
| **NIL** | Name, Image, Likeness — brand partnership rights and the partnership marketplace. |
| **Pulse** | Planned live CFBD data feed + athlete-curated moments (post-MVP). |
| **Badge** | A platform-earned achievement marker unlocked by milestones. Earned, not assigned. |

---

## Athlete-Lab (internal builder)

| Term | Meaning |
|---|---|
| **Athlete Lab** | The internal-only admin builder where node-based drill definitions, calibrations, and scoring rules are authored. Distinct from Brand HQ (athlete-facing). |
| **body_based_ppy** | Pixels-per-yard derived from athlete body landmarks. The current canonical PPY source. |
| **Calibration** | The process of converting pixel measurements to real-world units (inches, mph). Two paths: corner-detection (deprecated, "Option A") and body-based (current, "C.5 unified"). See ADR-0004 (created in Pass 3d). |
| **calibration_audit** | The structured payload written to `athlete_lab_results.result_data.calibration_audit` capturing which calibration path ran, with what inputs, and producing what `selected_ppy`. |
| **FIXED_TEST_ATHLETE_ID** | The canonical test athlete UUID (`8f42b1c3-5d9e-4a7b-b2e1-9c3f4d5a6e7b`) used for admin smoke testing. Referenced by the `admin-test-upload` edge function and admin smoke-test workflows. |
| **Node** | A drill definition row in `athlete_lab_nodes`. Contains overview, key metrics, scoring rules, calibration references, LLM prompts, etc. |
| **result_id** | Primary key of `athlete_lab_results`. One result per analysis run. |
| **Slant** | The only currently-active node in the system. The slant-route reference clip `slant-route-reference-v1.mp4` is the canonical ground-truth clip used in F-SLICE-B-1 calibration analysis and pipeline verification. |
| **Tab** | One section of the NodeEditor UI. Inventoried in [`architecture/athlete-lab-tab-inventory.md`](architecture/athlete-lab-tab-inventory.md). |
| **upload_id** | Foreign key from `athlete_lab_results.upload_id` → `athlete_uploads.id`. The atomic unit of analysis. |

---

## Process & phases

| Term | Meaning |
|---|---|
| **Phase 1c.X** | The cleanup phase numbering. 1c.0 = audit, 1c.1 = slice work, 1c.2 = determinism + cleanup, 1c.3 = next consolidation. See [`roadmap.md`](roadmap.md). |
| **Phase 2** | Metric quality. Establishing trustworthy metrics before athlete-facing surfaces. |
| **Phase 3** | Athlete UI. Phase-3 reorder reflects metrics-before-UI ordering (ADR-0006). |
| **Slice** | A bounded unit of work inside a phase, sized to ship in one or two sessions. Identified as `Phase 1c.2 Slice A` etc. Slice outcomes live in `process/`. |
| **Group A / Group B** | Determinism drift bands. Group A = within ±1% of baseline (pass). Group B = within ±2% (acceptable but flagged). Outside ±2% triggers halt. See ADR-0005. |
| **R-NN** | Risk identifier in the migration risk register. IDs are stable; never renumbered. |
| **F-SLICE-X-N** | Finding identifier in the migration risk register, scoped to the originating slice. |
| **V-1c.3-NN** | Verification task identifier in the 1c.3 prep backlog. |
| **ADR-NNNN** | Architecture Decision Record. Backfilled in Pass 3d. |

---

## Files & layout

| Term | Meaning |
|---|---|
| **`PRODUCT-SPEC.md`** | The product/build specification at the repo root. Design system, ProCard spec, color tokens, component contracts. Lovable reads it every session. |
| **`AGENTS.md`** | Legacy filename. Removed in Phase 1c.3-A after the redirect-stub R2 sweep confirmed zero live references. Product spec lives in `PRODUCT-SPEC.md`. |
| **`docs/agents/`** | Operational guidance for agents working in this repo (onboarding, conventions, workflows). Distinct from `PRODUCT-SPEC.md`. |
| **R2 stub** | A redirect stub left at an old doc path after a move/rename, per the R2 stub policy in `agents/conventions.md`. Heavy-traffic docs only. Removed at next phase boundary. |

---

## Retired terms

These terms have been deprecated. Listed so older docs remain interpretable, but new content should use the replacement.

| Retired | Replacement | Reason |
|---|---|---|
| "Elite Tier" | (earned badges) | Arbitrary; replaced by milestone-driven badges. |
| "Technical Specs" | "Player Details" | Software language, not athlete language. |
| "Asset Library Bin" | "Your Media" | Enterprise software language. |
| "Professional Bio" | "Athlete Bio" | Not how athletes think of themselves. |
| "Legal First/Last Name" | "First Name", "Last Name" | This is not a government form. |
| "Live Rendering" | (no replacement; remove) | Developer language. |
| "Option A calibration" / "corner-detection PPY" | "body_based_ppy" / "C.5 unified path" | Option A withdrawn; ADR-0004. |
| "Phase 2 athlete UI" | "Phase 3 athlete UI" | Phase ordering corrected; ADR-0006. |
| "Phase 3 metric quality" | "Phase 2 metric quality" | Same correction. |
