# PlayCoach

Athlete identity platform. One link. Every dimension of who an athlete is — recruiting profile, highlight reel, AI development scores, stats, and NIL marketplace — published as a cinematic, chapter-based shareable page.

**Two surfaces:**

- **Brand HQ** — the authenticated builder where athletes create and manage their identity. `/builder`.
- **Athlete Profile** — the public page coaches, scouts, brands, and fans consume. `/:athleteSlug`.

The ProCard is the cover. The Athlete Profile is the magazine.

---

## Where to start

| If you are… | Read this first |
|---|---|
| A new agent / contributor | [`docs/agents/onboarding.md`](docs/agents/onboarding.md) → [`docs/INDEX.md`](docs/INDEX.md) |
| Looking for product narrative | [`VISION.md`](VISION.md) |
| Looking for build specs (components, design tokens, ProCard, color system) | [`PRODUCT-SPEC.md`](PRODUCT-SPEC.md) |
| Wanting the current roadmap | [`docs/roadmap.md`](docs/roadmap.md) |
| Looking up project terminology | [`docs/glossary.md`](docs/glossary.md) |
| Investigating a risk or finding | [`docs/migration-risk-register.md`](docs/migration-risk-register.md) (split layout coming in Phase 1c.2 cleanup Pass 4) |

---

## Tech stack

React 18 + Vite 5 + Tailwind CSS v3 + TypeScript 5. Zustand for shared state. Lovable Cloud (Supabase under the hood) for database, auth, and file storage. Pose analysis runs on a dedicated MediaPipe service deployed to Cloud Run, invoked from a Supabase edge function.

See [`docs/architecture/`](docs/architecture/) for the full architecture map (canonical doc: [`docs/architecture/athlete-lab-architecture-audit.md`](docs/architecture/athlete-lab-architecture-audit.md)).

---

## Project URLs

- Preview: `https://id-preview--cfe865e1-4bc3-41b9-8c08-3c8396055f20.lovable.app`
- Published: `https://happy-setup-hub.lovable.app`

---

## Status

Phase 1c.2 cleanup in progress (repo + IA foundation build). Phase 2 (metric quality) and Phase 3 (athlete UI) follow. See [`docs/roadmap.md`](docs/roadmap.md) for phase ordering and rationale.
