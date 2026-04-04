const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CFBD_BASE = "https://apinext.collegefootballdata.com";

// ── Helpers ──────────────────────────────────────────────────────────────
async function cfbdFetch<T = unknown>(
  apiKey: string,
  path: string,
  params: Record<string, string | number>,
): Promise<T | null> {
  const url = new URL(`${CFBD_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  try {
    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (!resp.ok) return null;
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

type RosterPlayer = {
  first_name: string;
  last_name: string;
  position: string;
  jersey: number;
  height: number;
  weight: number;
  year: number;
  home_city: string;
  home_state: string;
};

type Recruit = {
  name: string;
  school: string;
  stars: number;
  ranking: number;
  position: string;
  city: string;
  state_province: string;
  year: number;
};

// ── Main handler ─────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const rawText = await req.text();
    let body: Record<string, unknown> = {};
    if (rawText) {
      try { body = JSON.parse(rawText); } catch {
        return new Response(JSON.stringify({ success: false, error: "Could not parse JSON body" }), { status: 400, headers });
      }
    }

    const name = String(body.name || "").trim();
    const school = String(body.school || "").trim();
    const knownFields = (body.knownFields || {}) as Record<string, string | undefined>;

    if (!name) {
      return new Response(JSON.stringify({ success: false, error: "Athlete name is required" }), { status: 400, headers });
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const cfbdKey = Deno.env.get("CFBD_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    const nameParts = name.split(/\s+/);
    const lastName = nameParts[nameParts.length - 1].toLowerCase();
    const firstName = nameParts[0].toLowerCase();

    const merged: Record<string, string | number> = {};
    const sources: string[] = [];

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: CFBD — roster + recruiting data (authoritative, fast, free)
    // ═══════════════════════════════════════════════════════════════════════
    if (cfbdKey && school) {
      const currentYear = new Date().getFullYear();

      // Parallel: roster + recruiting for current and previous year
      const [roster, recruits, recruitsPrev] = await Promise.all([
        cfbdFetch<RosterPlayer[]>(cfbdKey, "/roster", { team: school, year: currentYear }),
        cfbdFetch<Recruit[]>(cfbdKey, "/recruiting/players", { team: school, year: currentYear }),
        cfbdFetch<Recruit[]>(cfbdKey, "/recruiting/players", { team: school, year: currentYear - 1 }),
      ]);

      // Match player from roster
      if (roster && Array.isArray(roster)) {
        const match = roster.find((p) => {
          const fn = p.first_name?.toLowerCase() || "";
          const ln = p.last_name?.toLowerCase() || "";
          return fn === firstName && ln === lastName;
        });
        if (match) {
          sources.push("CFBD Roster");
          if (match.height && !merged.height) merged.height = String(match.height);
          if (match.weight && !merged.weight) merged.weight = String(match.weight);
          if (match.position && !knownFields.position) merged.position = match.position;
          if (match.jersey != null && !knownFields.number) merged.number = String(match.jersey);
          if (match.home_city && match.home_state) {
            merged.hometown = `${match.home_city}, ${match.home_state}`;
          } else if (match.home_city) {
            merged.hometown = match.home_city;
          }
          if (match.year) {
            const yearMap: Record<number, string> = { 1: "Freshman", 2: "Sophomore", 3: "Junior", 4: "Senior", 5: "5th Year" };
            if (!knownFields.classYear) merged.classYear = yearMap[match.year] || String(match.year);
          }
        }
      }

      // Match player from recruiting data
      const allRecruits = [...(recruits || []), ...(recruitsPrev || [])];
      if (allRecruits.length > 0) {
        const rMatch = allRecruits.find((r) => {
          const rName = (r.name || "").toLowerCase();
          return rName.includes(firstName) && rName.includes(lastName);
        });
        if (rMatch) {
          sources.push("CFBD Recruiting");
          if (rMatch.stars && !merged.starRating) merged.starRating = rMatch.stars;
          if (rMatch.ranking && !merged.nationalRank) merged.nationalRank = rMatch.ranking;
          if (rMatch.city && rMatch.state_province && !merged.hometown) {
            merged.hometown = `${rMatch.city}, ${rMatch.state_province}`;
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: Firecrawl — deeper recruiting + action photos
    // ═══════════════════════════════════════════════════════════════════════
    if (!firecrawlKey) {
      // Return CFBD-only results if no Firecrawl
      return new Response(JSON.stringify({
        success: true, data: merged, sources, resultsCount: sources.length,
      }), { headers });
    }

    const authHdrs = { "Authorization": "Bearer " + firecrawlKey, "Content-Type": "application/json" };
    const posTag = knownFields.position || merged.position || "";

    // Targeted search: 247Sports + On3 profile pages only
    const searchQuery = `${name}${posTag ? " " + posTag : ""} ${school || ""} football profile site:247sports.com OR site:on3.com`.trim();

    const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: authHdrs,
      body: JSON.stringify({
        query: searchQuery,
        limit: 4,
        scrapeOptions: { formats: ["markdown"] },
      }),
    });

    let firecrawlResults: Array<Record<string, unknown>> = [];
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      firecrawlResults = searchData.data || [];
    }

    // Parse recruiting-specific fields from Firecrawl markdown
    for (const result of firecrawlResults) {
      if (result.url || (result.metadata as Record<string, unknown>)?.sourceURL) {
        sources.push(String(result.url || (result.metadata as Record<string, unknown>)?.sourceURL));
      }

      const content = String(result.markdown || (result.data as Record<string, unknown>)?.markdown || "");
      if (!content) continue;

      // 247 Rating
      const r247 = content.match(/247\s*(?:Sports?)?\s*(?:Rating|Score|Composite)[:\s]*([\d.]+)/i);
      if (r247 && !merged.rating247) merged.rating247 = r247[1];

      // On3 Rating
      const rOn3 = content.match(/On3\s*(?:Rating|Score|Consensus|NIL)[:\s]*([\d.]+)/i);
      if (rOn3 && !merged.ratingOn3) merged.ratingOn3 = rOn3[1];

      // Composite Rating
      const rComp = content.match(/(?:Composite|Industry)\s*(?:Rating|Score|Ranking)[:\s]*([\d.]+)/i);
      if (rComp && !merged.ratingComposite) merged.ratingComposite = rComp[1];

      // Offers count
      const rOffers = content.match(/(\d+)\s*(?:total\s*)?offers/i);
      if (rOffers && !merged.offersCount) merged.offersCount = parseInt(rOffers[1], 10);

      // Star rating (if CFBD didn't have it)
      const starMatch = content.match(/(\d)\s*-?\s*Star/i);
      if (starMatch && !merged.starRating) merged.starRating = parseInt(starMatch[1], 10);

      // National rank
      const natRank = content.match(/(?:National|Natl?)\s*(?:Rank|#)[:\s]*(\d+)/i);
      if (natRank && !merged.nationalRank) merged.nationalRank = parseInt(natRank[1], 10);

      // Position rank
      const posRank = content.match(/(?:Position|Pos)\s*(?:Rank|#)[:\s]*(\d+)/i);
      if (posRank && !merged.positionRank) merged.positionRank = parseInt(posRank[1], 10);

      // Height (if CFBD didn't have it)
      if (!merged.height) {
        const hm = content.match(/Height[:\s]*(\d+['']\d+[""]?|\d+-\d+)/i)
          || content.match(/HT\/WT[:\s]*(\d+['-]\d+)/i)
          || content.match(/Ht\.?[:\s]*(\d+['-]\d+)/i);
        if (hm) merged.height = hm[1];
      }

      // Weight
      if (!merged.weight) {
        const wm = content.match(/Weight[:\s]*(\d+)\s*(?:lbs?)?/i)
          || content.match(/HT\/WT[:\s]*\d+['-]\d+[,\s]+(\d+)\s*lbs/i)
          || content.match(/Wt\.?[:\s]*(\d+)/i);
        if (wm) merged.weight = wm[1];
      }

      // Hometown
      if (!merged.hometown) {
        const htown = content.match(/Hometown[:\s]*([A-Za-z\s]+,\s*[A-Z]{2})/i);
        if (htown) merged.hometown = htown[1].trim();
      }

      // High school
      if (!merged.highSchool) {
        const hs = content.match(
          /High\s*School[:\s]+(?!in\b|at\b|from\b|the\b|recruit|player|prospect|Natl)([A-Z][A-Za-z0-9 .'()-]{2,39})/
        );
        if (hs) {
          const cleaned = hs[1].trim().replace(/[\[\]|]+$/, "").trim();
          if (cleaned.length >= 3 && !/^\d+$/.test(cleaned)) merged.highSchool = cleaned;
        }
      }

      // 40-yard dash
      if (!merged.fortyTime) {
        const ft = content.match(/40[- ]?(?:yard|yd)?[:\s]*(\d+\.\d+)/i);
        if (ft) merged.fortyTime = ft[1];
      }
    }

    // Normalize height to total inches
    if (merged.height) {
      const h = String(merged.height);
      const dashMatch = h.match(/^(\d+)['\-](\d+)[""]?$/);
      if (dashMatch) {
        merged.height = String(parseInt(dashMatch[1], 10) * 12 + parseInt(dashMatch[2], 10));
      }
    }
    if (merged.weight) {
      merged.weight = String(merged.weight).replace(/\s*lbs?\.?\s*/gi, "").trim();
    }

    // Remove fields the athlete already provided
    if (knownFields.position) delete merged.position;
    if (knownFields.number) delete merged.number;
    if (knownFields.classYear) delete merged.classYear;

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 3: Action Photo extraction from 247/On3 profile pages
    // ═══════════════════════════════════════════════════════════════════════
    const imageUrls: Record<string, string> = {};
    let candidateUrls: string[] = [];

    try {
      const imageSourceUrls = sources.filter((s) =>
        /247sports|on3\.com|espn\.com/i.test(s)
      ).slice(0, 3);

      // Scrape HTML from top sources for image extraction
      const scrapePromises = imageSourceUrls.map(async (pageUrl: string) => {
        try {
          const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: authHdrs,
            body: JSON.stringify({ url: pageUrl, formats: ["html"], onlyMainContent: false }),
          });
          if (!resp.ok) return [];
          const data = await resp.json();
          const html = String(data.data?.html || data.html || "");
          const extracted: string[] = [];

          const imgRegex = /<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*/gi;
          let m;
          while ((m = imgRegex.exec(html)) !== null) {
            const src = m[1];
            if (/logo|icon|sprite|badge|button|pixel|\.svg|\.gif|spacer|avatar|favicon|tracking|advertisement|sponsor/i.test(src)) continue;
            if (src.length < 30) continue;
            if (/[?&](?:width|w|height|h)=(?:[1-5]?\d|60)(?:&|$)/i.test(src)) continue;
            if (/[/,]w_([1-9]\d?)[/,]/i.test(src)) continue;
            extracted.push(src);
          }
          // Lazy-loaded images
          const dataSrcRegex = /data-src=["'](https?:\/\/[^"']+)["']/gi;
          while ((m = dataSrcRegex.exec(html)) !== null) {
            const src = m[1];
            if (/logo|icon|sprite|badge|button|pixel|\.svg|\.gif|spacer|avatar|favicon/i.test(src)) continue;
            if (src.length < 30) continue;
            extracted.push(src);
          }
          // og:image
          const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["'](https?:\/\/[^"']+)["']/i);
          if (ogMatch) extracted.push(ogMatch[1]);
          const ogMatch2 = html.match(/<meta[^>]+content=["'](https?:\/\/[^"']+)["'][^>]+property=["']og:image["']/i);
          if (ogMatch2) extracted.push(ogMatch2[1]);

          return extracted;
        } catch { return []; }
      });

      const scrapeResults = await Promise.all(scrapePromises);
      for (const imgs of scrapeResults) {
        for (const src of imgs) {
          if (!candidateUrls.includes(src)) candidateUrls.push(src);
        }
      }

      // Upscale CDN URLs
      candidateUrls = candidateUrls.map((url) => {
        let u = url;
        u = u.replace(/\/cdn-cgi\/image\/[^/]+\//, "/");
        u = u.replace(/\?fit=(?:crop|bounds)[^&]*(?:&[^&]*)*$/i, "");
        u = u.replace(/\/w_\d+\b/, "/w_800");
        return u;
      });
      candidateUrls = [...new Set(candidateUrls)];

      // Pre-sort: URLs containing athlete's name go first
      const nameTokens = name.toLowerCase().split(/\s+/);
      candidateUrls.sort((a, b) => {
        const aLower = decodeURIComponent(a).toLowerCase();
        const bLower = decodeURIComponent(b).toLowerCase();
        const aMatch = nameTokens.some((t) => t.length > 2 && aLower.includes(t));
        const bMatch = nameTokens.some((t) => t.length > 2 && bLower.includes(t));
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return 0;
      });

      // Gemini Vision verification
      if (candidateUrls.length > 0 && lovableKey) {
        const imagesToCheck = candidateUrls.slice(0, 15);
        const jerseyNum = knownFields.number || String(merged.number || "");
        const contentParts: Array<Record<string, unknown>> = [
          {
            type: "text",
            text: `You are verifying ACTION photos for a football player profile card.

Player: ${name}
Position: ${posTag || "unknown"}
School: ${school || "unknown"}
Jersey: ${jerseyNum || "unknown"}

Extract ONLY a high-quality in-game ACTION photo of this exact player from the ${imagesToCheck.length} candidates below.
Must show the player ACTIVELY playing football — running, catching, throwing, blocking, tackling, etc.
Prioritize highest resolution from 247Sports or On3 player profiles.
Look for name or jersey in alt text.
ABSOLUTELY REJECT: headshots, studio shots, group photos, crowd shots, logos, ads, thumbnails.
Return JSON array of passing URLs ranked best first. Example: ["url1","url2"]
If none found, return: []`,
          },
        ];
        for (const url of imagesToCheck) {
          contentParts.push({ type: "image_url", image_url: { url } });
        }

        try {
          const visionResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": "Bearer " + lovableKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{ role: "user", content: contentParts }],
            }),
          });

          if (visionResp.ok) {
            const visionData = await visionResp.json();
            const raw = ((visionData.choices?.[0]?.message?.content as string) || "").trim();
            const visionJson = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
            try {
              const filtered = JSON.parse(visionJson);
              if (Array.isArray(filtered) && filtered.length > 0) {
                candidateUrls = filtered.filter((u: unknown) => typeof u === "string" && String(u).startsWith("http"));
                if (candidateUrls.length > 0) imageUrls.actionPhoto = candidateUrls[0];
              }
            } catch {
              if (raw.startsWith("http")) imageUrls.actionPhoto = raw;
            }
          }
        } catch { /* non-critical */ }

        // Fallback if vision didn't pick
        if (!imageUrls.actionPhoto) {
          const fallback = candidateUrls.find((u) => /\.(jpg|jpeg|webp|png)/i.test(u));
          if (fallback) imageUrls.actionPhoto = fallback;
        }
      }
    } catch { /* non-critical */ }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 4: Validate image URLs
    // ═══════════════════════════════════════════════════════════════════════
    const validateImageUrl = async (url: string): Promise<boolean> => {
      try {
        const resp = await fetch(url, {
          method: "GET",
          headers: { "User-Agent": "Mozilla/5.0", "Range": "bytes=0-0" },
          redirect: "follow",
        });
        if (!resp.ok && resp.status !== 206) return false;
        const ct = resp.headers.get("content-type") || "";
        return ct.startsWith("image/") || ct.includes("octet-stream");
      } catch { return false; }
    };

    const actionPhotoCandidates: string[] = [];
    if (imageUrls.actionPhoto) actionPhotoCandidates.push(imageUrls.actionPhoto);
    for (const c of candidateUrls) {
      if (!actionPhotoCandidates.includes(c)) actionPhotoCandidates.push(c);
    }

    const toValidate = actionPhotoCandidates.slice(0, 10);
    const validationResults = await Promise.all(toValidate.map(validateImageUrl));
    const verifiedCandidates = toValidate.filter((_, i) => validationResults[i]);

    if (verifiedCandidates.length > 0) {
      imageUrls.actionPhoto = verifiedCandidates[0];
    } else if (actionPhotoCandidates.length > 0) {
      delete imageUrls.actionPhoto;
    }

    return new Response(JSON.stringify({
      success: true,
      data: merged,
      imageUrls: Object.keys(imageUrls).length > 0 ? imageUrls : undefined,
      actionPhotoCandidates: verifiedCandidates.length > 0 ? verifiedCandidates.slice(0, 10) : undefined,
      sources,
      resultsCount: sources.length,
    }), { headers });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch profile";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), { status: 500, headers });
  }
});
