import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1c.1 SLICE 1 — Template variable substitution + token-budget hard fail
//
// Design principles (binding):
//   1. Shape-agnostic: no code path may assume node shape, phase count, names,
//      or content length. All rendering iterates phase_breakdown[] with no
//      hardcoded indices and no per-node tuning.
//   2. Hard fail over silent truncation: when projected prompt tokens exceed
//      0.85 × model_context_window, return HTTP 413 with a structured error
//      body so the admin can lower phase_context_mode or trim content.
//   3. Substitution is a simple find-and-replace of `{{var}}` tokens. Unknown
//      tokens are left intact and reported back via the existing
//      AnalysisResult.warnings[] channel, prefixed with "[template] ".
// ─────────────────────────────────────────────────────────────────────────────

const JSON_SCHEMA_SYSTEM_PROMPT = `You are an elite sports biomechanics AI analyzing athletic performance.
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

// Model context windows. Conservative; update when models change.
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "google/gemini-3-flash-preview": 128_000,
  "google/gemini-2.5-flash": 128_000,
  "google/gemini-2.5-pro": 200_000,
  "openai/gpt-5": 200_000,
  "openai/gpt-5-mini": 128_000,
};
const DEFAULT_MODEL = "google/gemini-3-flash-preview";
const TOKEN_BUDGET_RATIO = 0.85;

type PhaseContextMode = "off" | "names_only" | "compact" | "full";
const ALLOWED_PHASE_CONTEXT_MODES: PhaseContextMode[] = ["off", "names_only", "compact", "full"];

interface PhaseLike {
  name?: string;
  sequence_order?: number;
  proportion_weight?: number;
  frame_buffer?: number;
  description?: string;
  coaching_cues?: string | string[];
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + "…";
}

function coachingCuesToString(cues: unknown): string {
  if (!cues) return "";
  if (Array.isArray(cues)) return cues.filter((c) => typeof c === "string").join(" ");
  if (typeof cues === "string") return cues;
  return "";
}

function renderPhaseContext(phases: unknown, mode: PhaseContextMode): string {
  if (mode === "off") return "";
  if (!Array.isArray(phases) || phases.length === 0) return "";

  // Sort by sequence_order if present; otherwise preserve array order.
  const ordered: PhaseLike[] = [...phases as PhaseLike[]].sort((a, b) => {
    const ao = typeof a?.sequence_order === "number" ? a.sequence_order : 0;
    const bo = typeof b?.sequence_order === "number" ? b.sequence_order : 0;
    return ao - bo;
  });

  if (mode === "names_only") {
    return ordered
      .map((p, i) => {
        const order = typeof p.sequence_order === "number" ? p.sequence_order : i + 1;
        const name = (p.name ?? `Phase ${order}`).trim();
        return `${order}. ${name}`;
      })
      .join("\n");
  }

  if (mode === "compact") {
    return ordered
      .map((p, i) => {
        const order = typeof p.sequence_order === "number" ? p.sequence_order : i + 1;
        const name = (p.name ?? `Phase ${order}`).trim();
        const weight = typeof p.proportion_weight === "number" ? ` (weight ${p.proportion_weight})` : "";
        const desc = clip((p.description ?? "").trim(), 200);
        const cuesStr = coachingCuesToString(p.coaching_cues);
        const cuesNote = cuesStr ? ` [${cuesStr.length} chars of coaching cues]` : "";
        return `${order}. ${name}${weight}${cuesNote}${desc ? `\n   ${desc}` : ""}`;
      })
      .join("\n");
  }

  // full
  return ordered
    .map((p, i) => {
      const order = typeof p.sequence_order === "number" ? p.sequence_order : i + 1;
      const name = (p.name ?? `Phase ${order}`).trim();
      const weight = typeof p.proportion_weight === "number" ? ` (weight ${p.proportion_weight})` : "";
      const fb = typeof p.frame_buffer === "number" ? ` [frame_buffer=${p.frame_buffer}]` : "";
      const desc = (p.description ?? "").trim();
      const cuesStr = coachingCuesToString(p.coaching_cues).trim();
      const lines = [`${order}. ${name}${weight}${fb}`];
      if (desc) lines.push(`   Description: ${desc}`);
      if (cuesStr) lines.push(`   Coaching cues: ${cuesStr}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

function substitute(template: string, vars: Record<string, string>): { output: string; unknown: string[] } {
  const unknown = new Set<string>();
  const output = template.replace(/\{\{([a-z0-9_]+)\}\}/gi, (match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) return vars[name];
    unknown.add(name);
    return match;
  });
  return { output, unknown: [...unknown] };
}

function estimateTokens(s: string): number {
  // ~4 chars/token is a conservative default for English mixed content.
  return Math.ceil(s.length / 4);
}

