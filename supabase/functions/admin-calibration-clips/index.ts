import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "athlete-videos";
const PREFIX = "calibration-library/";
const MAX_BYTES = 500 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 6;

const nullableNumber = z.number().finite().nullable().optional();

const MetadataSchema = z.object({
  title: z.string().trim().min(1).max(200),
  node_id: z.string().uuid().nullable(),
  duration_seconds: nullableNumber,
  resolution: z.string().max(40).nullable().optional(),
  fps: nullableNumber,
  file_size_bytes: z.number().int().min(0).max(MAX_BYTES).nullable().optional(),
  created_by: z.string().max(120).nullable().optional(),
  camera_angle: z.enum(["sideline", "behind_qb", "endzone", "other"]),
  people_in_video: z.enum(["solo", "with_defender", "multiple"]),
  route_direction: z.enum(["left", "right", "both", "straight"]),
  catch_status: z.enum(["yes", "no", "partial"]),
  athlete_level: z.enum(["youth", "high_school", "college", "professional"]),
  athlete_height: nullableNumber,
  athlete_height_unit: z.enum(["inches", "cm"]),
  athlete_wingspan: nullableNumber,
  athlete_wingspan_unit: z.enum(["inches", "cm"]),
  yard_lines_visible: z.boolean(),
  yard_line_notes: z.string().max(2000),
  start_yard_line: nullableNumber,
  break_yard_line: nullableNumber,
  expected_calibration_source: z.enum(["dynamic", "body_based", "static", "unknown"]),
  hand_timed_splits: z.string().max(2000),
  camera_setup: z.enum(["tripod", "handheld"]),
  camera_distance_notes: z.string().max(2000),
  depth_metric_key: z.string().max(200).nullable().optional(),
  notes: z.string().max(5000),
});

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list"), includeArchived: z.boolean().default(false) }),
  z.object({
    action: z.literal("issue_upload"),
    fileName: z.string().min(1).max(200),
    fileSize: z.number().int().positive(),
    contentType: z.string().min(1).max(100),
  }),
  z.object({ action: z.literal("create"), storage_path: z.string().min(1).max(400), metadata: MetadataSchema }),
  z.object({ action: z.literal("update"), id: z.string().uuid(), metadata: MetadataSchema }),
  z.object({ action: z.literal("sign"), id: z.string().uuid(), purpose: z.enum(["preview", "test"]) }),
  z.object({ action: z.literal("sign_upload"), upload_id: z.string().uuid() }),
  z.object({ action: z.literal("set_archived"), id: z.string().uuid(), archived: z.boolean() }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server misconfigured" }, 500);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "Expected JSON body" }, 400);
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const body = parsed.data;

  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    switch (body.action) {
      case "list": {
        let query = db
          .from("calibration_clips")
          .select("*, athlete_lab_nodes(name, position, status, key_metrics)")
          .order("created_at", { ascending: false });
        if (!body.includeArchived) query = query.eq("archived", false);
        const { data, error } = await query;
        if (error) return json({ error: error.message }, 500);
        const clips = await Promise.all((data ?? []).map(async (clip) => ({ ...clip, run_count: await countRuns(db, clip.id) })));
        return json({ clips }, 200);
      }

      case "issue_upload": {
        if (body.fileSize > MAX_BYTES) {
          return json({ error: `File is ${(body.fileSize / 1024 / 1024).toFixed(1)} MB — library limit is 500 MB.` }, 413);
        }
        if (!body.contentType.startsWith("video/")) {
          return json({ error: `Invalid content type: ${body.contentType}. Must be a video.` }, 400);
        }
        const safeName = body.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
        const path = `${PREFIX}${crypto.randomUUID()}/${safeName}`;
        const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
        if (error || !data) return json({ error: `Could not issue upload link: ${error?.message ?? "unknown"}` }, 500);
        return json({ path: data.path, token: data.token, bucket: BUCKET }, 200);
      }

      case "create": {
        if (!body.storage_path.startsWith(PREFIX) || body.storage_path.includes("..")) {
          return json({ error: "Invalid storage path" }, 400);
        }
        const { data, error } = await db
          .from("calibration_clips")
          .insert({ ...body.metadata, storage_path: body.storage_path })
          .select("id")
          .single();
        if (error) return json({ error: error.message }, 500);
        return json({ id: data.id }, 200);
      }

      case "update": {
        const { error } = await db.from("calibration_clips").update(body.metadata).eq("id", body.id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true }, 200);
      }

      case "sign": {
        const { data: clip, error } = await db.from("calibration_clips").select("storage_path, archived").eq("id", body.id).single();
        if (error || !clip) return json({ error: "Clip not found" }, 404);
        if (body.purpose === "test" && clip.archived) {
          return json({ error: "Archived clips can't be used in new tests." }, 409);
        }
        const { data: signed, error: signError } = await db.storage.from(BUCKET).createSignedUrl(clip.storage_path, SIGNED_URL_TTL_SECONDS);
        if (signError || !signed) return json({ error: `Signed link failed: ${signError?.message ?? "unknown"}` }, 500);
        return json({ signedUrl: signed.signedUrl }, 200);
      }

      case "sign_upload": {
        // Fresh read-only link for an existing upload's video (overlay player link refresh).
        const { data: upload, error } = await db.from("athlete_uploads").select("video_url").eq("id", body.upload_id).single();
        if (error || !upload?.video_url) return json({ error: "Upload not found" }, 404);
        const match = /\/object\/(?:sign|public|authenticated)\/athlete-videos\/([^?]+)/.exec(upload.video_url);
        if (!match) return json({ error: "Upload video is not in storage" }, 400);
        const { data: signed, error: signError } = await db.storage.from(BUCKET).createSignedUrl(decodeURIComponent(match[1]), SIGNED_URL_TTL_SECONDS);
        if (signError || !signed) return json({ error: `Signed link failed: ${signError?.message ?? "unknown"}` }, 500);
        return json({ signedUrl: signed.signedUrl }, 200);
      }

      case "set_archived": {
        const { error } = await db.from("calibration_clips").update({ archived: body.archived }).eq("id", body.id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true }, 200);
      }

      case "delete": {
        const runCount = await countRuns(db, body.id);
        if (runCount > 0) {
          return json({ error: "This clip has test runs and can't be deleted. Archive it instead.", runCount, blocked: true }, 409);
        }
        const { data: clip, error } = await db.from("calibration_clips").select("storage_path").eq("id", body.id).single();
        if (error || !clip) return json({ error: "Clip not found" }, 404);
        const { error: removeError } = await db.storage.from(BUCKET).remove([clip.storage_path]);
        if (removeError) return json({ error: `File removal failed: ${removeError.message}` }, 500);
        const { error: deleteError } = await db.from("calibration_clips").delete().eq("id", body.id);
        if (deleteError) return json({ error: deleteError.message }, 500);
        return json({ ok: true }, 200);
      }
    }
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

async function countRuns(db: ReturnType<typeof createClient>, clipId: string): Promise<number> {
  const { count, error } = await db
    .from("athlete_uploads")
    .select("id", { count: "exact", head: true })
    .filter("analysis_context->>calibration_clip_id", "eq", clipId);
  if (error) throw new Error(`Run lookup failed: ${error.message}`);
  return count ?? 0;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
