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

  // Split into named sections. The HTML structure is:
  // <section class="rankings-section">
  //   <h3 class="title">247Sports</h3>          ← proprietary
  //   <div class="ranking"><div class="stars-block">...</div><div class="rank-block">84</div></div>
  //   <ul class="ranks-list">...</ul>
  // </section>
  // <section class="rankings-section">
  //   <h3 class="title">247Sports Composite®</h3>
  //   <div class="ranking"><div class="stars-block">...</div><div class="rank-block">0.8392</div></div>
  //   <ul class="ranks-list">...</ul>
  // </section>

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

  // --- Proprietary 247Sports ---
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

  // --- Composite 247Sports ---
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

      const searchUrl = `https://www.google.com/search?q=site:247sports.com/player/+${firstName}-${lastName}+high-school`;
      console.log("[247] Google search URL:", searchUrl);

      const markdown = await firecrawlScrapeMarkdown(firecrawlKey, searchUrl);
      if (!markdown) {
        console.log("[247] Google search returned no markdown");
        return new Response(JSON.stringify({ success: true, data: null }), { headers });
      }
      console.log("[247] Google search returned markdown, length:", markdown.length);

      let profileUrl = extractUrlFromMarkdown(markdown, "247sports.com", "/player/", firstName, lastName);
      if (!profileUrl) {
        console.log("[247] No matching 247sports.com/player/ URL found in search results");
        return new Response(JSON.stringify({ success: true, data: null }), { headers });
      }
      console.log("[247] Initial profile URL:", profileUrl);

      const urlRegex = /https?:\/\/[^\s)\]"']+/g;
      const allUrls = markdown.match(urlRegex) || [];
      for (const u of allUrls) {
        try {
          const parsed = new URL(u);
          if (!parsed.hostname.includes("247sports.com")) continue;
        } catch { continue; }
        const lower = u.toLowerCase();
        if (
          lower.includes("/player/") &&
          nameMatchesUrl(u, firstName, lastName) &&
          lower.includes("high-school")
        ) {
          profileUrl = u.replace(/[.,;:!?)]+$/, "");
          break;
        }
      }
      console.log("[247] Final profile URL:", profileUrl);

      const html = await firecrawlScrapeHtml(firecrawlKey, profileUrl, 2000);
      if (!html) {
        console.log("[247] HTML scrape returned null");
        return new Response(JSON.stringify({ success: true, data: null }), { headers });
      }
      console.log("[247] HTML scraped, length:", html.length);

      const parsed = parse247RecruitingData(html, position, playerState);
      console.log("[247] Parsed result:", JSON.stringify(parsed));

      // Extract action photo from already-fetched 247 HTML (Phase B — no extra API call)
      const find247ActionPhoto = (): string | null => {
        const slug = `${firstName.toLowerCase()}-${lastName.toLowerCase()}`;
        const imgMatches = [
          ...html.matchAll(
            /src="(https?:\/\/[^"]*247sports[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/gi,
          ),
        ].map((m) => m[1]);
        return (
          imgMatches.find((url) => {
            const lower = url.toLowerCase();
            // Must contain the player's name slug to be the right person
            if (!lower.includes(slug)) return false;
            // Exclude headshots, logos, icons
            if (lower.includes("headshot")) return false;
            if (lower.includes("logo")) return false;
            if (lower.includes("icon")) return false;
            return true;
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

      return new Response(
        JSON.stringify({ success: true, data: Object.keys(data).length > 0 ? data : null }),
        { headers },
      );
    }

    /* ── On3 (no action photo — On3 only returns headshots) ───── */
    if (mode === "on3") {
      if (!firstName || !lastName) {
        return new Response(JSON.stringify({ success: false, error: "Name required" }), { status: 400, headers });
      }

      const searchUrl = `https://www.google.com/search?q=site:on3.com/rivals/+${firstName}-${lastName}`;
      const markdown = await firecrawlScrapeMarkdown(firecrawlKey, searchUrl);
      if (!markdown) {
        return new Response(JSON.stringify({ success: true, data: null }), { headers });
      }

      const profileUrl = extractUrlFromMarkdown(markdown, "on3.com", "/rivals/", firstName, lastName);
      if (!profileUrl) {
        return new Response(JSON.stringify({ success: true, data: null }), { headers });
      }

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

      return new Response(JSON.stringify({ success: true, data: sanitized }), { headers });
    }

    /* ── ESPN action photo (HTML-based, Phase A) ─────────────── */
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

      // Target ESPN action/editorial images: combiner/ and photo/ paths only
      const imgMatches = [
        ...html.matchAll(/(?:src|content)="(https?:\/\/a\.espncdn\.com\/(?:combiner|photo)[^"]+)"/gi),
      ].map(m => m[1]);

      const actionPhoto = imgMatches.find(url => {
        const lower = url.toLowerCase();
        if (lower.includes("/i/headshots/")) return false;
        if (lower.includes("helmet")) return false;
        if (lower.includes("logo")) return false;
        return /\.(jpg|jpeg|png|webp)/i.test(url) || lower.includes("combiner");
      }) || null;

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

    /* Google Image Search removed — unreliable, returns wrong players */

    return new Response(
      JSON.stringify({ success: false, error: `Unknown mode: ${mode}` }),
      { status: 400, headers },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch profile";
    return new Response(JSON.stringify({ success: false, error: msg }), { status: 500, headers });
  }
});