function normalizePhaseContextMode(raw: unknown): { mode: PhaseContextMode; warning: string | null } {
  if (typeof raw === "string" && (ALLOWED_PHASE_CONTEXT_MODES as string[]).includes(raw)) {
    return { mode: raw as PhaseContextMode, warning: null };
  }
  if (raw === undefined || raw === null || raw === "") {
    return { mode: "compact", warning: null };
  }
  return {
    mode: "compact",
    warning: `[template] phase_context_mode value ${JSON.stringify(raw)} is invalid; falling back to "compact". Allowed: ${ALLOWED_PHASE_CONTEXT_MODES.join(", ")}.`,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { node, videoDescription, analysis_context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const templateWarnings: string[] = [];

    // 1. Resolve phase_context_mode (defaults to "compact" when absent/invalid).
    const { mode: phaseContextMode, warning: modeWarning } = normalizePhaseContextMode(
      (node ?? {}).phase_context_mode,
    );
    if (modeWarning) templateWarnings.push(modeWarning);

    // 2. Build template variable map.
    const phaseContext = renderPhaseContext((node ?? {}).phase_breakdown, phaseContextMode);
    const templateVars: Record<string, string> = {
      phase_context: phaseContext,
      scoring_rules: (node?.scoring_rules ?? "").toString(),
      node_overview: (node?.overview ?? "").toString(),
      node_name: (node?.name ?? "").toString(),
    };

    // 3. Build context-aware additions to user prompt (preserved from prior behavior).
    let contextBlock = "";
    if (analysis_context) {
      contextBlock = `\n\nANALYSIS CONTEXT (from athlete pre-upload):
Camera Angle: ${analysis_context.camera_angle ?? "unknown"}
People in Video: ${analysis_context.people_in_video ?? "unknown"}
Route Direction: ${analysis_context.route_direction ?? "unknown"}
Catch Included: ${analysis_context.catch_status ?? "unknown"}
Athlete Level: ${analysis_context.athlete_level ?? "unknown"}
Focus Area: ${analysis_context.focus_area || "Not specified"}
`;
    }

    // 4. Assemble user prompt.
    //    If llm_prompt_template is provided, substitute and use it.
    //    Otherwise fall back to the previous concatenated dump (preserves
    //    today's behavior for nodes without a template).
    let userPrompt: string;
    const tmpl = (node?.llm_prompt_template ?? "").toString().trim();
    if (tmpl.length > 0) {
      const { output, unknown } = substitute(tmpl, templateVars);
      if (unknown.length > 0) {
        templateWarnings.push(
          `[template] Unknown variable(s) in llm_prompt_template left as literal text: ${unknown
            .map((v) => `{{${v}}}`)
            .join(", ")}. They were not substituted.`,
        );
      }
      userPrompt = `${output}\n${contextBlock}\nATHLETE PERFORMANCE DESCRIPTION:\n${videoDescription ?? ""}\n\nReturn the JSON response.`;
    } else {
      // Backwards-compatible raw-dump fallback. Phase context still injected.
      userPrompt = `TRAINING NODE CONFIGURATION:
Name: ${node.name}
Overview: ${node.overview}
Pro Mechanics: ${node.pro_mechanics ?? ""}
Key Metrics: ${JSON.stringify(node.key_metrics ?? [])}
Scoring Rules: ${node.scoring_rules ?? ""}
Common Errors: ${JSON.stringify(node.common_errors ?? [])}
Phase Breakdown: ${JSON.stringify(node.phase_breakdown ?? [])}
Phase Context (${phaseContextMode}):
${phaseContext}
Form Checkpoints: ${JSON.stringify(node.form_checkpoints ?? [])}
LLM Prompt Template: ${node.llm_prompt_template ?? ""}
Elite Videos: ${JSON.stringify(node.elite_videos ?? [])}
Camera Guidelines: ${node.camera_guidelines ?? ""}
Reference Object: ${node.reference_object ?? ""}
${contextBlock}
ATHLETE PERFORMANCE DESCRIPTION:
${videoDescription ?? ""}

Analyze this performance and return the JSON response.`;
    }

    // 5. Assemble system prompt: structural JSON-schema rules +
    //    optional substituted llm_system_instructions appended below.
    //    NOTE: This is a behavior change. Previously llm_system_instructions
    //    was unread. R-02 trade is fixture comparison during step 5
    //    (Slant is the only live node and ships with empty system instructions).
    const sysInstr = (node?.llm_system_instructions ?? "").toString().trim();
    let systemPrompt = JSON_SCHEMA_SYSTEM_PROMPT;
    if (sysInstr.length > 0) {
      const { output, unknown } = substitute(sysInstr, templateVars);
      if (unknown.length > 0) {
        templateWarnings.push(
          `[template] Unknown variable(s) in llm_system_instructions left as literal text: ${unknown
            .map((v) => `{{${v}}}`)
            .join(", ")}.`,
        );
      }
      systemPrompt = `${JSON_SCHEMA_SYSTEM_PROMPT}\n\nADDITIONAL INSTRUCTIONS:\n${output}`;
    }

    // 6. Token-budget hard fail (no silent truncation).
    const model = DEFAULT_MODEL;
    const ctx = MODEL_CONTEXT_WINDOWS[model] ?? 128_000;
    const limit = Math.floor(ctx * TOKEN_BUDGET_RATIO);
    const estimated = estimateTokens(systemPrompt) + estimateTokens(userPrompt);
    if (estimated > limit) {
      return new Response(
        JSON.stringify({
          error: "prompt_token_budget_exceeded",
          estimated_tokens: estimated,
          limit,
          model,
          phase_context_mode: phaseContextMode,
          suggestion:
            "Set phase_context_mode to 'compact' or 'names_only' on this node, or trim phase descriptions / coaching cues / scoring_rules.",
          template_warnings: templateWarnings,
        }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited — please try again in a moment" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credits exhausted — add funds at Settings > Workspace > Usage" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
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

    // Ensure warnings and eliteComparison exist even if model omits them.
    if (!Array.isArray(parsed.warnings)) parsed.warnings = [];
    if (!parsed.eliteComparison) parsed.eliteComparison = "";

    // Prepend template warnings (already prefixed with "[template] ").
    if (templateWarnings.length > 0) {
      parsed.warnings = [...templateWarnings, ...parsed.warnings];
    }

    // Persist result with node_version.
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, supabaseKey);
      await sb.from("athlete_lab_results").insert({
        node_id: node.id,
        node_version: node.node_version ?? 1,
        video_description: videoDescription ?? "",
        overall_score: typeof parsed.overallScore === "number" ? parsed.overallScore : null,
        result_data: parsed,
      });
    } catch (_persistErr) {
      // Don't fail the response if persistence fails.
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("athlete-lab-analyze error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
