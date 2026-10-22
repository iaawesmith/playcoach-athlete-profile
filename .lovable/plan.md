# Configurable, comparable coaching model

Production stays on today's model (Anthropic `claude-sonnet-4-5`, called with the project's Anthropic key) until you pick one. Everything below is either additive or runs only in the admin replay.

## 1. One setting, overridable per node

- **Workspace default:** provider + exact model, stored as one admin setting row. It is seeded with today's value, so nothing changes.
- **Per-node override:** an optional provider + model on the node. When it's empty, the node uses the default. Every node starts empty, Slant included.
- **Providers offered:**
  - **Anthropic, direct.** Today's path, using your Anthropic key.
  - **Built-in AI (OpenAI / ChatGPT models, also Google and Anthropic).** Runs through Lovable's built-in AI with no extra key, billed to workspace credits.
- **Exact versions:** the model field takes a full id, and the save is refused when it isn't one.
  - Anthropic and OpenAI let you pin a dated snapshot (for example `claude-sonnet-4-5-20250929`). A floating name like `claude-sonnet-4-5` is flagged as "may change under you."
  - Built-in AI ids are shown as offered. The comparison records the exact model the provider reports back, so you can see whether it drifts.
- **Editor:** a "Coaching model" control in admin settings and on the node's coaching tab. It shows the current effective model and where it comes from (default or node).

## 2. Recorded on every run

Each run stores, in the log and the diagnostic export:
- the provider
- the requested model id
- the exact model the provider reports back
- where the setting came from (default, node or replay)
- tokens, cost if reported, and response time

Older runs show "not recorded."

## 3. Comparison replay (admin only, writes nothing)

- **Input:** a list of stored result IDs, a list of provider + model pairs, and N replays per result per model (capped so a run stays within time limits). If it's too large, it runs in batches.
- **Each replay:** uses the stored metrics, rescored with the node's current scoring, then the same prompt, check, retry and fallback as production.
- **Per-model report:**
  - first-draft pass rate
  - violations by type (level-of-play, solo-rep words, length)
  - retries
  - fallbacks
  - average words
  - cost (provider-reported tokens times list price; built-in AI credit cost from its request log)
  - average and slowest response time
- **Side by side:** every final response, grouped by result, one column per model, each tagged with pass / retried / fallback.
- **Where to see it:** an admin "Model comparison" panel in Athlete Lab. It shows the report and lets you copy it out. Nothing is saved to results.

## 4. Data handling and retention report

Before building, I'll research the current published terms for each option and report them with links:
- **Anthropic API, direct:** training use, retention period, zero-retention availability, age requirements.
- **OpenAI models through built-in AI:** the same points, plus what the built-in route itself logs and how long it keeps it.
- **Google and Anthropic models through built-in AI:** the same points.

The report notes what athlete data each prompt actually contains today: the first name, athlete level, metrics and clip context. No video or images are sent. It also covers what that means for minors, and anything I can't verify from published terms. Only measured data is sent; first names could be replaced with "Athlete" if you want that.

## 5. Going live

You pick a model from the comparison, and only then do I change the workspace default (or one node's override). Nothing changes in production before that.

## Technical details

- A new `coaching_model_settings` table (single row) holds `provider`, `model`, `updated_at`. It is service-role only, with GRANTs and RLS, and read and written through an admin function, the same as the calibration clips (F-SEC-1 still applies until admin login exists).
- The nullable `coaching_provider` and `coaching_model` columns on `athlete_lab_nodes` are additive.
- A pure `supabase/functions/analyze-athlete-video/llm.ts` holds the provider adapter interface, Anthropic and built-in AI adapters, model-id validation and resolution (node, then default, then hard-coded current). Resolution and validation are unit-tested from `src/test`.
- `callClaude` becomes `callCoachModel(resolved)` and returns `{ text, provider, requested_model, reported_model, tokens, ms }`. The check, retry and fallback stay unchanged.
- `admin-replay-feedback` gets a `compare` mode `{ resultIds[], models[], n }`. It forces the model for the replay only, never reads or writes the setting, and aggregates in a pure, tested helper.
- The diagnostic export and Analysis Log read the new `llm` block, and older runs show `not_recorded`.
- AGENTS.md gets one rule: the coaching model is resolved in one place, and replays may override it without persisting anything.
