

const CFBD_BASE = "https://apinext.collegefootballdata.com";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsH });
  }

  const apiKey = Deno.env.get("CFBD_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "CFBD_API_KEY not configured" }),
      { status: 500, headers: { ...corsH, "Content-Type": "application/json" } },
    );
  }

  try {
    const { endpoint, params } = await req.json();

    if (!endpoint || typeof endpoint !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'endpoint' field" }),
        { status: 400, headers: { ...corsH, "Content-Type": "application/json" } },
      );
    }

    // Allowlist of safe endpoints
    const allowed = [
      "/roster",
      "/player/search",
      "/recruiting/players",
      "/teams",
      "/games",
      "/stats/player/season",
    ];
    const clean = endpoint.split("?")[0];
    if (!allowed.includes(clean)) {
      return new Response(
        JSON.stringify({ error: `Endpoint not allowed: ${clean}` }),
        { status: 403, headers: { ...corsH, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(`${CFBD_BASE}${endpoint}`);
    if (params && typeof params === "object") {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }

    const resp = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    const body = await resp.text();

    return new Response(body, {
      status: resp.status,
      headers: { ...corsH, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsH, "Content-Type": "application/json" } },
    );
  }
});
