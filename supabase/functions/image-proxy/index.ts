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
    const imageUrl = String(body.imageUrl || "").trim();
    const fileName = String(body.fileName || "").trim();
    const bucket = String(body.bucket || "athlete-media").trim();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "imageUrl is required" }),
        { status: 400, headers },
      );
    }

    if (!fileName) {
      return new Response(
        JSON.stringify({ success: false, error: "fileName is required" }),
        { status: 400, headers },
      );
    }

    // Download the image
    const imgResponse = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PlayCoach/1.0)",
        "Accept": "image/*",
      },
    });

    if (!imgResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to download image: ${imgResponse.status}` }),
        { status: 502, headers },
      );
    }

    const contentType = imgResponse.headers.get("content-type") || "image/jpeg";
    const imageBytes = new Uint8Array(await imgResponse.arrayBuffer());

    // Upload to Supabase Storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Storage not configured" }),
        { status: 500, headers },
      );
    }

    const storagePath = `${bucket}/${fileName}`;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${storagePath}`;

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: imageBytes,
    });

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      return new Response(
        JSON.stringify({ success: false, error: `Upload failed: ${errText}` }),
        { status: 500, headers },
      );
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${storagePath}`;

    return new Response(
      JSON.stringify({ success: true, publicUrl, contentType, size: imageBytes.length }),
      { headers },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to proxy image";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers },
    );
  }
});
