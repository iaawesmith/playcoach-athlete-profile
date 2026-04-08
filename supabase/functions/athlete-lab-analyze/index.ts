import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { node, videoDescription } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an elite sports biomechanics AI analyzing athletic performance.
You will be given a training node configuration and a description of an athlete's performance video.
Analyze the performance against the node's metrics, phases, and standards.

IMPORTANT: Return your response as valid JSON matching this exact schema:
{
  "overallScore": <number 0-100>,
  "phaseBreakdown": [{"phase": "<name>", "score": <0-100>, "feedback": "<specific actionable feedback for this phase>"}],
  "metricScores": [{"name": "<metric name>", "score": <0-100>, "value": "<measured value with unit>", "target": "<elite target with unit>", "difference": "<+/- difference from target>"}],
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "coachFeedback": "<detailed multi-paragraph coach feedback>",
  "confidence": <0.0-1.0>,
  "eliteComparison": "<1-2 sentence comparison to elite benchmark for this skill>",
  "warnings": ["<any data quality issues, e.g. missing reference object, poor angle>"]
}

Rules:
- Use the node's LLM prompt template to guide tone and structure of the coachFeedback field.
- Be specific: reference phases and metrics by name.
- Give actionable, coach-style feedback — not generic praise.
- For metricScores, include ALL metrics defined in the node config, even if estimated.
- For phaseBreakdown, include ALL phases defined in the node config.
- The "difference" field should show how far the measured value is from the elite target (e.g., "+0.3s", "-2 inches", "matches target").
- The "eliteComparison" field should reference the elite videos or pro mechanics description.
- The "warnings" array should flag issues like missing calibration reference, poor camera angle, or low-confidence estimates. Return empty array if no warnings.
- Strengths should be 2-4 items, improvements should be 2-4 items.`;

    const userPrompt = `TRAINING NODE CONFIGURATION:
Name: ${node.name}
Overview: ${node.overview}
Pro Mechanics: ${node.pro_mechanics}
Key Metrics: ${JSON.stringify(node.key_metrics)}
Scoring Rules: ${node.scoring_rules}
Common Errors: ${JSON.stringify(node.common_errors)}
Phase Breakdown: ${JSON.stringify(node.phase_breakdown)}
Form Checkpoints: ${JSON.stringify(node.form_checkpoints)}
LLM Prompt Template: ${node.llm_prompt_template}
Elite Videos: ${JSON.stringify(node.elite_videos)}
Camera Guidelines: ${node.camera_guidelines}
Reference Object: ${node.reference_object}

ATHLETE PERFORMANCE DESCRIPTION:
${videoDescription}

Analyze this performance and return the JSON response.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — please try again in a moment" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted — add funds at Settings > Workspace > Usage" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "No response from AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(content);

    // Ensure warnings and eliteComparison exist even if model omits them
    if (!parsed.warnings) parsed.warnings = [];
    if (!parsed.eliteComparison) parsed.eliteComparison = "";

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("athlete-lab-analyze error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
