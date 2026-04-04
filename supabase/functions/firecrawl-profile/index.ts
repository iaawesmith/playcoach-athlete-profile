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
  first_name: string; last_name: string; position: string; jersey: number;
  height: number; weight: number; year: number; home_city: string; home_state: string;
};
type Recruit = {
  name: string; school: string; stars: number; ranking: number;
  position: string; city: string; state_province: string; year: number;
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
  if (!merged.height) {
    const hm = content.match(/Height[:\s]*(\d+['']\d+[""]?|\d+-\d+)/i) || content.match(/HT\/WT[:\s]*(\d+['-]\d+)/i);
    if (hm) merged.height = hm[1];
  }
  if (!merged.weight) {
    const wm = content.match(/Weight[:\s]*(\d+)\s*(?:lbs?)?/i) || content.match(/HT\/WT[:\s]*\d+['-]\d+[,\s]+(\d+)\s*lbs/i);
    if (wm) merged.weight = wm[1];
  }
  if (!merged.hometown) { const m = content.match(/Hometown[:\s]*([A-Za-z\s]+,\s*[A-Z]{2})/i); if (m) merged.hometown = m[1].trim(); }
  if (!merged.highSchool) {
    const hs = content.match(/High\s*School[:\s]+(?!in\b|at\b|from\b|the\b|recruit|player|prospect|Natl)([A-Z][A-Za-z0-9 .'()-]{2,39})/);
    if (hs) { const c = hs[1].trim().replace(/[\[\]|]+$/, "").trim(); if (c.length >= 3 && !/^\d+$/.test(c)) merged.highSchool = c; }
  }
  if (!merged.fortyTime) { const m = content.match(/40[- ]?(?:yard|yd)?[:\s]*(\d+\.\d+)/i); if (m) merged.fortyTime = m[1]; }
}

// Score an image URL + context for action-photo likelihood (no vision model)
function scoreActionCandidate(
  src: string, altText: string, nameTokens: string[], jerseyNum: string
): number {
  let score = 0;
  const combined = `${decodeURIComponent(src)} ${altText}`.toLowerCase();

  // Name match signals
  const nameHits = nameTokens.filter(t => t.length > 2 && combined.includes(t)).length;
  score += nameHits * 20;

  // Jersey number match
  if (jerseyNum && combined.includes(jerseyNum)) score += 15;

  // Action keywords in alt text or URL
  const actionWords = /action|game|play|catch|throw|run|route|tackle|block|rush|pass|touchdown|scramble|sprint|celebration|snap|huddle/i;
  if (actionWords.test(altText)) score += 25;
  if (actionWords.test(src)) score += 10;

  // Source quality: player gallery / profile photo sections
  if (/profilephoto|player.*photo|gallery|media/i.test(src)) score += 15;
  if (/247sports/i.test(src)) score += 10;
  if (/on3\.com/i.test(src)) score += 8;

  // Penalty for headshot/portrait signals
  if (/headshot|portrait|mugshot|posed|studio|staff|coach|logo|icon|badge/i.test(combined)) score -= 50;

  // Penalty for tiny images (width param)
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
    const school = String(body.school || "").trim();
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

    // ═══ PHASE 1: CFBD ═══
    if (cfbdKey && school) {
      const yr = new Date().getFullYear();
      const [roster, recruits, recruitsPrev] = await Promise.all([
        cfbdFetch<RosterPlayer[]>(cfbdKey, "/roster", { team: school, year: yr }),
        cfbdFetch<Recruit[]>(cfbdKey, "/recruiting/players", { team: school, year: yr }),
        cfbdFetch<Recruit[]>(cfbdKey, "/recruiting/players", { team: school, year: yr - 1 }),
      ]);
      if (roster && Array.isArray(roster)) {
        const match = roster.find(p => p.first_name?.toLowerCase() === firstName && p.last_name?.toLowerCase() === lastName);
        if (match) {
          sources.push("CFBD Roster");
          if (match.height) merged.height = String(match.height);
          if (match.weight) merged.weight = String(match.weight);
          if (match.position && !knownFields.position) merged.position = match.position;
          if (match.jersey != null && !knownFields.number) merged.number = String(match.jersey);
          if (match.home_city && match.home_state) merged.hometown = `${match.home_city}, ${match.home_state}`;
          else if (match.home_city) merged.hometown = match.home_city;
          if (match.year && !knownFields.classYear) {
            const ym: Record<number, string> = { 1: "Freshman", 2: "Sophomore", 3: "Junior", 4: "Senior", 5: "5th Year" };
            merged.classYear = ym[match.year] || String(match.year);
          }
        }
      }
      const allR = [...(recruits || []), ...(recruitsPrev || [])];
      const rMatch = allR.find(r => { const n = (r.name || "").toLowerCase(); return n.includes(firstName) && n.includes(lastName); });
      if (rMatch) {
        sources.push("CFBD Recruiting");
        if (rMatch.stars && !merged.starRating) merged.starRating = rMatch.stars;
        if (rMatch.ranking && !merged.nationalRank) merged.nationalRank = rMatch.ranking;
        if (rMatch.city && rMatch.state_province && !merged.hometown) merged.hometown = `${rMatch.city}, ${rMatch.state_province}`;
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
      const profileUrls = sources.filter(s => /247sports\.com|on3\.com/i.test(s));
      profileUrls.sort((a, b) => (/247sports/i.test(a) ? 0 : 1) - (/247sports/i.test(b) ? 0 : 1));
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

    const topCandidates = scoredCandidates.slice(0, 10).map(c => c.url);
    const validResults = await Promise.all(topCandidates.map(validateImageUrl));
    const verified = topCandidates.filter((_, i) => validResults[i]);

    if (verified.length > 0) imageUrls.actionPhoto = verified[0];

    return new Response(JSON.stringify({
      success: true,
      data: merged,
      imageUrls: Object.keys(imageUrls).length > 0 ? imageUrls : undefined,
      actionPhotoCandidates: verified.length > 0 ? verified.slice(0, 10) : undefined,
      sources,
      resultsCount: sources.length,
    }), { headers });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch profile";
    return new Response(JSON.stringify({ success: false, error: msg }), { status: 500, headers });
  }
});
