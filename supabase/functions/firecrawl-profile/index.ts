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

function extractUrlFromMarkdown(markdown: string, domain: string, path: string, firstName: string, lastName: string): string | null {
  const urlRegex = /https?:\/\/[^\s)\]"']+/g;
  const matches = markdown.match(urlRegex) || [];
  for (const url of matches) {
    // Must be a direct URL on the target domain, not a Google URL containing it in query params
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.includes(domain)) continue;
    } catch {
      continue;
    }
    if (url.toLowerCase().includes(path) && nameMatchesUrl(url, firstName, lastName)) {
      return url.replace(/[.,;:!?)]+$/, "");
    }
  }
  return null;
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

  const before247Ranking = html.split('<div class="ranking">')[0] || html;
  const stars247 = countYellowStars(before247Ranking);

  const playerRatingMatch = before247Ranking.match(
    /<div class="rank-block">\s*(\d{2,3})\s*<\/div>/,
  );
  const playerRating247 = playerRatingMatch ? parseInt(playerRatingMatch[1]) : null;

  const positionRank = pos ? findRankInList(html, pos, false) : null;
  const stateRank = state ? findRankInList(html, state, false) : null;

  const rankingBlockMatch = html.match(
    /<div class="ranking">([\s\S]*?)<\/div>\s*<\/div>/,
  );
  const compositeStars247 = rankingBlockMatch
    ? countYellowStars(rankingBlockMatch[1])
    : null;

  const compositeRatingMatch = html.match(
    /<div class="ranking">[\s\S]*?<div class="rank-block">\s*(0\.\d{3,6})\s*<\/div>/,
  );
  const compositeRating247 = compositeRatingMatch
    ? parseFloat(compositeRatingMatch[1])
    : null;

  const compositeNationalRank247 = findRankInList(html, "Natl.", true);
  const compositePositionRank247 = pos ? findRankInList(html, pos, true) : null;
  const compositeStateRank247 = state ? findRankInList(html, state, true) : null;

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

      // Step 1: Google search for 247 profile — always attempted
      const searchUrl = `https://www.google.com/search?q=site:247sports.com/player/+${firstName}-${lastName}+high-school`;
      console.log("[247] Google search URL:", searchUrl);

      const markdown = await firecrawlScrapeMarkdown(firecrawlKey, searchUrl);
      if (!markdown) {
        console.log("[247] Google search returned no markdown");
        return new Response(JSON.stringify({ success: true, data: null }), { headers });
      }
      console.log("[247] Google search returned markdown, length:", markdown.length);

      // Step 2: Validate URL — prefer high-school path, fall back to main player URL
      let profileUrl = extractUrlFromMarkdown(markdown, "247sports.com", "/player/", firstName, lastName);
      if (!profileUrl) {
        console.log("[247] No matching 247sports.com/player/ URL found in search results");
        return new Response(JSON.stringify({ success: true, data: null }), { headers });
      }
      console.log("[247] Initial profile URL:", profileUrl);

      // Prefer high-school variant if available
      const urlRegex = /https?:\/\/[^\s)\]"']+/g;
      const allUrls = markdown.match(urlRegex) || [];
      for (const u of allUrls) {
        const lower = u.toLowerCase();
        if (
          lower.includes("247sports.com/player/") &&
          nameMatchesUrl(u, firstName, lastName) &&
          lower.includes("high-school")
        ) {
          profileUrl = u.replace(/[.,;:!?)]+$/, "");
          break;
        }
      }
      console.log("[247] Final profile URL:", profileUrl);

      // Step 3: Scrape HTML and parse deterministically
      const html = await firecrawlScrapeHtml(firecrawlKey, profileUrl, 2000);
      if (!html) {
        console.log("[247] HTML scrape returned null");
        return new Response(JSON.stringify({ success: true, data: null }), { headers });
      }
      console.log("[247] HTML scraped, length:", html.length);

      const parsed = parse247RecruitingData(html, position, playerState);
      console.log("[247] Parsed result:", JSON.stringify(parsed));

      // Map to store field names
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

      return new Response(
        JSON.stringify({ success: true, data: Object.keys(data).length > 0 ? data : null }),
        { headers },
      );
    }

    /* ── On3 ───────────────────────────────────────────────────── */
    if (mode === "on3") {
      if (!firstName || !lastName) {
        return new Response(JSON.stringify({ success: false, error: "Name required" }), { status: 400, headers });
      }

      // Step 1: Google search for On3 profile (on3.com/rivals/)
      const searchUrl = `https://www.google.com/search?q=site:on3.com/rivals/+${firstName}-${lastName}`;
      const markdown = await firecrawlScrapeMarkdown(firecrawlKey, searchUrl);
      if (!markdown) {
        return new Response(JSON.stringify({ success: true, data: null }), { headers });
      }

      // Step 2: Validate URL
      const profileUrl = extractUrlFromMarkdown(markdown, "on3.com", "/rivals/", firstName, lastName);
      if (!profileUrl) {
        return new Response(JSON.stringify({ success: true, data: null }), { headers });
      }

      // Step 3: Extract data
      const prompt = `Extract recruiting, NIL, and photo data for ${firstName} ${lastName}. Fields needed: on3Rating (On3 proprietary decimal rating), on3NationalRank, on3PositionRank, on3StateRank, nilValuation (dollar amount as string e.g. '$124,000'), actionPhotoUrl (full URL of the largest player action photo on the page). Return null for any field not found.`;
      const schema = {
        type: "object",
        properties: {
          on3Rating: { type: "number" },
          on3NationalRank: { type: "number" },
          on3PositionRank: { type: "number" },
          on3StateRank: { type: "number" },
          nilValuation: { type: "string" },
          actionPhotoUrl: { type: "string" },
        },
      };

      const json = await firecrawlScrapeExtract(firecrawlKey, profileUrl, prompt, schema, 2000);

      // Sanitize On3 numeric fields — 0 means "not found"
      const safeNumber = (val: unknown): number | null =>
        (val && val !== 0 && !isNaN(Number(val))) ? Number(val) : null;

      const sanitized: Record<string, unknown> = {
        on3Rating: safeNumber(json?.on3Rating),
        on3NationalRank: safeNumber(json?.on3NationalRank),
        on3PositionRank: safeNumber(json?.on3PositionRank),
        on3StateRank: safeNumber(json?.on3StateRank),
        nilValuation: json?.nilValuation || null,
        actionPhotoUrl: json?.actionPhotoUrl || null,
      };

      return new Response(JSON.stringify({ success: true, data: sanitized }), { headers });
    }

    /* ── ESPN action photo ─────────────────────────────────────── */
    if (mode === "espn-photo") {
      const espnId = String(body.espnId || "").trim();
      if (!espnId || !firstName || !lastName) {
        return new Response(JSON.stringify({ success: false, error: "espnId and name required" }), { status: 400, headers });
      }

      const espnUrl = `https://www.espn.com/college-football/player/_/id/${espnId}/${firstName.toLowerCase()}-${lastName.toLowerCase()}`;
      const prompt = `Find the main action photo of the player on this ESPN page. Return the full image URL. EXCLUDE any URL containing '/headshots/' — that is the profile headshot, not the action photo. EXCLUDE logos, thumbnails, and team photos. Return null if no qualifying action photo found.`;
      const schema = {
        type: "object",
        properties: { actionPhotoUrl: { type: "string" } },
      };

      const json = await firecrawlScrapeExtract(firecrawlKey, espnUrl, prompt, schema, 1500);
      return new Response(JSON.stringify({ success: true, data: json }), { headers });
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

      const rosterUrl = extractUrlFromMarkdown(markdown, schoolDomain, "", firstName, lastName);
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

    /* ── Google Image Search photo ─────────────────────────────── */
    if (mode === "google-image-photo") {
      if (!firstName || !lastName || !school) {
        return new Response(JSON.stringify({ success: false, error: "Name and school required" }), { status: 400, headers });
      }

      const searchUrl = `https://www.google.com/search?q=${firstName}+${lastName}+${school}+football+action+game&tbm=isch`;
      const prompt = `Find one high-quality in-game college football action photo of ${firstName} ${lastName} from ${school}. Return the direct image URL only. EXCLUDE: Hudl images, high school photos, headshots, studio portraits, practice photos, team group photos. EXCLUDE any URL containing: hudl.com, maxpreps.com. Prefer images from: espn.com, 247sports.com, on3.com, or the official school athletic website. Return null if no qualifying college game action photo found.`;
      const schema = {
        type: "object",
        properties: { actionPhotoUrl: { type: "string" } },
      };

      const json = await firecrawlScrapeExtract(firecrawlKey, searchUrl, prompt, schema);
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
