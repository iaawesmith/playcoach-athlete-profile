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

    // --- Image extraction: three isolated pipelines ---
    const imageUrls: Record<string, string> = {};
    let candidateUrls: string[] = [];

    const posLabel = knownFields.position || merged.position || "";
    const jerseyNum = knownFields.number || merged.number || "";

    const authHdrs = {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
    };

    // ===== PIPELINE 1: Roster Headshot → Profile Photo =====
    try {
      // Find the athlete's individual roster page from sources
      const rosterUrl = sources.find((s) =>
        /roster\/.*\d+$/i.test(s) || /player\//i.test(s)
      );

      if (rosterUrl) {
        const rosterScrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: authHdrs,
          body: JSON.stringify({
            url: rosterUrl,
            formats: ["html"],
            onlyMainContent: true,
          }),
        });

        if (rosterScrapeResp.ok) {
          const rosterData = await rosterScrapeResp.json();
          const html = String(rosterData.data?.html || rosterData.html || "");

          // Extract large images from the individual roster page
          const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*/gi;
          let match;
          const rosterImages: string[] = [];
          while ((match = imgRegex.exec(html)) !== null) {
            const src = match[1];
            // Skip tiny utility images
            if (/logo|icon|sprite|badge|arrow|button|tracking|pixel|\.svg|\.gif|spacer|transparent/i.test(src)) continue;
            if (src.length < 30) continue;
            // Skip explicitly tiny images
            if (/[?&](?:width|w|height|h)=(?:[1-5]?\d|60)(?:&|$)/i.test(src)) continue;
            rosterImages.push(src);
          }

          // The first large image on an individual player roster page is the headshot
          if (rosterImages.length > 0) {
            // Prefer images with the athlete's name in the URL
            const nameTokens = name.toLowerCase().split(/\s+/);
            const namedImg = rosterImages.find((u) => {
              const uLower = decodeURIComponent(u).toLowerCase();
              return nameTokens.some((t) => uLower.includes(t));
            });
            imageUrls.headshot = namedImg || rosterImages[0];
          }
        }
      }
    } catch (_headshotErr) {
      // Non-critical
    }

    // Utility: skip tiny/thumbnail images (Cloudinary w_XX, query param width, etc.)
    const isTinyImage = (src: string): boolean => {
      // Cloudinary-style: /w_16/ or ,w_16,
      if (/[/,]w_([1-9]\d?)[/,]/i.test(src)) return true;
      // Query param width/height <= 60
      if (/[?&](?:width|w|height|h)=(?:[1-5]?\d|60)(?:&|$)/i.test(src)) return true;
      return false;
    };

    // ===== PIPELINE 2: Action Photos via Search + Scrape =====
    try {
      const jerseyTag = jerseyNum ? ` #${jerseyNum}` : "";
      const photoQuery = `${name}${jerseyTag} ${posLabel} ${school} football game action photo image`.trim();

      // Step 1: Firecrawl search for image-heavy pages — request both markdown and html
      const photoSearchResp = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: authHdrs,
        body: JSON.stringify({
          query: photoQuery,
          limit: 5,
          scrapeOptions: { formats: ["markdown", "html"] },
        }),
      });

      if (photoSearchResp.ok) {
        const photoSearchData = await photoSearchResp.json();
        const photoResults = photoSearchData.data || [];

        // Extract image URLs from search result markdown
        for (const r of photoResults) {
          const md = r.markdown || r.data?.markdown || "";
          const imgMatches = md.matchAll(/!\[[^\]]*\]\(([^)]+)\)/gi);
          for (const im of imgMatches) {
            const src = im[1];
            if (!src.startsWith("http")) continue;
            if (/logo|icon|sprite|badge|button|pixel|\.svg|\.gif|spacer|avatar|favicon/i.test(src)) continue;
            if (src.length < 30 || isTinyImage(src)) continue;
            if (!candidateUrls.includes(src)) candidateUrls.push(src);
          }

          // Also extract from HTML returned by search
          const html = r.html || r.data?.html || "";
          if (html) {
            const imgRegex = /<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*/gi;
            let m;
            while ((m = imgRegex.exec(html)) !== null) {
              const src = m[1];
              if (/logo|icon|sprite|badge|button|pixel|\.svg|\.gif|spacer|avatar|favicon|tracking|advertisement/i.test(src)) continue;
              if (src.length < 30 || isTinyImage(src)) continue;
              if (!candidateUrls.includes(src)) candidateUrls.push(src);
            }
            // data-src
            const dataSrcRegex = /data-src=["'](https?:\/\/[^"']+)["']/gi;
            while ((m = dataSrcRegex.exec(html)) !== null) {
              const src = m[1];
              if (/logo|icon|sprite|badge|button|pixel|\.svg|\.gif|spacer|avatar|favicon/i.test(src)) continue;
              if (src.length < 30) continue;
              if (!candidateUrls.includes(src)) candidateUrls.push(src);
            }
          }
        }

        // Step 2: If not enough candidates, scrape top 3 URLs for full HTML
        if (candidateUrls.length < 5) {
          const urlsToScrape = photoResults
            .filter((r: Record<string, unknown>) => r.url)
            .map((r: Record<string, unknown>) => String(r.url))
            .slice(0, 3);

          const scrapePromises = urlsToScrape.map(async (pageUrl: string) => {
            try {
              const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
                method: "POST",
                headers: authHdrs,
                body: JSON.stringify({
                  url: pageUrl,
                  formats: ["html"],
                  onlyMainContent: false,
                }),
              });
              if (!resp.ok) return [];
              const data = await resp.json();
              const html = String(data.data?.html || data.html || "");

              const extracted: string[] = [];
              const imgRegex = /<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*/gi;
              let m;
              while ((m = imgRegex.exec(html)) !== null) {
                const src = m[1];
                if (/logo|icon|sprite|badge|button|pixel|\.svg|\.gif|spacer|avatar|favicon|tracking|advertisement/i.test(src)) continue;
                if (src.length < 30) continue;
                if (/[?&](?:width|w|height|h)=(?:[1-5]?\d|60)(?:&|$)/i.test(src)) continue;
                extracted.push(src);
              }

              const dataSrcRegex = /data-src=["'](https?:\/\/[^"']+)["']/gi;
              while ((m = dataSrcRegex.exec(html)) !== null) {
                const src = m[1];
                if (/logo|icon|sprite|badge|button|pixel|\.svg|\.gif|spacer|avatar|favicon/i.test(src)) continue;
                if (src.length < 30) continue;
                extracted.push(src);
              }

              return extracted;
            } catch {
              return [];
            }
          });

          const scrapeResults = await Promise.all(scrapePromises);
          for (const imgs of scrapeResults) {
            for (const src of imgs) {
              if (!candidateUrls.includes(src)) candidateUrls.push(src);
            }
          }
        }
      }

      // Pre-sort candidates: URLs containing athlete's name go first
      const nameTokens = name.toLowerCase().split(/\s+/);
      candidateUrls.sort((a, b) => {
        const aLower = decodeURIComponent(a).toLowerCase();
        const bLower = decodeURIComponent(b).toLowerCase();
        const aMatch = nameTokens.some((t) => aLower.includes(t));
        const bMatch = nameTokens.some((t) => bLower.includes(t));
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return 0;
      });

      // Vision-based AI filtering
      if (candidateUrls.length > 0) {
        const lovableKey = Deno.env.get("LOVABLE_API_KEY");
        if (lovableKey) {
          const imagesToCheck = candidateUrls.slice(0, 15);
          const contentParts: Array<Record<string, unknown>> = [
            {
              type: "text",
              text: `You are verifying action photos for a football player profile card.

Player: ${name}
Position: ${posLabel || "unknown"}
School: ${school || "unknown"}
Jersey: ${jerseyNum || "unknown"}

I'm showing you ${imagesToCheck.length} candidate images. For EACH image, determine:
1. Does it show a football player in game action or a football-related photo? (not a car, landscape, logo, headshot, crowd, or unrelated image)
2. Could this plausibly be ${name} based on jersey number, school uniform colors, or context?

Return a JSON array of ONLY the URLs that pass BOTH checks, ranked by quality for a portrait card (prefer dynamic action shots over static poses). Example: ["url1", "url2"]
If none pass, return: []`,
            },
          ];

          for (const url of imagesToCheck) {
            contentParts.push({
              type: "image_url",
              image_url: { url },
            });
          }

          try {
            const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": "Bearer " + lovableKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [{
                  role: "user",
                  content: contentParts,
                }],
              }),
            });

            if (aiResp.ok) {
              const aiData = await aiResp.json();
              const raw = ((aiData.choices?.[0]?.message?.content as string) || "").trim();
              const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
              try {
                const filtered = JSON.parse(jsonStr);
                if (Array.isArray(filtered) && filtered.length > 0) {
                  candidateUrls = filtered.filter((u: unknown) => typeof u === "string" && String(u).startsWith("http"));
                  if (candidateUrls.length > 0) {
                    imageUrls.actionPhoto = candidateUrls[0];
                  }
                }
              } catch (_parseErr) {
                if (raw.startsWith("http")) {
                  imageUrls.actionPhoto = raw;
                }
              }
            }
          } catch (_aiErr) {
            // Non-critical
          }
        }

        // Fallback: if vision didn't pick, use first large jpg/webp candidate
        if (!imageUrls.actionPhoto) {
          const fallback = candidateUrls.find((u) => /\.(jpg|jpeg|webp|png)/i.test(u));
          if (fallback) imageUrls.actionPhoto = fallback;
        }
      }
    } catch (_actionErr) {
      // Non-critical — continue without action photos
    }

    // 2. School logo via ESPN CDN static lookup
    if (school) {
      try {
        const { lookupSchoolLogo } = await import("../_shared/espnLogos.ts");
        const espnLogo = lookupSchoolLogo(school);
        if (espnLogo) {
          imageUrls.schoolLogo = espnLogo;
        } else if (apiKey) {
          // Fallback: Firecrawl branding search for non-NCAA schools
          const authHdrs = {
            "Authorization": "Bearer " + apiKey,
            "Content-Type": "application/json",
          };
          const logoSearchRes = await fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: authHdrs,
            body: JSON.stringify({
              query: `${school} athletics official logo`,
              limit: 3,
              scrapeOptions: { formats: ["links"] },
            }),
          });
          if (logoSearchRes.ok) {
            const logoSearchData = await logoSearchRes.json();
            if (logoSearchData.data?.length) {
              const topUrl = logoSearchData.data[0].url;
              const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
                method: "POST",
                headers: authHdrs,
                body: JSON.stringify({ url: topUrl, formats: ["branding"] }),
              });
              if (scrapeRes.ok) {
                const scrapeData = await scrapeRes.json();
                const branding = scrapeData.data?.branding || scrapeData.branding;
                const logoUrl = branding?.images?.logo || branding?.logo || branding?.images?.favicon;
                if (logoUrl && String(logoUrl).startsWith("http")) {
                  imageUrls.schoolLogo = String(logoUrl);
                }
              }
            }
          }
        }
      } catch (_logoErr) {
        // Non-critical
      }
    }

    // Validate candidate URLs are actual renderable images via HEAD requests
    const validateImageUrl = async (url: string): Promise<boolean> => {
      try {
        // Some CDN crop URLs don't support HEAD — try GET with range header
        const resp = await fetch(url, {
          method: "GET",
          headers: { "User-Agent": "Mozilla/5.0", "Range": "bytes=0-0" },
          redirect: "follow",
        });
        if (!resp.ok && resp.status !== 206) return false;
        const ct = resp.headers.get("content-type") || "";
        // Accept image types and also octet-stream from CDNs
        return ct.startsWith("image/") || ct.includes("octet-stream");
      } catch {
        return false;
      }
    };

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

    // Validate top candidates in parallel (check up to 10)
    const toValidate = actionPhotoCandidates.slice(0, 10);
    const validationResults = await Promise.all(toValidate.map(validateImageUrl));
    const verifiedCandidates = toValidate.filter((_, i) => validationResults[i]);

    // Update actionPhoto to first verified candidate
    if (verifiedCandidates.length > 0) {
      imageUrls.actionPhoto = verifiedCandidates[0];
    } else if (actionPhotoCandidates.length > 0) {
      // None verified — clear to avoid black boxes
      delete imageUrls.actionPhoto;
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: merged,
        imageUrls: Object.keys(imageUrls).length > 0 ? imageUrls : undefined,
        actionPhotoCandidates: verifiedCandidates.length > 0 ? verifiedCandidates.slice(0, 10) : undefined,
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
