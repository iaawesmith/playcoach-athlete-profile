import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIXED_TEST_ATHLETE_ID = "8f42b1c3-5d9e-4a7b-b2e1-9c3f4d5a6e7b";

const BodySchema = z.object({
  uploadId: z.string().uuid(),
  nodeId: z.string().uuid(),
  athleteId: z.string().uuid().transform((value) => value.toLowerCase()).default(FIXED_TEST_ATHLETE_ID),
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

  const { uploadId, nodeId, athleteId } = parsed.data;
  if (athleteId !== FIXED_TEST_ATHLETE_ID) {
    return jsonResponse({ error: "Invalid athlete for admin test result lookup" }, 403);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const selectClause = "id, upload_id, athlete_id, node_id, aggregate_score, phase_scores, metric_results, confidence_flags, detected_errors, feedback, analyzed_at";

  const { data: directData, error: directError } = await supabase
    .from("athlete_lab_results")
    .select(selectClause)
    .eq("upload_id", uploadId)
    .maybeSingle();

  if (directError) {
    return jsonResponse({ error: directError.message }, 500);
  }

  const row = directData ?? await fetchFallbackResult(supabase, selectClause, athleteId, nodeId);
  if (!row) {
    return jsonResponse({ result: null });
  }

  if (row.athlete_id?.toLowerCase() !== FIXED_TEST_ATHLETE_ID) {
    return jsonResponse({ error: "Result does not belong to the admin test athlete" }, 403);
  }

  return jsonResponse({
    result: {
      id: row.id,
      upload_id: row.upload_id,
      aggregate_score: row.aggregate_score,
      phase_scores: row.phase_scores,
      metric_results: row.metric_results,
      confidence_flags: row.confidence_flags,
      detected_errors: row.detected_errors,
      feedback: row.feedback,
      analyzed_at: row.analyzed_at,
    },
  });
});

async function fetchFallbackResult(
  supabase: ReturnType<typeof createClient>,
  selectClause: string,
  athleteId: string,
  nodeId: string,
) {
  const { data, error } = await supabase
    .from("athlete_lab_results")
    .select(selectClause)
    .eq("athlete_id", athleteId)
    .eq("node_id", nodeId)
    .order("analyzed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}