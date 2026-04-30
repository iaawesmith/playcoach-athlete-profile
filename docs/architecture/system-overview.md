# System Overview — PlayCoach Architecture

> **Audience:** Fresh agents joining the repo cold who need a system-level mental model in one read. For Athlete-Lab-specific deep-dive see [`athlete-lab-end-state-architecture.md`](athlete-lab-end-state-architecture.md). For an upload-by-upload pipeline trace with file:line citations see [`pipeline-trace.md`](pipeline-trace.md).
>
> **Created:** 2026-04-30 (PHASE-1C3-PREP). Closes the system-level architecture gap repeatedly identified by fresh-Claude comprehension audits.

---

## §1 — Three product surfaces

PlayCoach has three distinct UI surfaces, each with a different audience, trust model, and deployment status:

| Surface | Route | Audience | Auth | Status |
|---|---|---|---|---|
| **Brand HQ** | `/builder` (and sub-routes) | Athletes building their identity | Authenticated | In active development (Phase 1c product surface) |
| **Athlete Lab** | `/athlete-lab` | Internal admin only | Authenticated, admin role | In active development; Phase 1c.3 just consolidated 13 → 8 tabs |
| **Athlete Profile** | `/:athleteSlug` (e.g., `/marcussterling`) | Public — coaches, scouts, brands, fans | None (public) | **Deferred to Phase 3.** Builds on metric quality work in Phase 2. See [ADR-0006](../adr/0006-phase-ordering-metrics-before-ui.md). |

### Trust boundary

Admin authoring (Athlete Lab) **produces** node definitions, scoring rules, calibration parameters, and prompt templates. Athlete consumption (Athlete Profile, future) **reads** through those nodes. **No athlete-facing surface ships before Phase 2 metric quality work completes** — the rule that prevents shipping pretty UI on top of untrustworthy analysis ([ADR-0006](../adr/0006-phase-ordering-metrics-before-ui.md)).

---

## §2 — Pipeline (upload → result)

The end-to-end flow from athlete uploading a clip to a written result row:

```text
Athlete uploads clip
      │
      ▼
┌─────────────────────────┐
│ Supabase Storage        │  video file lands in bucket
│ + INSERT athlete_uploads│  trigger row in lifecycle table
└──────────┬──────────────┘
           │  (DB webhook on INSERT)
           ▼
┌─────────────────────────────────────────────┐
│ Edge function: analyze-athlete-video        │  Deno; Supabase Edge Functions
│  - fetch node config                        │
│  - preflight validation                     │
│  - resolve detection frequency              │
│  - POST 4-key MediaPipe payload to Cloud Run│
└──────────┬──────────────────────────────────┘
           │  (HTTPS POST + NDJSON keepalive stream)
           ▼
┌─────────────────────────────────────────────┐
│ Cloud Run: mediapipe-service (FastAPI)      │  Python
│  - decode video                             │
│  - run RTMlib pose estimation               │
│  - dynamic calibration (line-pair detection)│
│  - return keypoints + scores + frame_count  │
│    + fps + body_based_ppy + calibration meta│
└──────────┬──────────────────────────────────┘
           │  (NDJSON result line)
           ▼
┌─────────────────────────────────────────────┐
│ Edge function (continued)                   │
│  - temporal smoothing                       │
│  - lock target person                       │
│  - resolveCalibration() → calibration_audit │  (ADR-0014 — body-based path)
│  - run metrics                              │
│  - run scoring rules                        │
│  - build Claude prompt                      │
│  - call Lovable AI Gateway (Anthropic)      │  (ADR-0003)
│  - INSERT athlete_lab_results               │
│  - UPDATE athlete_uploads.status='complete' │
└─────────────────────────────────────────────┘
```

Failure paths: any step that throws marks `athlete_uploads.status = 'failed'` with an error message; explicit cancellation path sets `status = 'cancelled'` mid-run.

For the step-by-step trace with file:line citations into the actual edge function and Cloud Run code, see [`pipeline-trace.md`](pipeline-trace.md).

---

## §3 — Infrastructure

Four infrastructure surfaces, each owned by a different platform:

| Layer | Provider | Role | Decision |
|---|---|---|---|
| IDE / build / preview / deploy | **Lovable** | Code editing, branch preview, production deploy | — (project foundation) |
| Backend (DB, RLS, auth, storage, edge functions) | **Lovable Cloud** (managed Supabase) | Postgres + Row-Level Security + Supabase Auth + Storage buckets + Deno-runtime edge functions | [ADR-0002](../adr/0002-lovable-cloud-default-backend.md) |
| Pose-estimation service | **Google Cloud Run** | Python FastAPI service (`mediapipe-service/`) running RTMlib pose estimation in a container; sized to handle long-running analysis with NDJSON keepalive streaming | [ADR-0009](../adr/0009-mediapipe-on-cloud-run.md) |
| LLM inference (feedback paragraph) | **Lovable AI Gateway** (Claude Sonnet 4.5) | Called from edge function with prompt assembled from node config + metric results | [ADR-0003](../adr/0003-lovable-ai-gateway-default-llm.md) |

