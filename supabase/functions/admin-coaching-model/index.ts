// Admin: read/change the workspace coaching model, list built-in options,
// and check what an Anthropic alias resolves to. Same trust level as the
// other admin-* functions (F-SEC-1). Model ids are validated server-side.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateCoachModel } from "../_shared/coachModel.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Server misconfigured" }, 500);
  const supabase = createClient(url, key);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Expected JSON body" }, 400); }
  const action = body.action;

  if (action === "get") {
    const { data } = await supabase.from("coaching_model_settings").select("provider, model, updated_at").eq("id", true).maybeSingle();
    const options: Array<{ id: string; deprecated: boolean; retention: string }> = [];
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/models", { headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}` } });
      if (res.ok) {
        const cat = await res.json() as { data?: Array<Record<string, any>> };
        for (const m of cat.data ?? []) {
          if (typeof m.id !== "string" || !/^(openai|google)\//.test(m.id)) continue;
          const chat = m.data_retention_by_surface?.["chat-completions"];
          if (!chat) continue;
          options.push({ id: m.id, deprecated: Boolean(m.deprecated), retention: String(chat) });
        }
      }
    } catch { /* options stay empty */ }
    return json({ default: data, builtin_options: options });
  }

  if (action === "resolve_anthropic") {
    const alias = typeof body.model === "string" ? body.model : "";
    if (!/^claude-[a-z0-9.-]+$/.test(alias)) return json({ error: "not an Anthropic model id" }, 400);
    const res = await fetch(`https://api.anthropic.com/v1/models/${alias}`, {
      headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "", "anthropic-version": "2023-06-01" },
    });
    const text = await res.text();
    if (!res.ok) return json({ error: "Anthropic lookup failed", status: res.status, details: text.slice(0, 300) }, res.status);
    const m = JSON.parse(text) as { id?: string; display_name?: string; created_at?: string };
    return json({ alias, resolved_id: m.id ?? null, display_name: m.display_name ?? null, created_at: m.created_at ?? null });
  }

  if (action === "set_default") {
    const v = validateCoachModel(body.provider, body.model);
    if (!v.ok) return json({ error: v.reason }, 400);
    if (body.provider === "anthropic" && !v.pinned) return json({ error: "pin a dated Anthropic snapshot for the default" }, 400);
    const { data, error } = await supabase.from("coaching_model_settings")
      .upsert({ id: true, provider: body.provider, model: String(body.model).trim(), updated_at: new Date().toISOString() })
      .select("provider, model, updated_at").single();
    if (error) return json({ error: error.message }, 500);
    return json({ default: data });
  }

  return json({ error: "unknown action" }, 400);
});
