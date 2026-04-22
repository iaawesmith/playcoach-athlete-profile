import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "athlete-videos";
const MAX_BYTES = 200 * 1024 * 1024; // 200MB
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24; // 24h

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Server misconfigured: missing Supabase env" }, 500);
    }

    const form = await req.formData().catch(() => null);
    if (!form) {
      return json({ error: "Expected multipart/form-data body" }, 400);
    }

    const file = form.get("file");
    const rawPath = (form.get("path") as string | null)?.trim() ||
      "test-clips/slant-route-reference-v1.mp4";

    if (!(file instanceof File)) {
      return json({ error: "Missing 'file' field" }, 400);
    }

    if (file.size === 0) {
      return json({ error: "File is empty" }, 400);
    }

    if (file.size > MAX_BYTES) {
      return json(
        { error: `File too large (${file.size} bytes). Max ${MAX_BYTES} bytes.` },
        413,
      );
    }

    const contentType = file.type || "application/octet-stream";
    if (!contentType.startsWith("video/")) {
      return json({ error: `Invalid content type: ${contentType}. Must be video/*.` }, 400);
    }

    if (rawPath.includes("..") || rawPath.startsWith("/")) {
      return json({ error: "Invalid path" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(rawPath, bytes, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      return json({ error: `Upload failed: ${uploadError.message}` }, 500);
    }

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(rawPath, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed?.signedUrl) {
      return json(
        { error: `Signed URL failed: ${signError?.message ?? "unknown"}` },
        500,
      );
    }

    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();

    return json({
      path: rawPath,
      signedUrl: signed.signedUrl,
      expiresAt,
      bucket: BUCKET,
      sizeBytes: file.size,
    }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
