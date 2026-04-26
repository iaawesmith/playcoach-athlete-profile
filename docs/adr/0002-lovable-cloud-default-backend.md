---
id: ADR-0002
title: Lovable Cloud as the default backend (no external Supabase project)
status: accepted
date: 2026-04-26
deciders: workspace
related_risks: []
related_findings: []
supersedes: []
superseded_by: []
---

# ADR-0002 — Lovable Cloud as the default backend

## Context

The project needs database, auth, file storage, and edge functions. Two paths exist:

1. **Lovable Cloud** — managed Supabase provisioned by Lovable, no external account, automatic environment wiring.
2. **External Supabase project** — user creates a Supabase account, manually wires URL/anon key.

Both deliver the same Postgres + RLS + Storage + Edge Functions stack. The choice is ergonomics and operational ownership, not capability.

## Decision

Use **Lovable Cloud** as the default and only backend for PlayCoach. Treat the underlying Supabase implementation as an internal detail. User-facing communication says "Lovable Cloud," "the backend," "the database" — never "Supabase" — except in error messages or technical documentation where the distinction is operationally relevant.

## Consequences

- **Positive:** zero-setup backend; environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) auto-managed via `.env`.
- **Positive:** the `supabase/` directory is the canonical source of truth for migrations and edge functions; deployments happen automatically on edit.
- **Positive:** secrets management goes through the Lovable secrets UI, not committed `.env` values.
- **Negative:** disabling Cloud is a one-way door (not undoable on the same project) — committing to Cloud means committing for the project lifetime.
- **Negative:** some Supabase Dashboard features are not exposed in the Lovable Cloud UI; a few admin tasks require the underlying Supabase dashboard.

## Cross-links

- `cloud-project-info` directive in workspace knowledge.
- ADR-0001 (uses the Cloud-provided `auth.users` and Postgres for the role table).
