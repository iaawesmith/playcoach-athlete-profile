// Admin prompt-tuning tool: replays a stored result's coaching feedback
// through the analyzer's current prompt (no pose run, nothing saved).
// Same trust level as the other admin-* functions (see F-SEC-1).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server misconfigured" }, 500);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Expected JSON body" }, 400);
  }
  const mode = (body as { mode?: unknown })?.mode;
  if (mode === "estimate" || mode === "compare") {
    // Model comparison: the analyzer refuses unless COACH_COMPARE_SECRET is set and matches.
    const b = body as Record<string, unknown>;
    const res = await fetch(`${supabaseUrl}/functions/v1/analyze-athlete-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
      body: JSON.stringify({
        mode, result_ids: b.resultIds, models: b.models, n: b.n,
        compare_secret: b.compareSecret, confirm_token: b.confirmToken,
      }),
    });
    return json(await res.json(), res.status);
  }
  const resultId = (body as { resultId?: unknown })?.resultId;
  const count = (body as { count?: unknown })?.count;
  if (typeof resultId !== "string" || !/^[0-9a-f-]{36}$/i.test(resultId)) {
    return json({ error: "resultId must be a UUID" }, 400);
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/analyze-athlete-video`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
    body: JSON.stringify((body as { mode?: unknown })?.mode === "rescore"
      ? { rescore_result_id: resultId }
      : { replay_feedback_for_result_id: resultId, replay_count: typeof count === "number" ? count : 1 }),
  });
  return json(await res.json(), res.status);
});
