const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function nameMatchesUrl(url: string, firstName: string, lastName: string): boolean {
  const slug = `${firstName.toLowerCase()}-${lastName.toLowerCase()}`;
  return url.toLowerCase().includes(slug);
}

async function firecrawlSearch(apiKey: string, query: string, limit = 5): Promise<{ url: string; title?: string }[]> {
  const resp = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit, scrapeOptions: { formats: [] } }),
  });
  if (!resp.ok) {
    console.log("[search] Firecrawl search failed:", resp.status);
    return [];
  }
  const data = await resp.json();
  const results = data.data || data.results || [];
  return results.map((r: Record<string, unknown>) => ({ url: String(r.url || ""), title: String(r.title || "") }));
}

async function firecrawlScrapeMarkdown(apiKey: string, url: string): Promise<string | null> {
  const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.data?.markdown || data.markdown || null;
}

async function firecrawlScrapeHtml(apiKey: string, url: string, waitFor?: number): Promise<string | null> {
  const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["html"], onlyMainContent: false, waitFor: waitFor || 0 }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.data?.html || data.html || null;
}

async function firecrawlScrapeExtract(
  apiKey: string,
  url: string,
  prompt: string,
  schema: Record<string, unknown>,
  waitFor?: number,
): Promise<Record<string, unknown> | null> {
  const body: Record<string, unknown> = {
    url,
    formats: ["extract"],
    onlyMainContent: true,
    extract: { prompt, schema },
  };
  if (waitFor) body.waitFor = waitFor;

  const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.data?.extract || data.extract || null;
}

/* ------------------------------------------------------------------ */
/*  URL candidate scoring                                              */
/* ------------------------------------------------------------------ */

/** Score a 247Sports candidate URL. Higher = better. Returns -1 if invalid. */
function score247Url(url: string, firstName: string, lastName: string): number {
  const lower = url.toLowerCase();
  if (!lower.includes("247sports.com")) return -1;
  // Must match /player/{slug}-{id}/ pattern
  if (!/\/player\/[a-z0-9-]+-\d+/.test(lower)) return -1;
  if (!nameMatchesUrl(url, firstName, lastName)) return -1;

  let score = 1;
  // Prefer high-school URLs (recruiting profiles)
  if (/\/high-school-\d+/.test(lower)) score += 10;
  return score;
}

/** Score an On3 candidate URL. Higher = better. Returns -1 if invalid. */
function scoreOn3Url(url: string, firstName: string, lastName: string): number {
  const lower = url.toLowerCase();
  if (!lower.includes("on3.com")) return -1;
  // Must match /rivals/{slug}-{id}/ pattern
  if (!/\/rivals\/[a-z0-9-]+-\d+/.test(lower)) return -1;
  if (!nameMatchesUrl(url, firstName, lastName)) return -1;
  return 1;
}

