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
    const body = await req.json();
    const school = String(body.school || "").trim();

    if (!school) {
      return new Response(
        JSON.stringify({ success: false, error: "school is required" }),
        { status: 400, headers },
      );
    }

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl connector not configured" }),
        { status: 500, headers },
      );
    }

    // Strategy 1: Search for the school's athletics site and extract branding/logo
    const searchQuery = `${school} athletics official logo`;
    console.log("Searching for school logo:", searchQuery);

    const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 3,
        scrapeOptions: { formats: ["links"] },
      }),
    });

    const searchData = await searchRes.json();

    if (searchRes.ok && searchData.data?.length) {
      // Try to scrape the top result for branding
      const topUrl = searchData.data[0].url;
      console.log("Scraping top result for branding:", topUrl);

      const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: topUrl,
          formats: ["branding"],
        }),
      });

      const scrapeData = await scrapeRes.json();

      if (scrapeRes.ok) {
        const branding = scrapeData.data?.branding || scrapeData.branding;
        const logoUrl =
          branding?.images?.logo ||
          branding?.logo ||
          branding?.images?.favicon;

        if (logoUrl && logoUrl.startsWith("http")) {
          console.log("Found logo via branding:", logoUrl);
          return new Response(
            JSON.stringify({ success: true, logoUrl }),
            { headers },
          );
        }
      }
    }

    // Strategy 2: Direct image search fallback
    const fallbackQuery = `${school} logo png transparent`;
    console.log("Fallback search:", fallbackQuery);

    const fallbackRes = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: fallbackQuery,
        limit: 5,
        scrapeOptions: { formats: ["links"] },
      }),
    });

    const fallbackData = await fallbackRes.json();

    if (fallbackRes.ok && fallbackData.data?.length) {
      // Try scraping each result for branding
      for (const result of fallbackData.data.slice(0, 2)) {
        try {
          const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: result.url,
              formats: ["branding"],
            }),
          });

          const data = await res.json();
          if (res.ok) {
            const branding = data.data?.branding || data.branding;
            const logoUrl =
              branding?.images?.logo ||
              branding?.logo ||
              branding?.images?.favicon;

            if (logoUrl && logoUrl.startsWith("http")) {
              console.log("Found logo via fallback:", logoUrl);
              return new Response(
                JSON.stringify({ success: true, logoUrl }),
                { headers },
              );
            }
          }
        } catch {
          // continue to next result
        }
      }
    }

    console.log("No logo found for:", school);
    return new Response(
      JSON.stringify({ success: false, error: "No logo found" }),
      { headers },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch school logo";
    console.error("Error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers },
    );
  }
});
