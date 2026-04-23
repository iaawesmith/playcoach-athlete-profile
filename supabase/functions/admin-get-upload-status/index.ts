import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIXED_TEST_ATHLETE_ID = "8f42b1c3-5d9e-4a7b-b2e1-9c3f4d5a6e7b";

const BodySchema = z.object({
  uploadId: z.string().uuid(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Expected JSON body" }, 400);
  }

  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return jsonResponse({ error: parsed.error.flatten().fieldErrors }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("athlete_uploads")
    .select("id, athlete_id, status, error_message, created_at, video_url, node_id, node_version, camera_angle, start_seconds, end_seconds, analysis_context")
    .eq("id", parsed.data.uploadId)
    .maybeSingle();

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  if (!data) {
    return jsonResponse({ upload: null });
  }

  if (data.athlete_id?.toLowerCase() !== FIXED_TEST_ATHLETE_ID) {
    return jsonResponse({ error: "Upload does not belong to the admin test athlete" }, 403);
  }

  return jsonResponse({
    upload: {
      id: data.id,
      status: data.status,
      error_message: data.error_message,
      created_at: data.created_at,
      video_url: data.video_url,
      node_id: data.node_id,
      node_version: data.node_version,
      camera_angle: data.camera_angle,
      start_seconds: data.start_seconds,
      end_seconds: data.end_seconds,
      analysis_context: data.analysis_context,
    },
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}