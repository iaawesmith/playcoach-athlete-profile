const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const rawText = await req.text();
    let body: Record<string, unknown> = {};
    
    if (rawText) {
      try {
        body = JSON.parse(rawText);
      } catch (_parseErr) {
        return new Response(
          JSON.stringify({ success: false, error: "Could not parse JSON body" }),
          { status: 400, headers }
        );
      }
    }

    const name = String(body.name || "").trim();
    const school = String(body.school || "").trim();

    if (!name) {
      return new Response(
        JSON.stringify({ success: false, error: "Athlete name is required" }),
        { status: 400, headers }
      );
    }

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl connector not configured" }),
        { status: 500, headers }
      );
    }

    // Extract last name for proximity checks
    const nameParts = name.split(/\s+/);
    const lastName = nameParts[nameParts.length - 1].toLowerCase();

    const searchQuery = school
      ? name + " " + school + " football recruiting profile site:247sports.com OR site:rivals.com OR site:on3.com OR site:espn.com"
      : name + " football recruiting profile site:247sports.com OR site:rivals.com OR site:on3.com OR site:espn.com";

    const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 5,
        scrapeOptions: {
          formats: ["markdown"],
        },
      }),
    });

    // Second search for school roster pages (no site restriction)
    let rosterResults: Array<Record<string, unknown>> = [];
    if (school) {
      const rosterQuery = name + " " + school + " football roster";
      const rosterResponse = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: rosterQuery,
          limit: 2,
          scrapeOptions: {
            formats: ["markdown"],
          },
        }),
      });
      if (rosterResponse.ok) {
        const rosterData = await rosterResponse.json();
        rosterResults = rosterData.data || [];
      }
    }

    const searchData = await searchResponse.json();

    if (!searchResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: searchData.error || "Search failed with status " + String(searchResponse.status),
        }),
        { status: searchResponse.status, headers }
      );
    }

    // Extract data from markdown results
    const results = [...(searchData.data || []), ...rosterResults];
    const sources: string[] = [];
    const merged: Record<string, string | number> = {};

    for (const result of results) {
      if (result.url || result.metadata?.sourceURL) {
        sources.push(result.url || result.metadata.sourceURL);
      }
      
      const content = result.markdown || result.data?.markdown || "";
      if (!content) continue;

      // Check if this page is relevant to the athlete (contains their last name)
      const contentLower = content.toLowerCase();
      const pageRelevant = contentLower.includes(lastName);

      // Parse common recruiting fields from markdown
      const heightMatch = content.match(/Height[:\s]*(\d+['']\d+[""]?|\d+-\d+)/i);
      if (heightMatch && !merged.height) merged.height = heightMatch[1];

      const weightMatch = content.match(/Weight[:\s]*(\d+)\s*(?:lbs?)?/i);
      if (weightMatch && !merged.weight) merged.weight = weightMatch[1];

      const fortyMatch = content.match(/40[- ]?(?:yard|yd)?[:\s]*(\d+\.\d+)/i);
      if (fortyMatch && !merged.fortyTime) merged.fortyTime = fortyMatch[1];

      const hometownMatch = content.match(/Hometown[:\s]*([A-Za-z\s]+,\s*[A-Z]{2})/i);
      if (hometownMatch && !merged.hometown) merged.hometown = hometownMatch[1].trim();

      // High school: require the captured name to start with a capital letter (proper noun)
      // and exclude common false-positive phrases
      const highSchoolMatch = content.match(
        /High\s*School[:\s]+(?!in\b|at\b|from\b|the\b|recruit|player|prospect)([A-Z][A-Za-z0-9\s.'()-]{2,39})/
      );
      if (highSchoolMatch && !merged.highSchool) {
        const cleaned = highSchoolMatch[1].trim().replace(/[\[\]|]+$/, "").trim();
        if (cleaned.length >= 3 && !/^\d+$/.test(cleaned)) {
          merged.highSchool = cleaned;
        }
      }

      const classMatch = content.match(/Class\s*(?:of\s*)?(\d{4})/i);
      if (classMatch && !merged.classYear) merged.classYear = classMatch[1];

      const starMatch = content.match(/(\d)\s*-?\s*Star/i);
      if (starMatch && !merged.starRating) merged.starRating = parseInt(starMatch[1], 10);

      const natRankMatch = content.match(/(?:National|Natl?)\s*(?:Rank|#)[:\s]*(\d+)/i);
      if (natRankMatch && !merged.nationalRank) merged.nationalRank = parseInt(natRankMatch[1], 10);

      const posRankMatch = content.match(/(?:Position|Pos)\s*(?:Rank|#)[:\s]*(\d+)/i);
      if (posRankMatch && !merged.positionRank) merged.positionRank = parseInt(posRankMatch[1], 10);

      // Position: only accept from pages relevant to the athlete, and skip bare "S"
      if (!merged.position && pageRelevant) {
        const posMatch = content.match(
          /(?:Position|Pos\.?)\s*[:\-]\s*(QB|RB|WR|TE|OL|OT|OG|DL|DE|DT|LB|CB|FS|SS|ATH|FB|LS|K|P)\b/i
        );
        if (posMatch) {
          let pos = posMatch[1].toUpperCase();
          if (pos === "FS" || pos === "SS") pos = "S";
          merged.position = pos;
        }
      }

      // ESPN-style combined HT/WT
      const htwtMatch = content.match(/HT\/WT[:\s]*(\d+['-]\d+)[,\s]+(\d+)\s*lbs/i);
      if (htwtMatch) {
        if (!merged.height) merged.height = htwtMatch[1];
        if (!merged.weight) merged.weight = htwtMatch[2];
      }

      // Roster-style Ht./Wt.
      const htMatch2 = content.match(/Ht\.?[:\s]*(\d+['-]\d+)/i);
      if (htMatch2 && !merged.height) merged.height = htMatch2[1];

      const wtMatch2 = content.match(/Wt\.?[:\s]*(\d+)/i);
      if (wtMatch2 && !merged.weight) merged.weight = wtMatch2[1];

      // Jersey number: only from lines containing the athlete's last name
      if (!merged.number && pageRelevant) {
        const lines = content.split("\n");
        for (const line of lines) {
          if (line.toLowerCase().includes(lastName)) {
            const jerseyMatch = line.match(/#(\d{1,2})\b/);
            if (jerseyMatch) {
              merged.number = jerseyMatch[1];
              break;
            }
          }
        }
      }
    }

    // Normalize height to total inches for the store
    if (merged.height) {
      const h = String(merged.height);
      const dashMatch = h.match(/^(\d+)['\-](\d+)[""]?$/);
      if (dashMatch) {
        merged.height = String(parseInt(dashMatch[1], 10) * 12 + parseInt(dashMatch[2], 10));
      }
    }

    // Strip "lbs" from weight
    if (merged.weight) {
      merged.weight = String(merged.weight).replace(/\s*lbs?\.?\s*/gi, "").trim();
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: merged,
        sources: sources,
        resultsCount: results.length,
      }),
      { headers }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch profile";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers }
    );
  }
});
