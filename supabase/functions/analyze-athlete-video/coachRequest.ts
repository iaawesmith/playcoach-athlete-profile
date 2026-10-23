/** Fixed output budget, independent of preserved legacy node settings. */
export const MAX_COACH_OUTPUT_TOKENS = 500;

export function coachRequestBody(provider: string, model: string, system: string, prompt: string) {
  return provider === 'anthropic'
    ? { model, max_tokens: MAX_COACH_OUTPUT_TOKENS, system, messages: [{ role: 'user', content: prompt }] }
    : { model, max_tokens: MAX_COACH_OUTPUT_TOKENS, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] };
}