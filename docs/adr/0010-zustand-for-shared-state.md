---
id: ADR-0010
title: Zustand for shared client state (no Redux, no React Context for shared mutable state)
status: accepted
date: 2026-04-26
deciders: workspace
related_risks: []
related_findings: []
supersedes: []
superseded_by: []
---

# ADR-0010 — Zustand for shared client state

## Context

PlayCoach's builder UI has cross-component shared state (athlete profile data, teamColor, completion percentage, current section) that needs to be readable and updatable from many components without prop drilling. Three patterns exist for this in React:

1. **React Context + `useReducer`** — built-in, no dep. But: re-renders all consumers on any update, awkward for partial subscriptions, boilerplate-heavy reducer setup.
2. **Redux + Redux Toolkit** — mature, devtools, time-travel debugging. But: heavy boilerplate (slices, actions, reducers, selectors), large API surface, and PlayCoach's state is small enough not to need it.
3. **Zustand** — lightweight (1.5 KB), hook-based, partial subscriptions via selector function, no provider needed.

## Decision

Use **Zustand** for all shared mutable client state. Local-only state stays in `useState`. Persisted state goes through Lovable Cloud (database / Storage), not localStorage, except for ephemeral UI state (e.g., "is sidebar collapsed" preference).

Conventions:

- Stores live in `src/store/<entity>Store.ts` with named export `use<Entity>Store` (e.g., `useAthleteStore`).
- One store per major domain entity. Do not split into many small stores.
- Selectors: components subscribe via `useAthleteStore((s) => s.firstName)`, never `const store = useAthleteStore()` (over-subscription).
- Store interface lives in the same file as the store; no separate types file.

## Consequences

- **Positive:** zero ceremony to add or change shared state.
- **Positive:** partial subscriptions prevent re-renders on unrelated updates.
- **Positive:** matches workspace/project knowledge convention — already documented as the standard.
- **Negative:** no built-in time-travel devtools (Redux DevTools integration available but not enabled by default).
- **Negative:** loose convention enforcement — over-subscription bugs are easy to introduce. Code review covers this.

## Cross-links

- Workspace knowledge "Stack" → State.
- Project knowledge "Component Names" and "Zustand Store" sections → `src/store/athleteStore.ts`.
