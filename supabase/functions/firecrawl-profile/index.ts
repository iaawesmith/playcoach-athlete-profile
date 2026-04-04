const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Could not parse JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const school = typeof body.school === "string" ? body.school.trim() : "";

    if (!name) {
      return new Response(
        JSON.stringify({ success: false, error: "Athlete name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl connector not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const searchQuery = school
      ? `${name} ${school} football recruiting profile site:247sports.com OR site:rivals.com OR site:on3.com`
      : `${name} football recruiting profile site:247sports.com OR site:rivals.com OR site:on3.com`;

    const extractionSchema = {
      type: "object",
      properties: {
        height: { type: "string", description: "Player height" },
        weight: { type: "string", description: "Player weight in lbs" },
        fortyTime: { type: "string", description: "40-yard dash time" },
        vertical: { type: "string", description: "Vertical jump measurement" },
        wingspan: { type: "string", description: "Wingspan measurement" },
        handSize: { type: "string", description: "Hand size measurement" },
        hometown: { type: "string", description: "Hometown city and state" },
        highSchool: { type: "string", description: "High school name" },
        position: { type: "string", description: "Position abbreviation" },
        classYear: { type: "string", description: "Graduation year" },
        starRating: { type: "number", description: "Recruiting star rating 1-5" },
        nationalRank: { type: "number", description: "National recruiting rank" },
        positionRank: { type: "number", description: "Position recruiting rank" },
        number: { type: "string", description: "Jersey number" },
        bio: { type: "string", description: "Short athletic bio" },
        commitmentStatus: { type: "string", description: "committed uncommitted or portal" },
      },
    };

    const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 3,
        scrapeOptions: {
          formats: [{ type: "json", schema: extractionSchema }],
        },
      }),
    });

    const searchData = await searchResponse.json();

    if (!searchResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: searchData.error || "Search failed with status " + searchResponse.status,
        }),
        { status: searchResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = searchData.data || [];
    const merged: Record<string, unknown> = {};
    const sources: string[] = [];

    for (const result of results) {
      const extracted = result.json || result.data?.json;
      if (extracted && typeof extracted === "object") {
        sources.push(result.url || result.metadata?.sourceURL || "unknown");
        for (const [key, val] of Object.entries(extracted)) {
          if (val !== null && val !== undefined && val !== "" && !(key in merged)) {
            merged[key] = val;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: merged,
        sources,
        resultsCount: results.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch profile";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
