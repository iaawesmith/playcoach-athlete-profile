# Agent Onboarding

> **Read this first if you're a new agent (fresh Claude session, Claude Project, Claude Code, or new contributor) joining this repo cold.** 15 minutes to working context.

---

## What this project is

**PlayCoach** — an athlete identity platform. One shareable link surfaces every dimension of an athlete (recruiting profile, highlights, AI development scores, stats, NIL).

Two surfaces:
- **Brand HQ** — authenticated builder at `/builder`. Where athletes build.
- **Athlete Profile** — public page at `/:athleteSlug`. Where coaches/scouts/brands/fans consume.

There is also an internal-only **Athlete Lab** at `/athlete-lab` — the admin builder for node-based drill definitions, calibrations, and scoring rules. Most of the current `docs/` content concerns this internal surface, not the athlete-facing product.

---

## The four documents you must know exist

| Doc | What it is | When to read it |
|---|---|---|
| [`../../VISION.md`](../../VISION.md) | Executive narrative — mission, market, personas, taglines | When you need product framing or "why" |
| [`../../PRODUCT-SPEC.md`](../../PRODUCT-SPEC.md) | Build specification — design system, ProCard spec, color tokens, component contracts, real-content standard | Before writing any UI code |
| [`../INDEX.md`](../INDEX.md) | Documentation index | When you need to find a doc and don't know its path |
| [`../glossary.md`](../glossary.md) | Canonical terminology | Whenever a term is ambiguous |

`AGENTS.md` at the repo root is a redirect stub from a Phase 1c.2 cleanup rename. Real product spec lives in `PRODUCT-SPEC.md`.

---

## Read order for a fresh agent

1. **`VISION.md`** (10 min skim) — what we're building and why
2. **`PRODUCT-SPEC.md`** (15 min skim) — design system, ProCard, color tokens, real-content standard
3. **`docs/INDEX.md`** (3 min) — what else is in `docs/`
4. **`docs/roadmap.md`** (5 min) — current phase, where we are, where we're going next
5. **`docs/agents/conventions.md`** (5 min) — repo conventions you must follow (file naming, IDs, R2 stub policy, structured-vs-prose rule)
6. **`docs/agents/workflows.md`** (5 min) — how to do common multi-step things in this repo

After step 6 you have working context. ~45 minutes total.

---

## What you're walking into

We're at the tail end of **Phase 1c.2** — a deep cleanup pass on the internal Athlete Lab pipeline. Determinism has been stabilized, calibration paths have been unified, the risk register is large. Right now we are inside a **6-pass repo + IA foundation build** (consolidation → agent infra → structural conversions → risk register split → foundation scaffolding → mechanical automation).

**Phase 2 (metric quality) and Phase 3 (athlete UI) are deferred** until 1c.3 closes. Phase ordering is *metrics before UI* — see ADR-0006 (created in Pass 3d). Do not propose athlete-facing UI work in Phase 1c.

---

## Where things live

```
/                          PlayCoach project root
├── README.md              Public-facing project overview
├── PRODUCT-SPEC.md        Build specification (Lovable reads this every session)
├── VISION.md              Executive narrative
├── AGENTS.md              [stub — redirects to PRODUCT-SPEC.md]
├── src/                   Application code
│   ├── features/          Feature folders (athlete-lab, builder, profile, landing, onboarding)
│   ├── store/             Zustand stores
│   ├── services/          API call layer (never fetch from components)
│   └── integrations/      Supabase client + types (auto-generated, never edit)
├── supabase/
│   ├── migrations/        SQL migrations
│   └── functions/         Edge functions (analyze-athlete-video, etc.)
├── mediapipe-service/     Cloud Run service for pose analysis
├── scripts/               Verification + utility scripts
└── docs/                  All other project documentation
    ├── INDEX.md           Doc index — start here when looking for something
    ├── glossary.md        Canonical terminology
    ├── roadmap.md         Phase ordering, source of truth
    ├── agents/            Operational agent guidance (this folder)
    ├── data-dictionary/   Field-level data dictionary (the structured-data exemplar)
    └── [many topic docs]  Risk register, calibration, slice outcomes, investigations
```

---

## Working norms

- **Read before writing.** Re-reading is cheap; rewriting code on bad assumptions is expensive.
- **`grep`/`rg` before assuming.** If a constant, ID, or file might exist, verify before assuming it does or doesn't.
- **Halt and surface > guess and continue.** When you find something the plan didn't account for, stop and surface. Phase 1c.2 has multiple instances of "halt found a real issue" being the right call.
- **Cross-reference integrity is a test.** After moving or renaming a doc, sweep for backlinks. Broken backlinks are bugs.
- **Verbatim ID preservation.** `R-*`, `F-*`, `V-1c.3-*`, `ADR-NNNN`, `PHASE-*` IDs are stable. Never renumber.

---

## What this repo is NOT doing right now

So you don't propose work that's been deliberately deferred:

- ❌ No new athlete-facing UI in Phase 1c (corollary of [ADR-0006](../adr/0006-phase-ordering-metrics-before-ui.md) — metrics quality before athlete UI)
- ❌ No new database migrations during the 1c.2 cleanup (read-only DB access only, except seed CSV in Pass 5.5)
- ❌ No edge function changes during the 1c.2 cleanup
- ❌ No CI/CD pipeline (deliberately rejected — see repo audit §5 R1)
- ❌ No Sentry / hosted observability (deliberately rejected — see repo audit §5 R2)
- ❌ No new pose-analysis pipeline calls (zero pipeline cost during cleanup)

If a request collides with any of these, surface the conflict before executing.