User-facing language calls Lovable Cloud "the backend"; Supabase is internal terminology.

---

## §4 — Data flow & key tables

Three tables carry the bulk of the system's state:

### `athlete_lab_nodes` (admin authoring; JSONB-heavy)

Node definitions authored in the Athlete Lab. One row per drill/skill node. JSONB columns hold `key_metrics`, `phase_breakdown`, `knowledge_base`, `scoring_rules`, `error_definitions`, `llm_prompt_template`, `llm_system_instructions`, calibration parameters, and detection-frequency scenario settings. Tab structure (8 tabs post-Phase-1c.3-D) is the admin UI rendering of this row's contents.

Backup table: `athlete_lab_nodes_phase1c_backup` retains pre-migration row snapshots indefinitely ([ADR-0007](../adr/0007-backup-snapshot-pattern.md), [ADR-0012](../adr/0012-backup-retention-indefinite.md)). Disposition + slice metadata on each backup row makes rollback selection auditable (see slice 1c.3-E for the audit + taxonomy normalization pass).

### `athlete_uploads` (lifecycle / trigger)

One row per upload. Lifecycle: `pending → processing → complete | failed | cancelled`. INSERT fires the DB webhook that invokes `analyze-athlete-video`. Status transitions and progress messages are written by the edge function as it advances through the 13 pipeline steps.

### `athlete_lab_results` (write-back)

One row per completed analysis. `result_data` JSONB carries:
- `log_data` — the full `PipelineLogData` (preflight checks, rtmlib metadata, claude_api log, metric resolution trace)
- `calibration_audit` — the per-run calibration decision record (selected source, both candidate ppy values, line-pair count, confidence) — the ADR-0014 contract
- Cloud Run metadata (model version, frame count, fps, source-of-calibration label)
- Feedback paragraph from Claude

`metric_results`, `phase_scores`, `aggregate_score`, `detected_errors`, `confidence_flags` are dedicated columns alongside `result_data`.

### Other tables of note

- **User roles** in a separate `user_roles` table (per [ADR-0001](../adr/0001-user-roles-separate-table.md)) — never on profiles, never inferred client-side. `has_role(uuid, app_role)` is the security-definer function used in RLS policies.
- **Calibration ground-truth dataset** lives in YAML (`docs/reference/calibration/ground-truth.yaml`), not the DB; aggregated into `docs/reference/calibration-audit-rollup.csv` by `scripts/aggregate-calibration-audit.ts`.

---

## §5 — Client-side state

[Zustand](../adr/0010-zustand-for-shared-state.md) is the shared-state container for UI-level state in Brand HQ (`src/store/athleteStore.ts`, `src/store/userStore.ts`). Components never prop-drill; they subscribe. Persistent state lives in the database, not in localStorage (localStorage is reserved for transient UI state only).

---

## §6 — Phase ordering

Authoritative phase sequence lives in [`../roadmap.md`](../roadmap.md). High-level summary:

1. **Phase 1c** (in close-out) — pipeline, calibration, admin UI consolidation
2. **Phase 2 — metrics quality** (next, starting with 2a calibration robustness)
3. **Phase 3 — athlete UI** (the public Athlete Profile surface; gated on Phase 2 close per [ADR-0006](../adr/0006-phase-ordering-metrics-before-ui.md))

Cleanup-phase deferrals:
- No CI/CD (deferred per repo audit §5 R1)
- No hosted observability / Sentry (deferred per repo audit §5 R2; Cloud Run telemetry instrumented per `docs/reference/observability/_schema.md` when F-SLICE-E-2 escalation gate fires)

---

## §7 — Cross-references

- [`pipeline-trace.md`](pipeline-trace.md) — upload-by-upload trace with file:line citations
- [`athlete-lab-end-state-architecture.md`](athlete-lab-end-state-architecture.md) — Athlete-Lab-scoped deeper dive
- [`mediapipe-capability-inventory.md`](mediapipe-capability-inventory.md) — what the Cloud Run service can and can't do
- [`repo-architecture-audit.md`](repo-architecture-audit.md) — historical audit that drove the Phase 1c.2 cleanup
- [`../roadmap.md`](../roadmap.md) — phase ordering source of truth
- [`../adr/INDEX.md`](../adr/INDEX.md) — all 15 architectural decisions
- [`../risk-register/INDEX.md`](../risk-register/INDEX.md) — 25 risk + finding entries
