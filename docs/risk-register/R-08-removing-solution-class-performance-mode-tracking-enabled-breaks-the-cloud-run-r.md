---
id: R-08
title: Removing `solution_class`, `performance_mode`, `tracking_enabled` breaks the Cloud Run request shape
status: open
severity: Sev-1
origin_slice: 1c.2
origin_doc: docs/migration-risk-register.md  # original-batch entry
related_adrs: []
related_entries: []
opened: 2026-04-25
last_updated: 2026-04-25
---
# R-08 — Removing `solution_class`, `performance_mode`, `tracking_enabled` breaks the Cloud Run request shape
- **Phase:** 1c.2
- **Severity:** Sev-1 if uncoordinated, Sev-4 if sequenced correctly
- **Likelihood:** Medium
- **What happens:** `analyze-athlete-video/index.ts:651-660` posts these fields to the service. `mediapipe-service/app/schema.py` accepts-but-ignores them. If the edge function stops sending them before the service drops them from `AnalyzeRequest`, nothing breaks (Pydantic optional). If the service drops them first while edge keeps sending, also fine. But if anyone tightens `AnalyzeRequest` to forbid extras (`extra = "forbid"`), order matters.
- **Mitigation:**
  1. Service-side: explicitly leave `extra = "ignore"` (Pydantic default) on `AnalyzeRequest` for the duration of 1c.
  2. Edge-side: stop sending the three fields **before** removing them from the DB.
- **Trigger to pause:** Any 4xx from `/analyze` mentioning unexpected fields.
