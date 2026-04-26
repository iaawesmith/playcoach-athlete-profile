# Observability — schema (scaffolding)

> **Pass 5d scaffolding.** This directory anchors the observability contract: which signals (logs, traces, metrics, dashboards) exist for which subsystem, where they live, and who owns them. The Phase 1c.2 deliverable that motivated this scaffold is [`docs/reference/run-analysis-observability-audit.md`](../run-analysis-observability-audit.md) — that audit becomes the first occupant of the rollup.

## Purpose

Observability docs answer three operational questions at a glance:

1. *Where do I look* when subsystem X misbehaves?
2. *What signal* tells me the difference between a known issue and a new one?
3. *What is the SLO / tolerance* I am measuring against?

## File layout

- `_schema.md` (this file).
- `INDEX.md` — aggregated table of subsystem → signals → dashboard/log path → owner. Created when ≥2 subsystem files exist.
- One file per subsystem: `<subsystem-slug>.md` (e.g., `athlete-lab-pipeline.md`, `mediapipe-cloud-run.md`, `edge-function-analyze-athlete-video.md`).

## Frontmatter contract

```yaml
---
subsystem_id: <kebab-slug, immutable>
title: <one-line summary>
owner: <role or person — e.g., "platform", "athlete-lab">
log_sources: []                               # e.g., ["supabase edge function logs:analyze-athlete-video", "cloud-run:mediapipe-service"]
trace_sources: []
metric_sources: []                            # references to docs/reference/metrics/<metric_id>.md
event_sources: []                             # references to docs/reference/events/<event_id>.md
dashboards: []                                # URLs or stable references — annotate "internal" / "supabase" / "gcp"
slos: []                                      # short SLO statements; full SLO doc separate if needed
related_adrs: []
related_entries: []
status: active | proposed | deprecated
last_updated: YYYY-MM-DD
---
```

## Body shape

1. **What this subsystem does** — one paragraph.
2. **Health check** — the fastest signal that proves the subsystem is healthy right now.
3. **Common failures** — table of symptom → likely cause → first place to look.
4. **Audit history** — links to the audit docs that produced this entry (e.g., `run-analysis-observability-audit.md`).

## Anti-patterns

- Do **not** list dashboards without verifying the URL/path resolves at the time of the edit.
- Do **not** invent SLOs without an ADR backing or stakeholder sign-off; mark them `proposed` instead.
- Do **not** duplicate metric definitions here; reference `docs/reference/metrics/` instead.
