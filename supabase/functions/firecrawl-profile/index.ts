const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CFBD_BASE = "https://apinext.collegefootballdata.com";

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
  firstName: string; lastName: string; position: string; jersey: number;
  height: number; weight: number; year: number; homeCity: string; homeState: string;
};
type Recruit = {
  name: string; school: string; stars: number; ranking: number;
  position: string; city: string; stateProvince: string; year: number;
};

function extractRecruitingFields(content: string, merged: Record<string, string | number>) {
  if (!merged.rating247) {
    for (const pat of [
      /247\s*(?:Sports?)?\s*(?:Rating|Score|Composite|Grade)[:\s]*([\d.]+)/i,
      /(?:Rating|Score|Composite)[:\s]*([\d.]+)\s*.*?247/i,
      /(?:^|\s)(0\.(?:9|8)\d{2,3})(?:\s|$)/m,
    ]) { const m = content.match(pat); if (m) { merged.rating247 = m[1]; break; } }
  }
  if (!merged.ratingOn3) {
    for (const pat of [
      /On3\s*(?:Rating|Score|Consensus|Grade|NIL)[:\s]*([\d.]+)/i,
      /(?:Rating|Score)[:\s]*([\d.]+)\s*.*?On3/i,
    ]) { const m = content.match(pat); if (m) { merged.ratingOn3 = m[1]; break; } }
  }
  if (!merged.ratingComposite) {
    for (const pat of [
      /(?:Composite|Industry|Overall)\s*(?:Rating|Score|Ranking|Grade)[:\s]*([\d.]+)/i,
      /(?:Comp\.?|COMPRTG)[:\s]*([\d.]+)/i,
    ]) { const m = content.match(pat); if (m) { merged.ratingComposite = m[1]; break; } }
  }
  if (!merged.offersCount) {
    for (const pat of [/(\d+)\s*(?:total\s*)?offers/i, /Offers[:\s]*(\d+)/i]) {
      const m = content.match(pat); if (m) { merged.offersCount = parseInt(m[1], 10); break; }
    }
  }
  if (!merged.starRating) { const m = content.match(/(\d)\s*-?\s*Star/i); if (m) merged.starRating = parseInt(m[1], 10); }
  if (!merged.nationalRank) { const m = content.match(/(?:National|Natl?|Overall)\s*(?:Rank|#|Ranking)[:\s]*#?(\d+)/i); if (m) merged.nationalRank = parseInt(m[1], 10); }
  if (!merged.positionRank) { const m = content.match(/(?:Position|Pos)\s*(?:Rank|#|Ranking)[:\s]*#?(\d+)/i); if (m) merged.positionRank = parseInt(m[1], 10); }
  // Height extraction — multiple common formats
  if (!merged.height) {
    for (const pat of [
      /Height[:\s]*(\d+[''′]\s*\d+[""″]?)/i,
      /Height[:\s]*(\d+-\d+)/i,
      /HT\/WT[:\s]*(\d+['-]\d+)/i,
      /(\d+[''′]\s*\d+[""″]?)\s*[\|\/,]\s*\d+\s*(?:lbs?|pounds)/i,
      /(?:^|\||\n)\s*(\d[''′]\d+[""″]?)\s*(?:\||$|\n)/m,
    ]) { const m = content.match(pat); if (m) { merged.height = m[1].replace(/\s+/g, ""); break; } }
  }
  // Weight extraction — multiple formats
  if (!merged.weight) {
    for (const pat of [
      /Weight[:\s]*(\d{2,3})\s*(?:lbs?|pounds)?/i,
      /HT\/WT[:\s]*\d+['-]\d+[,\s\/|]+(\d{2,3})\s*(?:lbs?)?/i,
      /(\d{2,3})\s*(?:lbs|pounds)/i,
    ]) { const m = content.match(pat); if (m) { merged.weight = m[1]; break; } }
  }
  if (!merged.hometown) { const m = content.match(/Hometown[:\s]*([A-Za-z\s]+,\s*[A-Z]{2})/i); if (m) merged.hometown = m[1].trim(); }
  // High school extraction — broader patterns
  if (!merged.highSchool) {
    const hsExclude = /^(the|a|an|in|at|Natl|National|QB|WR|RB|TE|OL|DL|LB|CB|S|K|P|FB|ATH)/i;
    for (const pat of [
      /High\s*School[:\s]+([A-Z][A-Za-z0-9 .'()-]{2,39}?)(?:\s*\(|\s*-|\s*$|\s*\n|\s*\|)/,
      /High\s*School[:\s]+([A-Z][A-Za-z0-9 .'()-]{2,39})/,
      /(?:attends|attended|from)\s+([A-Z][A-Za-z .'()-]+?)\s+(?:High|HS)/i,
      /([A-Z][A-Za-z .'()-]{3,}?)\s+High\s+School/,
    ]) {
      const m = content.match(pat);
      if (m) {
        const c = m[1].trim().replace(/[\[\]|]+$/, "").trim();
        if (c.length >= 3 && !/^\d+$/.test(c) && !hsExclude.test(c) && !/recruit|player|prospect/i.test(c)) {
          merged.highSchool = c;
          break;
        }
      }
    }
  }
  if (!merged.fortyTime) { const m = content.match(/40[- ]?(?:yard|yd)?[:\s]*(\d+\.\d+)/i); if (m) merged.fortyTime = m[1]; }
}

// Score an image URL + context for college action-photo likelihood (no vision model)
function scoreActionCandidate(
  src: string, altText: string, nameTokens: string[], jerseyNum: string
): number {
  let score = 0;
  const combined = `${decodeURIComponent(src)} ${altText}`.toLowerCase();

  // ── HARD EXCLUSIONS (return -999) ──
  if (/hudl\.com|hudl\.tv|vi\.hudl/i.test(src)) return -999;
  if (/headshot|portrait|mugshot|posed|studio|staff|coach|logo|icon|badge|practice|warmup|training/i.test(combined)) return -999;
  if (/high[\s-]?school|hs\b|prep\b|middle[\s-]?school/i.test(combined)) return -999;
  if (/stock|getty|shutterstock|istock|alamy|depositphoto/i.test(combined)) return -999;
  if (/team[\s-]?photo|group[\s-]?photo|class[\s-]?photo/i.test(combined)) return -999;

  // Name match signals
  const nameHits = nameTokens.filter(t => t.length > 2 && combined.includes(t)).length;
  score += nameHits * 20;

  // Jersey number match
  if (jerseyNum && combined.includes(jerseyNum)) score += 15;

  // College game action keywords
  if (/action|game|catch|throw|run|route|tackle|block|rush|pass|touchdown|scramble|sprint|snap|sack|interception/i.test(altText)) score += 25;
  if (/action|game|catch|throw|run|route|tackle|block|rush|pass|touchdown/i.test(src)) score += 10;

  // College context signals
  if (/vs\.?|versus|college|ncaa|cfb|bowl|playoff|conference|sec\b|big[\s-]?(?:ten|12|east)|acc\b|pac[\s-]?12/i.test(combined)) score += 15;
  if (/highlight|game[\s-]?day|broadcast/i.test(combined)) score += 10;

  // Source quality tiers
  if (/247sports/i.test(src)) score += 12;
  if (/on3\.com|on3static/i.test(src)) score += 10;
  if (/espn\.com|espncdn/i.test(src)) score += 10;
  if (/rivals\.com/i.test(src)) score += 5;
  if (/profilephoto|player.*photo|gallery|media/i.test(src)) score += 15;

  // Penalty for tiny images
  if (/[?&](?:width|w|height|h)=(?:[1-9]\d?|1[0-5]\d)(?:&|$)/i.test(src)) score -= 30;
  if (/[/,]w_([1-9]\d?|1[0-5]\d)[/,]/i.test(src)) score -= 30;

  // Bonus for larger explicit sizes
  const wMatch = src.match(/[/,]w_(\d+)[/,]/i) || src.match(/[?&](?:width|w)=(\d+)/i);
  if (wMatch && parseInt(wMatch[1], 10) >= 400) score += 10;

  // og:image URLs are usually good
  if (/og.image|opengraph/i.test(src)) score += 12;

  return score;
}

// ── Main handler ─────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const rawText = await req.text();
    let body: Record<string, unknown> = {};
    if (rawText) { try { body = JSON.parse(rawText); } catch { return new Response(JSON.stringify({ success: false, error: "Could not parse JSON body" }), { status: 400, headers }); } }

    const name = String(body.name || "").trim();
    const rawSchool = String(body.school || "").trim();
    const knownFields = (body.knownFields || {}) as Record<string, string | undefined>;
    if (!name) return new Response(JSON.stringify({ success: false, error: "Athlete name is required" }), { status: 400, headers });

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const cfbdKey = Deno.env.get("CFBD_API_KEY");
    const nameParts = name.split(/\s+/);
    const lastName = nameParts[nameParts.length - 1].toLowerCase();
    const firstName = nameParts[0].toLowerCase();
    const nameTokens = name.toLowerCase().split(/\s+/);
    const merged: Record<string, string | number> = {};
    const sources: string[] = [];

    // Strip mascot from school name for CFBD API calls (e.g. "BYU Cougars" → "BYU")
    // CFBD teams endpoint returns school names without mascot
    let school = rawSchool;
    if (cfbdKey && rawSchool) {
      // Try to resolve the bare school name via CFBD teams lookup
      try {
        const teamsResp = await cfbdFetch<Array<{ school: string; mascot: string }>>(cfbdKey, "/teams", {});
        if (teamsResp && Array.isArray(teamsResp)) {
          const match = teamsResp.find(t => {
            const full = t.mascot ? `${t.school} ${t.mascot}` : t.school;
            return full.toLowerCase() === rawSchool.toLowerCase() || t.school.toLowerCase() === rawSchool.toLowerCase();
          });
          if (match) school = match.school;
        }
      } catch { /* use rawSchool as-is */ }
    }

    // ═══ PHASE 1: CFBD ═══
    if (cfbdKey && school) {
      const yr = new Date().getFullYear();
      // Fetch current year + previous year rosters for fallback (measurables may lag)
      const [roster, rosterPrev, recruits, recruitsPrev, playerSearch] = await Promise.all([
        cfbdFetch<RosterPlayer[]>(cfbdKey, "/roster", { team: school, year: yr }),
        cfbdFetch<RosterPlayer[]>(cfbdKey, "/roster", { team: school, year: yr - 1 }),
        cfbdFetch<Recruit[]>(cfbdKey, "/recruiting/players", { team: school, year: yr }),
        cfbdFetch<Recruit[]>(cfbdKey, "/recruiting/players", { team: school, year: yr - 1 }),
        cfbdFetch<Array<{ firstName: string; lastName: string; position: string; jersey: number; height: number; weight: number; team: string; year: number; homeCity: string; homeState: string }>>(
          cfbdKey, "/player/search", { searchTerm: name, team: school }
        ),
      ]);

      // Try matching from current roster, then previous year, then player search
      const findMatch = (list: RosterPlayer[] | null) => {
        if (!list || !Array.isArray(list)) return null;
        // Try exact name match first
        let m = list.find(p => p.firstName?.toLowerCase() === firstName && p.lastName?.toLowerCase() === lastName);
        if (m) return m;
        // Try with jersey number filter if known
        const jNum = knownFields.number ? parseInt(knownFields.number, 10) : null;
        if (jNum != null) {
          m = list.find(p => p.jersey === jNum && p.lastName?.toLowerCase() === lastName);
          if (m) return m;
        }
        return null;
      };

      const match = findMatch(roster) || findMatch(rosterPrev);
      // Also check playerSearch results
      const psMatch = (playerSearch && Array.isArray(playerSearch))
        ? playerSearch.find(p => p.firstName?.toLowerCase() === firstName && p.lastName?.toLowerCase() === lastName)
        : null;

      const rosterHit = match || psMatch;
      if (rosterHit) {
        sources.push("CFBD Roster");
        if (rosterHit.height) merged.height = String(rosterHit.height);
        if (rosterHit.weight) merged.weight = String(rosterHit.weight);
        if (rosterHit.position && !knownFields.position) merged.position = rosterHit.position;
        if (rosterHit.jersey != null && !knownFields.number) merged.number = String(rosterHit.jersey);
        if (rosterHit.homeCity && rosterHit.homeState) merged.hometown = `${rosterHit.homeCity}, ${rosterHit.homeState}`;
        else if (rosterHit.homeCity) merged.hometown = rosterHit.homeCity;
        if ((rosterHit as RosterPlayer).year && !knownFields.classYear) {
          const ym: Record<number, string> = { 1: "Freshman", 2: "Sophomore", 3: "Junior", 4: "Senior", 5: "5th Year" };
          merged.classYear = ym[(rosterHit as RosterPlayer).year] || String((rosterHit as RosterPlayer).year);
        }
      }
      // If height/weight still missing from match, check the other roster year
      if (match && (!match.height || !match.weight)) {
        const altMatch = findMatch(match === findMatch(roster) ? rosterPrev : roster);
        if (altMatch) {
          if (!merged.height && altMatch.height) merged.height = String(altMatch.height);
          if (!merged.weight && altMatch.weight) merged.weight = String(altMatch.weight);
        }
      }

      const allR = [...(recruits || []), ...(recruitsPrev || [])];
      const rMatch = allR.find(r => { const n = (r.name || "").toLowerCase(); return n.includes(firstName) && n.includes(lastName); });
      if (rMatch) {
        sources.push("CFBD Recruiting");
        if (rMatch.stars && !merged.starRating) merged.starRating = rMatch.stars;
        if (rMatch.ranking && !merged.nationalRank) merged.nationalRank = rMatch.ranking;
        if (rMatch.city && rMatch.stateProvince && !merged.hometown) merged.hometown = `${rMatch.city}, ${rMatch.stateProvince}`;
      }
    }

    // ═══ PHASE 2: Firecrawl — recruiting + images ═══
    if (!firecrawlKey) {
      return new Response(JSON.stringify({ success: true, data: merged, sources, resultsCount: sources.length }), { headers });
    }

    const authHdrs = { "Authorization": "Bearer " + firecrawlKey, "Content-Type": "application/json" };
    const posTag = knownFields.position || String(merged.position || "");
    const searchBase = `${name}${posTag ? " " + posTag : ""} ${school || ""} football`.trim();

    // Separate searches for better coverage
    const [s247, sOn3] = await Promise.all([
      fetch("https://api.firecrawl.dev/v1/search", { method: "POST", headers: authHdrs,
        body: JSON.stringify({ query: `${searchBase} profile site:247sports.com`, limit: 3, scrapeOptions: { formats: ["markdown"] } }) }),
      fetch("https://api.firecrawl.dev/v1/search", { method: "POST", headers: authHdrs,
        body: JSON.stringify({ query: `${searchBase} profile site:on3.com`, limit: 3, scrapeOptions: { formats: ["markdown"] } }) }),
    ]);

    const fcResults: Array<Record<string, unknown>> = [];
    for (const resp of [s247, sOn3]) {
      if (resp.ok) { const d = await resp.json(); if (d.data) fcResults.push(...d.data); }
    }

    for (const result of fcResults) {
      const srcUrl = String(result.url || (result.metadata as Record<string, unknown>)?.sourceURL || "");
      if (srcUrl && !sources.includes(srcUrl)) sources.push(srcUrl);
      const content = String(result.markdown || (result.data as Record<string, unknown>)?.markdown || "");
      if (content) extractRecruitingFields(content, merged);
    }

    // Normalize height/weight
    if (merged.height) {
      const dm = String(merged.height).match(/^(\d+)['\-](\d+)[""]?$/);
      if (dm) merged.height = String(parseInt(dm[1], 10) * 12 + parseInt(dm[2], 10));
    }
    if (merged.weight) merged.weight = String(merged.weight).replace(/\s*lbs?\.?\s*/gi, "").trim();

    if (knownFields.position) delete merged.position;
    if (knownFields.number) delete merged.number;
    if (knownFields.classYear) delete merged.classYear;

    // ═══ PHASE 3: Action Photo — URL/alt-text/context scoring (NO vision model) ═══
    const imageUrls: Record<string, string> = {};
    type ScoredImage = { url: string; score: number };
    const scoredCandidates: ScoredImage[] = [];

    try {
      // Priority: 247Sports → On3 → ESPN → Official team site → Rivals
      const profileUrls = sources.filter(s => /247sports\.com|on3\.com|espn\.com|rivals\.com/i.test(s));
      profileUrls.sort((a, b) => {
        const priority = (u: string) => /247sports/i.test(u) ? 0 : /on3/i.test(u) ? 1 : /espn/i.test(u) ? 2 : 3;
        return priority(a) - priority(b);
      });
      const imageSourceUrls = profileUrls.slice(0, 4);
      const jerseyNum = knownFields.number || String(merged.number || "");

      const scrapePromises = imageSourceUrls.map(async (pageUrl: string) => {
        try {
          const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST", headers: authHdrs,
            body: JSON.stringify({ url: pageUrl, formats: ["html"], onlyMainContent: false }),
          });
          if (!resp.ok) return [];
          const data = await resp.json();
          const html = String(data.data?.html || data.html || "");
          const results: Array<{ url: string; alt: string }> = [];

          // img src with alt text
          const imgRegex = /<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*/gi;
          let m;
          while ((m = imgRegex.exec(html)) !== null) {
            const src = m[1];
            if (/logo|icon|sprite|badge|button|pixel|\.svg|\.gif|spacer|avatar|favicon|tracking|advertisement|sponsor/i.test(src)) continue;
            if (src.length < 30) continue;
            const altM = m[0].match(/alt=["']([^"']*)["']/i);
            results.push({ url: src, alt: altM ? altM[1] : "" });
          }
          // data-src
          const dsr = /data-src=["'](https?:\/\/[^"']+)["']/gi;
          while ((m = dsr.exec(html)) !== null) {
            if (/logo|icon|sprite|\.svg|\.gif|spacer|favicon/i.test(m[1])) continue;
            if (m[1].length < 30) continue;
            results.push({ url: m[1], alt: "" });
          }
          // og:image
          const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["'](https?:\/\/[^"']+)["']/i)
            || html.match(/<meta[^>]+content=["'](https?:\/\/[^"']+)["'][^>]+property=["']og:image["']/i);
          if (og) results.unshift({ url: og[1], alt: "og:image" });

          return results;
        } catch { return []; }
      });

      const allImages = (await Promise.all(scrapePromises)).flat();

      // Deduplicate and score
      const seen = new Set<string>();
      for (const { url: rawUrl, alt } of allImages) {
        // Upscale CDN
        let u = rawUrl.replace(/\/cdn-cgi\/image\/[^/]+\//, "/").replace(/\?fit=(?:crop|bounds)[^&]*(?:&[^&]*)*$/i, "").replace(/\/w_\d+\b/, "/w_800");
        if (seen.has(u)) continue;
        seen.add(u);
        const s = scoreActionCandidate(u, alt, nameTokens, jerseyNum);
        if (s > 0) scoredCandidates.push({ url: u, score: s });
      }

      // Sort by score descending
      scoredCandidates.sort((a, b) => b.score - a.score);
    } catch { /* non-critical */ }

    // ═══ PHASE 4: Validate top candidates ═══
    const validateImageUrl = async (url: string): Promise<boolean> => {
      try {
        const resp = await fetch(url, { method: "GET", headers: { "User-Agent": "Mozilla/5.0", "Range": "bytes=0-0" }, redirect: "follow" });
        if (!resp.ok && resp.status !== 206) return false;
        const ct = resp.headers.get("content-type") || "";
        return ct.startsWith("image/") || ct.includes("octet-stream");
      } catch { return false; }
    };

    // Validate top 5 candidates, pick the first valid one
    const topCandidates = scoredCandidates.slice(0, 5).map(c => c.url);
    for (const url of topCandidates) {
      if (await validateImageUrl(url)) {
        imageUrls.actionPhoto = url;
        break;
      }
    }

    // ═══ PHASE 5: Fallback — targeted image search if primary found nothing ═══
    if (!imageUrls.actionPhoto && firecrawlKey) {
      try {
        const yr = new Date().getFullYear();
        const imgQuery = `${name} ${school || ""} ${posTag || ""} game action photo ${yr}`.trim();
        const searchResp = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST", headers: authHdrs,
          body: JSON.stringify({
            query: imgQuery,
            limit: 5,
            scrapeOptions: { formats: ["html"] },
          }),
        });
        if (searchResp.ok) {
          const searchData = await searchResp.json();
          const results: Array<Record<string, unknown>> = searchData.data || [];
          // Filter for reputable sports sources
          const reputableDomains = /247sports|on3\.com|espn\.com|si\.com|maxpreps|rivals\.com|ncaa\.com|bleacherreport|theathletic/i;
          const fallbackCandidates: ScoredImage[] = [];

          for (const r of results) {
            const srcUrl = String(r.url || "");
            // Skip non-reputable sources
            if (!reputableDomains.test(srcUrl)) continue;
            const html = String(r.html || (r.data as Record<string, unknown>)?.html || "");
            if (!html) continue;
            // Extract images from the page
            const imgRx = /<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*/gi;
            let im;
            while ((im = imgRx.exec(html)) !== null) {
              const src = im[1];
              if (/logo|icon|sprite|badge|\.svg|\.gif|spacer|favicon|tracking|ad|sponsor/i.test(src)) continue;
              if (src.length < 30) continue;
              const altM = im[0].match(/alt=["']([^"']*)["']/i);
              const alt = altM ? altM[1] : "";
              let u = src.replace(/\/cdn-cgi\/image\/[^/]+\//, "/").replace(/\/w_\d+\b/, "/w_800");
              const s = scoreActionCandidate(u, alt, nameTokens, jerseyNum);
              if (s > 5) fallbackCandidates.push({ url: u, score: s });
            }
          }
          fallbackCandidates.sort((a, b) => b.score - a.score);
          // Validate top 3 fallback candidates
          for (const c of fallbackCandidates.slice(0, 3)) {
            if (await validateImageUrl(c.url)) {
              imageUrls.actionPhoto = c.url;
              sources.push("Image Search Fallback");
              break;
            }
          }
        }
      } catch { /* fallback is non-critical */ }
    }

    return new Response(JSON.stringify({
      success: true,
      data: merged,
      imageUrls: Object.keys(imageUrls).length > 0 ? imageUrls : undefined,
      sources,
      resultsCount: sources.length,
    }), { headers });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch profile";
    return new Response(JSON.stringify({ success: false, error: msg }), { status: 500, headers });
  }
});
