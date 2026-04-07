const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function firecrawlSearch(apiKey: string, query: string): Promise<string | null> {
  const resp = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: 3, scrapeOptions: { formats: ["markdown"] } }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const results = data.data || [];
  return results[0]?.url || null;
}

async function firecrawlScrapeJson(
  apiKey: string,
  url: string,
  prompt: string,
  schema: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: [{ type: "json", prompt, schema }],
      onlyMainContent: true,
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.data?.json || data.json || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const body = await req.json();
    const mode = String(body.mode || "").trim();
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const position = String(body.position || "").trim();
    const school = String(body.school || "").trim();

    if (!firstName || !lastName) {
      return new Response(
        JSON.stringify({ success: false, error: "firstName and lastName are required" }),
        { status: 400, headers },
      );
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl not configured" }),
        { status: 500, headers },
      );
    }

    const searchBase = `${firstName} ${lastName}${position ? " " + position : ""} ${school || ""} football`.trim();

    if (mode === "247") {
      const profileUrl = await firecrawlSearch(firecrawlKey, `${searchBase} profile site:247sports.com`);
      if (!profileUrl) {
        return new Response(JSON.stringify({ success: true, data: null }), { headers });
      }

      const prompt = `Extract only these fields for ${firstName} ${lastName} who plays ${position} at ${school}. If the page shows a different player, return null for all fields. Fields: nationalRank (number next to Natl in rankings section), positionRank (number next to position abbreviation in rankings), stateRank (number next to state abbreviation in rankings), compositeRating (decimal like 0.9823 near the star rating). Do not extract from sidebars, related players, or class ranking tables.`;

      const schema = {
        type: "object",
        properties: {
          nationalRank: { type: ["number", "null"] },
          positionRank: { type: ["number", "null"] },
          stateRank: { type: ["number", "null"] },
          compositeRating: { type: ["number", "null"] },
        },
      };

      const json = await firecrawlScrapeJson(firecrawlKey, profileUrl, prompt, schema);
      return new Response(JSON.stringify({ success: true, data: json }), { headers });
    }

    if (mode === "on3") {
      const profileUrl = await firecrawlSearch(firecrawlKey, `${searchBase} profile site:on3.com`);
      if (!profileUrl) {
        return new Response(JSON.stringify({ success: true, data: null }), { headers });
      }

      const prompt = `Extract only these fields for ${firstName} ${lastName} who plays ${position} at ${school}. If the page shows a different player, return null for all fields. Fields: on3Rating (On3 proprietary decimal rating), on3NationalRank, on3PositionRank, on3StateRank, fortyTime (decimal like 4.42 from measurables), vertical (inches), wingspan (inches), handSize (inches). Only extract from the primary player profile — not related cards or lists.`;

      const schema = {
        type: "object",
        properties: {
          on3Rating: { type: ["number", "null"] },
          on3NationalRank: { type: ["number", "null"] },
          on3PositionRank: { type: ["number", "null"] },
          on3StateRank: { type: ["number", "null"] },
          fortyTime: { type: ["number", "null"] },
          vertical: { type: ["number", "null"] },
          wingspan: { type: ["number", "null"] },
          handSize: { type: ["number", "null"] },
        },
      };

      const json = await firecrawlScrapeJson(firecrawlKey, profileUrl, prompt, schema);
      return new Response(JSON.stringify({ success: true, data: json }), { headers });
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unknown mode: ${mode}. Use '247' or 'on3'.` }),
      { status: 400, headers },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch profile";
    return new Response(JSON.stringify({ success: false, error: msg }), { status: 500, headers });
  }
});
