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

    // Firecrawl branding search — fallback for non-CFBD schools
    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl not configured" }),
        { status: 500, headers },
      );
    }

    const authHeaders = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    const searchQuery = `${school} athletics official logo`;
    const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        query: searchQuery,
        limit: 3,
        scrapeOptions: { formats: ["links"] },
      }),
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.data?.length) {
        const topUrl = searchData.data[0].url;
        const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ url: topUrl, formats: ["branding"] }),
        });

        if (scrapeRes.ok) {
          const scrapeData = await scrapeRes.json();
          const branding = scrapeData.data?.branding || scrapeData.branding;
          const logoUrl =
            branding?.images?.logo ||
            branding?.logo ||
            branding?.images?.favicon;

          if (logoUrl && String(logoUrl).startsWith("http")) {
            return new Response(
              JSON.stringify({ success: true, logoUrl }),
              { headers },
            );
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: "No logo found" }),
      { headers },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch school logo";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers },
    );
  }
});
