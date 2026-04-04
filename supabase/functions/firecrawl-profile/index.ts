const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const athleteSchema = {
  type: "object",
  properties: {
    height: { type: "string", description: "Height e.g. 6'2\"" },
    weight: { type: "string", description: "Weight in lbs e.g. 195" },
    fortyTime: { type: "string", description: "40-yard dash time e.g. 4.42" },
    vertical: { type: "string", description: "Vertical jump e.g. 38.5\"" },
    wingspan: { type: "string", description: "Wingspan e.g. 6'8\"" },
    handSize: { type: "string", description: "Hand size e.g. 9.5\"" },
    hometown: { type: "string", description: "Hometown city and state" },
    highSchool: { type: "string", description: "High school name" },
    position: { type: "string", description: "Position abbreviation e.g. WR, QB, RB" },
    classYear: { type: "string", description: "Graduation year e.g. 2025" },
    starRating: { type: "number", description: "Recruiting star rating 1-5" },
    nationalRank: { type: "number", description: "National recruiting rank" },
    positionRank: { type: "number", description: "Position recruiting rank" },
    number: { type: "string", description: "Jersey number" },
    bio: { type: "string", description: "Short athletic bio or description" },
    commitmentStatus: {
      type: "string",
      description: "committed, uncommitted, or portal",
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, school } = await req.json();

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

    // Step 1: Search for athlete profile pages
    const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 3,
        scrapeOptions: {
          formats: [{ type: "json", schema: athleteSchema }],
        },
      }),
    });

    const searchData = await searchResponse.json();

    if (!searchResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: searchData.error || `Search failed with status ${searchResponse.status}` }),
        { status: searchResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Merge results from multiple sources, preferring non-empty values
    const results = searchData.data || [];
    const merged: Record<string, unknown> = {};
    const sources: string[] = [];

    for (const result of results) {
      const extracted = result.json || result.data?.json;
      if (extracted) {
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