function pickBestUrl(
  results: { url: string }[],
  scoreFn: (url: string, first: string, last: string) => number,
  firstName: string,
  lastName: string,
): string | null {
  let best: string | null = null;
  let bestScore = -1;
  for (const r of results) {
    const s = scoreFn(r.url, firstName, lastName);
    if (s > bestScore) {
      bestScore = s;
      best = r.url;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/*  School domain guessing                                             */
/* ------------------------------------------------------------------ */

const schoolDomainMap: Record<string, string> = {
  "alabama": "rolltide.com",
  "auburn": "auburntigers.com",
  "georgia": "georgiadogs.com",
  "university of georgia": "georgiadogs.com",
  "lsu": "lsusports.net",
  "florida": "floridagators.com",
  "ohio state": "ohiostatebuckeyes.com",
  "michigan": "mgoblue.com",
  "texas": "texassports.com",
  "usc": "usctrojans.com",
  "clemson": "clemsontigers.com",
  "oregon": "goducks.com",
  "penn state": "gopsusports.com",
  "oklahoma": "soonersports.com",
  "notre dame": "und.com",
  "tennessee": "utsports.com",
  "byu": "byucougars.com",
  "colorado": "cubuffs.com",
  "miami": "miamihurricanes.com",
};

function guessSchoolDomain(school: string): string | null {
  const lower = school.toLowerCase().replace(/university of /g, "").replace(/ university/g, "").trim();
  return schoolDomainMap[lower] || null;
}

/* ------------------------------------------------------------------ */
/*  247Sports HTML Parser                                              */
/* ------------------------------------------------------------------ */

function parse247RecruitingData(
  html: string,
  playerPosition: string,
  playerState: string,
): {
  stars247: number | null;
  playerRating247: number | null;
  positionRank: number | null;
  stateRank: number | null;
  compositeStars247: number | null;
  compositeRating247: number | null;
  compositeNationalRank247: number | null;
  compositePositionRank247: number | null;
  compositeStateRank247: number | null;
} {
  const pos = (playerPosition || "").toUpperCase();
  const state = (playerState || "").toUpperCase();

  function countYellowStars(segment: string): number | null {
    const count = (segment.match(/icon-starsolid yellow/g) || []).length;
    return count > 0 ? count : null;
  }

  function findRankInList(
    src: string,
    label: string,
    isComposite: boolean,
  ): number | null {
    const liBlocks = src.match(/<li[\s\S]*?<\/li>/g) || [];
    for (const li of liBlocks) {
      const hasLabel = li.includes(`<b>${label}</b>`);
      const hasCompositeUrl = li.includes("compositerecruitrankings");
      const hasRankingUrl = li.includes("recruitrankings");
      const urlTypeMatch = isComposite
        ? hasCompositeUrl
        : hasRankingUrl && !hasCompositeUrl;
      if (hasLabel && urlTypeMatch) {
        const strongMatch = li.match(/<strong>(\d+)<\/strong>/);
        return strongMatch ? parseInt(strongMatch[1]) : null;
      }
    }
    return null;
  }

  const rawSections = html.split('<section class="rankings-section">');
  let proprietarySection = "";
  let compositeSection = "";

  for (const section of rawSections) {
    const titleMatch = section.match(/<h3 class="title">([^<]+)<\/h3>/);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();
    if (title === "247Sports") {
      proprietarySection = section;
    } else if (title.startsWith("247Sports Composite")) {
      compositeSection = section;
    }
  }

  console.log("[247] proprietarySection length:", proprietarySection.length);
  console.log("[247] compositeSection length:", compositeSection.length);

  const stars247 = proprietarySection
    ? countYellowStars(proprietarySection)
    : null;

  const playerRatingMatch = proprietarySection.match(
    /<div class="rank-block">\s*(\d{2,3})\s*<\/div>/,
  );
  const playerRating247 = playerRatingMatch
    ? parseInt(playerRatingMatch[1])
    : null;

  const positionRank =
    pos && proprietarySection
      ? findRankInList(proprietarySection, pos, false)
      : null;
  const stateRank =
    state && proprietarySection
      ? findRankInList(proprietarySection, state, false)
      : null;

  const compositeStars247 = compositeSection
    ? countYellowStars(compositeSection)
    : null;

  const compositeRatingMatch = compositeSection.match(
    /<div class="rank-block">\s*(0\.\d{3,6})\s*<\/div>/,
  );
  const compositeRating247 = compositeRatingMatch
    ? parseFloat(compositeRatingMatch[1])
    : null;

  const compositeNationalRank247 = compositeSection
    ? findRankInList(compositeSection, "Natl.", true)
    : null;
  const compositePositionRank247 =
    pos && compositeSection
      ? findRankInList(compositeSection, pos, true)
      : null;
  const compositeStateRank247 =
    state && compositeSection
      ? findRankInList(compositeSection, state, true)
      : null;

  return {
    stars247,
    playerRating247,
    positionRank,
    stateRank,
    compositeStars247,
    compositeRating247,
    compositeNationalRank247,
    compositePositionRank247,
    compositeStateRank247,
  };
}


/*  Handler                                                            */
/* ------------------------------------------------------------------ */

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

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl not configured" }),
        { status: 500, headers },
      );
    }

    /* ── 247Sports ─────────────────────────────────────────────── */
    if (mode === "247") {
      console.log("[247] Phase started", { firstName, lastName, position, school });

      if (!firstName || !lastName) {
        console.log("[247] Exiting: name required");
        return new Response(JSON.stringify({ success: false, error: "Name required" }), { status: 400, headers });
      }

      const hometown = String(body.hometown || "").trim();
      const homeParts = hometown.split(", ");
      const playerState = homeParts.length > 1 ? homeParts[homeParts.length - 1].trim() : "";

      // Use Firecrawl Search API instead of scraping Google
      const searchQuery = `site:247sports.com/player/ ${firstName} ${lastName} ${school || ""} high-school`;
      console.log("[247] Firecrawl search query:", searchQuery);

      const searchResults = await firecrawlSearch(firecrawlKey, searchQuery, 5);
      console.log("[247] Search returned", searchResults.length, "results");

      if (searchResults.length === 0) {
        console.log("[247] No search results");
        return new Response(JSON.stringify({ success: true, data: null, outcome: "no_results" }), { headers });
      }

      // Score and pick best URL
      const profileUrl = pickBestUrl(searchResults, score247Url, firstName, lastName);
      if (!profileUrl) {
        console.log("[247] No matching /player/ URL in results. URLs found:", searchResults.map(r => r.url));
        return new Response(JSON.stringify({ success: true, data: null, outcome: "no_match" }), { headers });
      }
      console.log("[247] Best profile URL:", profileUrl);

      const html = await firecrawlScrapeHtml(firecrawlKey, profileUrl, 2000);
      if (!html) {
        console.log("[247] HTML scrape returned null");
        return new Response(JSON.stringify({ success: true, data: null, outcome: "scrape_failed" }), { headers });
      }
      console.log("[247] HTML scraped, length:", html.length);

      const parsed = parse247RecruitingData(html, position, playerState);
      console.log("[247] Parsed result:", JSON.stringify(parsed));

      // Extract action photo from already-fetched 247 HTML
      const find247ActionPhoto = (): string | null => {
        const imgMatches = [
          ...html.matchAll(
            /src="(https?:\/\/[^"]*(?:247sports|s3media\.247sports)[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/gi,
          ),
        ].map((m) => m[1]);
        console.log("[247] Total image URLs found:", imgMatches.length);
        return (
          imgMatches.find((url) => {
            const lower = url.toLowerCase();
            // Skip non-player images
            if (lower.includes("headshot")) return false;
            if (lower.includes("logo")) return false;
            if (lower.includes("icon")) return false;
            if (lower.includes("favicon")) return false;
            if (lower.includes("sprite")) return false;
            if (lower.includes("banner")) return false;
            if (lower.includes("/nav/")) return false;
            if (lower.includes("/site/")) return false;
            // Prefer large player/action photos from 247 CDN
            if (lower.includes("s3media.247sports.com/uploads/assets")) return true;
            if (lower.includes("/player/")) return true;
            return false;
          }) ?? null
        );
      };
      const actionPhoto247 = find247ActionPhoto();
      console.log("[247] Action photo from HTML:", actionPhoto247);

      const data: Record<string, unknown> = {};
      if (parsed.stars247 !== null) data.stars247 = parsed.stars247;
      if (parsed.playerRating247 !== null) data.rating247 = parsed.playerRating247;
      if (parsed.positionRank !== null) data.positionRank = parsed.positionRank;
      if (parsed.stateRank !== null) data.stateRank = parsed.stateRank;
      if (parsed.compositeStars247 !== null) data.compositeStars247 = parsed.compositeStars247;
      if (parsed.compositeRating247 !== null) data.compositeRating247 = parsed.compositeRating247;
      if (parsed.compositeNationalRank247 !== null) data.compositeNationalRank247 = parsed.compositeNationalRank247;
      if (parsed.compositePositionRank247 !== null) data.compositePositionRank247 = parsed.compositePositionRank247;
      if (parsed.compositeStateRank247 !== null) data.compositeStateRank247 = parsed.compositeStateRank247;
      if (actionPhoto247) data.actionPhotoUrl = actionPhoto247;

      const outcome = Object.keys(data).length > 0 ? "success" : "parse_empty";
      return new Response(
        JSON.stringify({ success: true, data: Object.keys(data).length > 0 ? data : null, outcome }),
        { headers },
      );
    }

    /* ── On3 ───────────────────────────────────────────────────── */
    if (mode === "on3") {
      console.log("[on3] Phase started", { firstName, lastName, position, school });

      if (!firstName || !lastName) {
        return new Response(JSON.stringify({ success: false, error: "Name required" }), { status: 400, headers });
      }

      // Use Firecrawl Search API instead of scraping Google
      const searchQuery = `site:on3.com/rivals/ ${firstName} ${lastName} ${school || ""}`;
      console.log("[on3] Firecrawl search query:", searchQuery);

      const searchResults = await firecrawlSearch(firecrawlKey, searchQuery, 5);
      console.log("[on3] Search returned", searchResults.length, "results");

      if (searchResults.length === 0) {
        console.log("[on3] No search results");
        return new Response(JSON.stringify({ success: true, data: null, outcome: "no_results" }), { headers });
      }

      const profileUrl = pickBestUrl(searchResults, scoreOn3Url, firstName, lastName);
      if (!profileUrl) {
        console.log("[on3] No matching /rivals/ URL in results. URLs found:", searchResults.map(r => r.url));
        return new Response(JSON.stringify({ success: true, data: null, outcome: "no_match" }), { headers });
      }
      console.log("[on3] Best profile URL:", profileUrl);

      const prompt = `Extract recruiting and NIL data for ${firstName} ${lastName}. Fields needed: on3Rating (On3 proprietary decimal rating), on3NationalRank, on3PositionRank, on3StateRank, nilValuation (dollar amount as string e.g. '$124,000'). Do NOT extract any photo URLs. Return null for any field not found.`;
      const schema = {
        type: "object",
        properties: {
          on3Rating: { type: "number" },
          on3NationalRank: { type: "number" },
          on3PositionRank: { type: "number" },
          on3StateRank: { type: "number" },
          nilValuation: { type: "string" },
        },
      };

      const json = await firecrawlScrapeExtract(firecrawlKey, profileUrl, prompt, schema, 2000);

      const safeNumber = (val: unknown): number | null =>
        (val && val !== 0 && !isNaN(Number(val))) ? Number(val) : null;

      const sanitized: Record<string, unknown> = {
        on3Rating: safeNumber(json?.on3Rating),
        on3NationalRank: safeNumber(json?.on3NationalRank),
        on3PositionRank: safeNumber(json?.on3PositionRank),
        on3StateRank: safeNumber(json?.on3StateRank),
        nilValuation: json?.nilValuation || null,
      };

      const hasAny = Object.values(sanitized).some(v => v !== null);
      return new Response(JSON.stringify({
        success: true,
        data: sanitized,
        outcome: hasAny ? "success" : "parse_empty",
      }), { headers });
    }

    /* ── ESPN action photo (HTML-based) ─────────────────────────── */
    if (mode === "espn-photo") {
      const espnId = String(body.espnId || "").trim();
      if (!espnId || !firstName || !lastName) {
        return new Response(JSON.stringify({ success: false, error: "espnId and name required" }), { status: 400, headers });
      }

      const espnUrl = `https://www.espn.com/college-football/player/_/id/${espnId}/${firstName.toLowerCase()}-${lastName.toLowerCase()}`;
      console.log("[espn-photo] Scraping:", espnUrl);

      const html = await firecrawlScrapeHtml(firecrawlKey, espnUrl, 2000);
      if (!html) {
        console.log("[espn-photo] No HTML returned");
        return new Response(JSON.stringify({ success: true, data: { actionPhotoUrl: null } }), { headers });
      }
      console.log("[espn-photo] HTML length:", html.length);

      const isActionPhoto = (url: string): boolean => {
        const lower = url.toLowerCase();
        if (!lower.includes("espncdn.com")) return false;
        if (lower.includes("/headshots/")) return false;
        if (lower.includes("headshot")) return false;
        if (lower.includes("logo")) return false;
        if (lower.includes("icon")) return false;
        // Accept both /photo/ and /combiner/ paths without requiring game-context keywords
        if (lower.includes("/photo/") || lower.includes("/combiner/")) return true;
        return false;
      };

      // Match any espncdn.com subdomain (a., a1., a2., media., etc.)
      const imgMatches = [
        ...html.matchAll(/(?:src|content)="(https?:\/\/[a-z0-9]+\.espncdn\.com\/(?:combiner|photo)[^"]+)"/gi),
      ].map(m => m[1]);

      const actionPhoto = imgMatches.find(url => isActionPhoto(url)) || null;

      console.log("[espn-photo] Found action photo:", actionPhoto);
      return new Response(JSON.stringify({ success: true, data: { actionPhotoUrl: actionPhoto } }), { headers });
    }

    /* ── School roster photo ───────────────────────────────────── */
    if (mode === "school-photo") {
      if (!firstName || !lastName || !school) {
        return new Response(JSON.stringify({ success: false, error: "Name and school required" }), { status: 400, headers });
      }

      const schoolDomain = guessSchoolDomain(school);
      if (!schoolDomain) {
        return new Response(JSON.stringify({ success: true, data: null }), { headers });
      }

      const searchUrl = `https://www.google.com/search?q=site:${schoolDomain}+football+roster+${firstName}+${lastName}`;
      const markdown = await firecrawlScrapeMarkdown(firecrawlKey, searchUrl);
      if (!markdown) {
        return new Response(JSON.stringify({ success: true, data: null }), { headers });
      }

      const urlRegex = /https?:\/\/[^\s)\]"']+/g;
      const matches = markdown.match(urlRegex) || [];
      let rosterUrl: string | null = null;
      for (const url of matches) {
        try { new URL(url); } catch { continue; }
        if (url.toLowerCase().includes(schoolDomain) && nameMatchesUrl(url, firstName, lastName)) {
          rosterUrl = url.replace(/[.,;:!?)]+$/, "");
          break;
        }
      }
      if (!rosterUrl) {
        return new Response(JSON.stringify({ success: true, data: null }), { headers });
      }

      const prompt = `Find the player photo for ${firstName} ${lastName} on this roster page. Return the largest available player photo URL. Exclude team photos and placeholder images.`;
      const schema = {
        type: "object",
        properties: { actionPhotoUrl: { type: "string" } },
      };

      const json = await firecrawlScrapeExtract(firecrawlKey, rosterUrl, prompt, schema, 2000);
      return new Response(JSON.stringify({ success: true, data: json }), { headers });
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unknown mode: ${mode}` }),
      { status: 400, headers },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch profile";
    return new Response(JSON.stringify({ success: false, error: msg }), { status: 500, headers });
  }
});
