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
  "phaseBreakdown": [{"phase": "<name>", "score": <0-100>, "feedback": "<specific feedback>"}],
  "metricScores": [{"name": "<metric name>", "score": <0-100>, "value": "<measured value>", "target": "<elite target>"}],
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"],
  "coachFeedback": "<detailed coach feedback paragraph>",
  "confidence": <0.0-1.0>
}

Use the node's LLM prompt template to guide tone and structure of the coachFeedback field.
Be specific, reference phases and metrics by name, and give actionable feedback.`;

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
