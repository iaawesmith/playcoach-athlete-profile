# Events — schema (scaffolding)

> **Pass 5c scaffolding.** This directory will hold the event taxonomy for analytics, observability, and lifecycle hooks. At scaffold time the codebase emits no formal product analytics events; this directory anchors the contract for when they begin to appear (Phase 1c.3+ or post-1c).

## Purpose

An *event* is a discrete, named occurrence — emitted by the client, an edge function, or a Cloud Run worker — that we record for analytics, debugging, or downstream automation. Event names are append-only contracts; renaming or repurposing an existing `event_id` is a breaking change.

## File layout

- One file per event: `<event_id>.md` (e.g., `athlete_video_uploaded.md`, `pipeline_run_completed.md`).
- `event_id` MUST be `snake_case`, present-tense or past-tense verb phrase, and stable across the entire stack.

## Frontmatter contract

```yaml
---
event_id: <snake_case, immutable>
title: <one-line human label>
emitter: client | edge-function | cloud-run | external-webhook
trigger: <plain-English condition that fires the event>
payload_schema: { <field>: <type>, ... }     # required & optional fields, types
required_fields: []
pii_fields: []                                # explicitly mark any PII so handlers can scrub/route
status: proposed | active | deprecated
introduced_in: <slice id>
related_adrs: []
related_entries: []
last_updated: YYYY-MM-DD
---
```

## Body shape

1. **Description** — when and why this event fires.
2. **Payload example** — fenced JSON block.
3. **Consumers** — analytics destination, dashboards, downstream handlers.
4. **Versioning policy** — additive changes only; new required field ⇒ new event.

## Anti-patterns

- Do **not** reuse an `event_id` for a different semantic meaning. Deprecate and create a new one.
- Do **not** emit events with PII unless the field is explicitly listed in `pii_fields` and a downstream scrubbing path exists.
- Do **not** create events that duplicate existing ones; check this directory first.
