# Coaching model options — data handling and retention (Oct 22 2026)

What each coaching prompt contains: metric values/targets/scores, phase scores, triggered error names, run context (people in video, camera angle, catch, athlete level, focus area), node prompt text. No video, images, keypoints, IDs or athlete names: prompts always say "Athlete"; the real first name is inserted into the final response only after generation and after the feedback check (production and replays).

## Anthropic API (direct, today's production path)
- Inputs/outputs deleted from Anthropic's backend within 30 days, unless longer retention is needed to enforce the Usage Policy, required by law, or covered by a separate agreement (https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data).
- Flagged content: up to 2 years (inputs/outputs), 7 years (classifier scores) (same source).
- Not used for training without express permission (https://platform.claude.com/docs/en/manage-claude/api-and-data-retention).
- Zero data retention available only by per-organization agreement with Anthropic sales (https://privacy.claude.com/en/articles/8956058).
- Minors: organizations serving minors are expected to add safeguards (age verification, moderation, monitoring) and comply with COPPA etc. (https://support.claude.com/en/articles/9307344).

## Built-in AI — OpenAI and Google chat models
- The built-in model catalog marks the chat-completions endpoint for every offered openai/* and google/* chat model as zero retention ("zero"), read live from the catalog on Oct 22 2026.
- Anthropic models through the built-in route are marked provider_retained and are not offered for coaching.
- Not verified here: what the built-in route itself logs about each request and for how long — see Lovable's privacy policy and terms.

## Open items
- Confirm minors-related obligations for OpenAI and Google with their published terms before choosing either.
