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

// ── Recruiting field extraction from markdown ────────────────────────────
function extractRecruitingFields(content: string, merged: Record<string, string | number>) {
  // 247 Rating — look for various patterns
  if (!merged.rating247) {
    const patterns247 = [
      /247\s*(?:Sports?)?\s*(?:Rating|Score|Composite|Grade)[:\s]*([\d.]+)/i,
      /(?:Rating|Score|Composite)[:\s]*([\d.]+)\s*.*?247/i,
      /247Sports\s*[\w\s]*?[:\s]*(0\.\d{4})/i,
      /(?:^|\s)(0\.(?:9|8)\d{2,3})(?:\s|$)/m,  // bare decimal like 0.9876
    ];
    for (const pat of patterns247) {
      const m = content.match(pat);
      if (m) { merged.rating247 = m[1]; break; }
    }
  }

  // On3 Rating
  if (!merged.ratingOn3) {
    const patternsOn3 = [
      /On3\s*(?:Rating|Score|Consensus|Grade|NIL)[:\s]*([\d.]+)/i,
      /On3[:\s]*([\d.]+)\s*(?:out|\/)/i,
      /(?:Rating|Score)[:\s]*([\d.]+)\s*.*?On3/i,
    ];
    for (const pat of patternsOn3) {
      const m = content.match(pat);
      if (m) { merged.ratingOn3 = m[1]; break; }
    }
  }

  // Composite Rating
  if (!merged.ratingComposite) {
    const patternsComp = [
      /(?:Composite|Industry|Overall)\s*(?:Rating|Score|Ranking|Grade)[:\s]*([\d.]+)/i,
      /(?:Comp\.?|COMPRTG)[:\s]*([\d.]+)/i,
    ];
    for (const pat of patternsComp) {
      const m = content.match(pat);
      if (m) { merged.ratingComposite = m[1]; break; }
    }
  }

  // Offers count
  if (!merged.offersCount) {
    const patternsOffers = [
      /(\d+)\s*(?:total\s*)?offers/i,
      /Offers[:\s]*(\d+)/i,
      /Offer\s*(?:Count|Total)[:\s]*(\d+)/i,
    ];
    for (const pat of patternsOffers) {
      const m = content.match(pat);
      if (m) { merged.offersCount = parseInt(m[1], 10); break; }
    }
  }

  // Star rating
  if (!merged.starRating) {
    const starMatch = content.match(/(\d)\s*-?\s*Star/i);
    if (starMatch) merged.starRating = parseInt(starMatch[1], 10);
  }

  // National rank
  if (!merged.nationalRank) {
    const natRank = content.match(/(?:National|Natl?|Overall)\s*(?:Rank|#|Ranking)[:\s]*#?(\d+)/i);
    if (natRank) merged.nationalRank = parseInt(natRank[1], 10);
  }

  // Position rank
  if (!merged.positionRank) {
    const posRank = content.match(/(?:Position|Pos)\s*(?:Rank|#|Ranking)[:\s]*#?(\d+)/i);
    if (posRank) merged.positionRank = parseInt(posRank[1], 10);
  }

  // Height
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

      const [roster, recruits, recruitsPrev] = await Promise.all([
        cfbdFetch<RosterPlayer[]>(cfbdKey, "/roster", { team: school, year: currentYear }),
        cfbdFetch<Recruit[]>(cfbdKey, "/recruiting/players", { team: school, year: currentYear }),
        cfbdFetch<Recruit[]>(cfbdKey, "/recruiting/players", { team: school, year: currentYear - 1 }),
      ]);

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
      return new Response(JSON.stringify({
        success: true, data: merged, sources, resultsCount: sources.length,
      }), { headers });
    }

    const authHdrs = { "Authorization": "Bearer " + firecrawlKey, "Content-Type": "application/json" };
    const posTag = knownFields.position || String(merged.position || "");

    // Two targeted searches: one for 247Sports, one for On3
    const searchBase = `${name}${posTag ? " " + posTag : ""} ${school || ""} football`.trim();
    const [search247Resp, searchOn3Resp] = await Promise.all([
      fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: authHdrs,
        body: JSON.stringify({
          query: `${searchBase} profile site:247sports.com`,
          limit: 3,
          scrapeOptions: { formats: ["markdown"] },
        }),
      }),
      fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: authHdrs,
        body: JSON.stringify({
          query: `${searchBase} profile site:on3.com`,
          limit: 3,
          scrapeOptions: { formats: ["markdown"] },
        }),
      }),
    ]);

    const firecrawlResults: Array<Record<string, unknown>> = [];
    for (const resp of [search247Resp, searchOn3Resp]) {
      if (resp.ok) {
        const d = await resp.json();
        if (d.data) firecrawlResults.push(...d.data);
      }
    }

    // Parse recruiting fields from all results
    for (const result of firecrawlResults) {
      const srcUrl = String(result.url || (result.metadata as Record<string, unknown>)?.sourceURL || "");
      if (srcUrl && !sources.includes(srcUrl)) sources.push(srcUrl);

      const content = String(result.markdown || (result.data as Record<string, unknown>)?.markdown || "");
      if (!content) continue;

      extractRecruitingFields(content, merged);
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
    // PHASE 3: Action Photo — targeted extraction from 247/On3 profiles
    // ═══════════════════════════════════════════════════════════════════════
    const imageUrls: Record<string, string> = {};
    let candidateUrls: string[] = [];

    try {
      // Prioritize 247Sports first, then On3
      const profileUrls = sources.filter((s) =>
        /247sports\.com|on3\.com/i.test(s)
      );
      // Sort: 247 first
      profileUrls.sort((a, b) => {
        const a247 = /247sports/i.test(a) ? 0 : 1;
        const b247 = /247sports/i.test(b) ? 0 : 1;
        return a247 - b247;
      });
      const imageSourceUrls = profileUrls.slice(0, 4);

      // Scrape HTML from profile pages for image extraction
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

          // Standard img src
          const imgRegex = /<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*/gi;
          let m;
          while ((m = imgRegex.exec(html)) !== null) {
            const src = m[1];
            const fullTag = m[0];
            if (/logo|icon|sprite|badge|button|pixel|\.svg|\.gif|spacer|avatar|favicon|tracking|advertisement|sponsor/i.test(src)) continue;
            if (src.length < 30) continue;
            if (/[?&](?:width|w|height|h)=(?:[1-5]?\d|60)(?:&|$)/i.test(src)) continue;
            if (/[/,]w_([1-9]\d?)[/,]/i.test(src)) continue;
            // Boost images with player name or jersey in alt text
            const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
            const altText = altMatch ? altMatch[1].toLowerCase() : "";
            const nameTokens = name.toLowerCase().split(/\s+/);
            const hasNameInAlt = nameTokens.some(t => t.length > 2 && altText.includes(t));
            if (hasNameInAlt) {
              extracted.unshift(src); // prioritize
            } else {
              extracted.push(src);
            }
          }

          // Lazy-loaded images (data-src)
          const dataSrcRegex = /data-src=["'](https?:\/\/[^"']+)["']/gi;
          while ((m = dataSrcRegex.exec(html)) !== null) {
            const src = m[1];
            if (/logo|icon|sprite|badge|button|pixel|\.svg|\.gif|spacer|avatar|favicon/i.test(src)) continue;
            if (src.length < 30) continue;
            extracted.push(src);
          }

          // og:image (often a good player action shot on profile pages)
          const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["'](https?:\/\/[^"']+)["']/i)
            || html.match(/<meta[^>]+content=["'](https?:\/\/[^"']+)["'][^>]+property=["']og:image["']/i);
          if (ogMatch) extracted.unshift(ogMatch[1]); // prioritize og:image

          return extracted;
        } catch { return []; }
      });

      const scrapeResults = await Promise.all(scrapePromises);
      for (const imgs of scrapeResults) {
        for (const src of imgs) {
          if (!candidateUrls.includes(src)) candidateUrls.push(src);
        }
      }

      // Upscale CDN URLs for better resolution
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

      // Gemini Vision verification — strict action photo only
      if (candidateUrls.length > 0 && lovableKey) {
        const imagesToCheck = candidateUrls.slice(0, 15);
        const jerseyNum = knownFields.number || String(merged.number || "");
        const contentParts: Array<Record<string, unknown>> = [
          {
            type: "text",
            text: `You are selecting the SINGLE best in-game ACTION photo for a college football player's profile card.

Player: ${name}
Position: ${posTag || "unknown"}
School: ${school || "unknown"}
Jersey: #${jerseyNum || "unknown"}

From the ${imagesToCheck.length} candidate images below, find the SINGLE best high-resolution in-game ACTION photo of this exact player.

REQUIREMENTS:
- Must show the player ACTIVELY playing football: running a route, catching a ball, throwing, blocking, tackling, celebrating after a play, etc.
- Prioritize: clear face/jersey visible, high resolution, action pose, player is the main subject
- Strong signals: jersey number matches, player name in URL, 247Sports or On3 player gallery image
- ABSOLUTELY REJECT: headshots, portraits, posed studio shots, smiling close-ups, team group photos, crowd shots, logos, ads, thumbnails under 200px, generic stock photos, coaches, other players

Return a JSON array of qualifying action photo URLs, ranked best first.
If NONE qualify as real in-game action shots, return an empty array: []
Do NOT include any image you're unsure about — when in doubt, exclude it.`,
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
              } else {
                // Vision returned empty — no valid action photos
                candidateUrls = [];
              }
            } catch {
              if (raw.startsWith("http")) imageUrls.actionPhoto = raw;
            }
          }
        } catch { /* non-critical */ }

        // Do NOT fall back to random images if vision found nothing
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
    } else {
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
