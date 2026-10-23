import { describe, expect, it } from "vitest";
import { coachRequestBody, MAX_COACH_OUTPUT_TOKENS } from "../../supabase/functions/analyze-athlete-video/coachRequest";
import { checkFeedback, buildFallbackFeedback } from "../../supabase/functions/analyze-athlete-video/prompt";

describe("fixed coaching output budget", () => {
  it.each(["anthropic", "lovable_ai"])("caps %s requests independently of node settings", provider => {
    expect(coachRequestBody(provider, "model", "system", "prompt").max_tokens).toBe(500);
    expect(MAX_COACH_OUTPUT_TOKENS).toBe(500);
  });
  it("still rejects 161 words even when they fit the token budget", () => {
    const response = Array(161).fill("go").join(" ");
    expect(response.split(" ").length).toBeLessThan(MAX_COACH_OUTPUT_TOKENS);
    expect(checkFeedback(response, true)).toMatchObject({ passed: false, violations: ["161 words (limit 160)"] });
    expect(checkFeedback(Array(160).fill("go").join(" "), true).passed).toBe(true);
    expect(checkFeedback(buildFallbackFeedback([], [], true), true).passed).toBe(true);
  });
});