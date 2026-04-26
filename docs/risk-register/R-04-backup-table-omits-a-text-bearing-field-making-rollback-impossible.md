---
id: R-04
title: Backup table omits a text-bearing field, making rollback impossible
status: open
severity: Sev-1
origin_slice: 1c.2
origin_doc: docs/migration-risk-register.md  # original-batch entry
related_adrs: [ADR-0007, ADR-0012]
related_entries: []
opened: 2026-04-25
last_updated: 2026-04-25
---
# R-04 — Backup table omits a text-bearing field, making rollback impossible
- **Phase:** 1c.2
- **Severity:** Sev-1
- **Likelihood:** Medium
- **What happens:** The `athlete_lab_nodes_phase1c_backup` table is meant to preserve every text-bearing field deleted in 1c.2 (per Default B + your addition: indefinite retention). If the migration script forgets a JSON sub-field (e.g., `reference_calibrations[].calibration_notes`), that admin-authored content is lost permanently.
- **Mitigation:**
  1. Backup table schema is **the union of all DELETE 1c.2 fields enumerated in End-State Architecture §2.9**, columns named `<source_column>` for root and `<source_column>__<sub_field>` for JSON sub-fields, plus `node_id` and `backed_up_at`.
  2. Pre-migration assertion: for every node, every listed field's text content exists in the backup row before any DROP runs.
  3. Backup table is RLS-locked to service_role only; no automatic delete; no TTL.
- **Trigger to pause:** Pre-migration assertion fails for any node.
