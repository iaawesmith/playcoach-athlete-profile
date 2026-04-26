---
id: ADR-0003
title: Lovable AI Gateway as the default LLM provider
status: accepted
date: 2026-04-26
deciders: workspace
related_risks: []
related_findings: []
supersedes: []
superseded_by: []
---

# ADR-0003 — Lovable AI Gateway as the default LLM provider

## Context

Athlete Lab generates per-clip coaching feedback via an LLM. The pipeline currently calls a single model (Claude family, via the prompt traced in `docs/investigations/claude-prompt-content-trace.md`). Future surfaces (Connect intake chat, AI drill scoring, athlete narrative generation) will need additional LLM calls.

Three provisioning options exist:

1. **User-provided OpenAI / Anthropic / Google API keys** — maximum flexibility, requires user signup/key rotation/billing setup per provider.
2. **Lovable AI Gateway** — managed access to a curated model set (Gemini 2.5 / 3.x family, GPT-5 family) with no per-provider API key required.
3. **A specific provider directly** (e.g., Anthropic-only) — locks the project to one vendor.

## Decision

Use the **Lovable AI Gateway** as the default LLM provider for all new AI capabilities. Only fall back to a user-provided API key when:

- The capability requires a model not in the Gateway's supported list, OR
- The user explicitly asks for a different provider.

When a feature spec is ambiguous about provider/model, default to Gemini 2.5 Flash for general use, GPT-5 Mini for nuanced reasoning, and Gemini 3 Flash Image Preview for image generation/editing.

## Consequences

- **Positive:** zero per-user API-key management; the Gateway handles auth, rotation, and rate limiting.
- **Positive:** model swaps happen at the Gateway level; existing call sites need only change a model string.
- **Positive:** keeps the project free of provider-specific SDK dependencies.
- **Negative:** Gateway model set is curated; bleeding-edge models or fine-tuned custom models are not available.
- **Negative:** ADR-bound — if PlayCoach ever needs a model the Gateway does not support, this decision needs an exception path documented as a follow-up ADR.

## Cross-links

- Workspace knowledge `cloud-project-info` → "Adding AI functionality" supported model list.
- `docs/investigations/claude-prompt-content-trace.md` — current Claude call site (predates this ADR; will be reviewed for Gateway migration in Phase 2).
