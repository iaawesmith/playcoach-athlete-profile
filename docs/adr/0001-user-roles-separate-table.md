---
id: ADR-0001
title: User roles in a separate `user_roles` table (never on `profiles`)
status: accepted
date: 2026-04-26
deciders: workspace
related_risks: []
related_findings: [F-SEC-1]
supersedes: []
superseded_by: []
---

# ADR-0001 — User roles in a separate `user_roles` table

## Context

The standard temptation when adding role-based access is to put a `role` column on `profiles` (or directly on `auth.users` in custom tables). Both patterns are vulnerable to **privilege escalation** because:

1. RLS policies on the user's own profile row let them read/write their own data — including any role column.
2. Even if RLS forbids writing the role column, application code that updates "the rest" of a profile row often re-sends all fields, accidentally permitting role tampering.
3. Roles checked in policies that reference the same table being protected create recursive RLS evaluation.

PlayCoach has zero shipped admin surface today (Phase 1c is pre-public-launch), but the admin tabs in `src/features/athleteLab/` and the planned coach/scout views (Phase 3+) require a clear answer before any role-gated feature ships.

## Decision

Roles live in a dedicated `user_roles` table:

- `id uuid PK`, `user_id uuid` references `auth.users(id) on delete cascade`, `role app_role not null`, `unique(user_id, role)`.
- `app_role` is a Postgres `enum` (initial values: `admin`, `moderator`, `user`).
- A `SECURITY DEFINER` function `public.has_role(_user_id uuid, _role app_role) returns boolean` is the only way to check role membership in RLS policies and edge functions. Direct `EXISTS` on `user_roles` from policy bodies is forbidden.
- RLS on `user_roles` itself: enabled, no public read, no self-insert. Role grants happen via a service-role-only path.

## Consequences

- **Positive:** privilege-escalation surface is small and auditable; recursive RLS impossible because the check function bypasses RLS via SECURITY DEFINER.
- **Positive:** multiple roles per user supported by design (`unique(user_id, role)`).
- **Negative:** an extra join for every role check. Acceptable — `has_role` is a single index lookup and the function is `stable`.
- **Operational:** role grants cannot be done from the client. They must go through a server-side path (edge function or migration). This is the desired property.

## Cross-links

- Workspace project knowledge: "Roles MUST be stored in a separate table…"
- F-SEC-1 (`docs/migration-risk-register.md`) — current admin tables have permissive RLS; the role table pattern is the prerequisite for tightening.
