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
    const knownFields = (body.knownFields || {}) as Record<string, string | undefined>;

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

    // Include known position in query for better targeting
    const posTag = knownFields.position ? " " + knownFields.position : "";

    const searchQuery = school
      ? name + posTag + " " + school + " football recruiting profile site:247sports.com OR site:rivals.com OR site:on3.com OR site:espn.com"
      : name + posTag + " football recruiting profile site:247sports.com OR site:rivals.com OR site:on3.com OR site:espn.com";

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
        /High\s*School[:\s]+(?!in\b|at\b|from\b|the\b|recruit|player|prospect|Natl)([A-Z][A-Za-z0-9 .'()-]{2,39})/
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

      // Position: multiple patterns, only from relevant pages, skip bare "S"
      if (!merged.position && pageRelevant) {
        // Pattern 1: structured label like "Position: QB"
        const posMatch = content.match(
          /(?:Position|Pos\.?)\s*[:\-]\s*(QB|RB|WR|TE|OL|OT|OG|DL|DE|DT|LB|CB|FS|SS|ATH|FB|LS|K|P)\b/i
        );
        // Pattern 2: standalone position near athlete name on roster pages (e.g. "Bear Bachmeier | QB")
        const posMatch2 = !posMatch && content.match(
          new RegExp(lastName + "[\\s|,\\-]+(?:#\\d+\\s*[|,\\-]+\\s*)?(QB|RB|WR|TE|OL|OT|OG|DL|DE|DT|LB|CB|FS|SS|ATH|FB|LS|K|P)\\b", "i")
        );
        // Pattern 3: position before athlete name (e.g. "QB Bear Bachmeier")
        const posMatch3 = !posMatch && !posMatch2 && content.match(
          new RegExp("\\b(QB|RB|WR|TE|OL|OT|OG|DL|DE|DT|LB|CB|FS|SS|ATH|FB|LS)\\s+" + nameParts[0], "i")
        );
        const foundPos = posMatch || posMatch2 || posMatch3;
        if (foundPos) {
          let pos = foundPos[posMatch ? 1 : posMatch2 ? 1 : 1].toUpperCase();
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

    // Remove fields the athlete already provided (known fields take priority)
    const fieldMap: Record<string, string> = {
      position: "position",
      number: "number",
      classYear: "classYear",
    };
    for (const [knownKey, mergedKey] of Object.entries(fieldMap)) {
      if (knownFields[knownKey]) {
        delete merged[mergedKey];
      }
    }

    // --- Image extraction via AI-powered search ---
    const imageUrls: Record<string, string> = {};

    // 1. Dedicated photo search via Firecrawl
    const posLabel = knownFields.position || merged.position || "";
    const photoQuery = `${name} ${posLabel} ${school} action game photo`.trim();

    try {
      const photoSearchResp = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: photoQuery,
          limit: 5,
          scrapeOptions: { formats: ["markdown"] },
        }),
      });

      if (photoSearchResp.ok) {
        const photoSearchData = await photoSearchResp.json();
        const photoResults = photoSearchData.data || [];

        // Collect candidate image URLs from markdown ![alt](url) syntax
        const candidateUrls: string[] = [];
        const mdImgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;

        for (const pr of photoResults) {
          const md = pr.markdown || pr.data?.markdown || "";
          let m;
          while ((m = mdImgRegex.exec(md)) !== null) {
            const src = m[1];
            // Skip tiny utility images
            if (/logo|icon|sprite|badge|arrow|button|tracking|pixel|\.svg|\.gif|spacer|transparent|rating/i.test(src)) continue;
            if (src.length < 30) continue;
            if (!candidateUrls.includes(src)) candidateUrls.push(src);
          }
        }

        // 2. Ask Gemini to pick the best action photo
        if (candidateUrls.length > 0) {
          const lovableKey = Deno.env.get("LOVABLE_API_KEY");
          if (lovableKey) {
            const aiPrompt = `You are an image selection assistant for athlete profile cards.

I have these candidate image URLs found from a web search for "${name}" (${posLabel}, ${school}):

${candidateUrls.slice(0, 20).map((u, i) => `${i + 1}. ${u}`).join("\n")}

Which single URL is most likely a high-quality action photo of ${name} playing football? 
The image should be suitable for a portrait-oriented card (3:4 aspect ratio).
Prefer game action shots over posed portraits, headshots, or logos.
If none look like good action photos, respond with just the word "NONE".
Otherwise respond with ONLY the URL, nothing else.`;

            try {
              const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": "Bearer " + lovableKey,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash",
                  messages: [{ role: "user", content: aiPrompt }],
                }),
              });

              if (aiResp.ok) {
                const aiData = await aiResp.json();
                const picked = (aiData.choices?.[0]?.message?.content || "").trim();
                if (picked && picked !== "NONE" && picked.startsWith("http")) {
                  imageUrls.actionPhoto = picked;
                }
              }
            } catch (_aiErr) {
              // Non-critical — proceed without AI selection
            }
          }

          // Fallback: if AI didn't pick, use first large jpg/webp candidate
          if (!imageUrls.actionPhoto) {
            const fallback = candidateUrls.find((u) => /\.(jpg|jpeg|webp)/i.test(u));
            if (fallback) imageUrls.actionPhoto = fallback;
          }
        }

        // 3. Try to find a headshot from ESPN results
        const espnResult = photoResults.find((r: Record<string, unknown>) =>
          String(r.url || "").includes("espn.com")
        );
        if (espnResult) {
          const md = espnResult.markdown || "";
          const espnImgMatch = md.match(/!\[[^\]]*\]\((https:\/\/a\.espncdn\.com[^)]+)\)/);
          if (espnImgMatch && !imageUrls.headshot) {
            imageUrls.headshot = espnImgMatch[1];
          }
        }
      }
    } catch (_photoErr) {
      // Non-critical — continue without photos
    }

    // 2. School logo via branding format
    if (school && apiKey) {
      try {
        // Derive athletics domain from school name
        const schoolSlug = school
          .toLowerCase()
          .replace(/university of /i, "")
          .replace(/\s+state\s+university/i, "state")
          .replace(/\s+university/i, "")
          .replace(/[^a-z]/g, "");

        // Search for the athletics site to get the real domain
        const logoSearch = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: school + " athletics official site",
            limit: 1,
            scrapeOptions: { formats: ["branding"] },
          }),
        });

        if (logoSearch.ok) {
          const logoData = await logoSearch.json();
          const firstResult = logoData.data?.[0];
          const branding = firstResult?.branding;
          const logo = branding?.logo || branding?.images?.logo;
          if (logo) imageUrls.schoolLogo = logo;
        }
      } catch (_logoErr) {
        // Non-critical
      }
    }

    // Build actionPhotoCandidates: AI pick first, then remaining candidates
    const actionPhotoCandidates: string[] = [];
    if (imageUrls.actionPhoto) {
      actionPhotoCandidates.push(imageUrls.actionPhoto);
    }
    for (const c of candidateUrls || []) {
      if (!actionPhotoCandidates.includes(c)) {
        actionPhotoCandidates.push(c);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: merged,
        imageUrls: Object.keys(imageUrls).length > 0 ? imageUrls : undefined,
        actionPhotoCandidates: actionPhotoCandidates.length > 0 ? actionPhotoCandidates.slice(0, 10) : undefined,
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
