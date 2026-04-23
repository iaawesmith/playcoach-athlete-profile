import { supabase } from "@/integrations/supabase/client";
import type {
  TrainingNode,
  AnalysisResult,
  NodeStatus,
  PipelineAnalysisResult,
  PipelineMetricResult,
  PipelinePhaseScore,
  PipelineRunStage,
  PipelineUploadSnapshot,
  PipelineUploadStatus,
} from "@/features/athlete-lab/types";

export async function fetchNodes(): Promise<TrainingNode[]> {
  const { data, error } = await supabase
    .from("athlete_lab_nodes" as never)
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as TrainingNode[];
}

export async function fetchNode(id: string): Promise<TrainingNode> {
  const { data, error } = await supabase
    .from("athlete_lab_nodes" as never)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as unknown as TrainingNode;
}

export async function createNode(node: Partial<TrainingNode>): Promise<TrainingNode> {
  const { data, error } = await supabase
    .from("athlete_lab_nodes" as never)
    .insert(node as never)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TrainingNode;
}

export async function updateNode(id: string, updates: Partial<TrainingNode>): Promise<TrainingNode> {
  const { data, error } = await supabase
    .from("athlete_lab_nodes" as never)
    .update(updates as never)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TrainingNode;
}

export async function deleteNode(id: string): Promise<void> {
  const { error } = await supabase
    .from("athlete_lab_nodes" as never)
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function setNodeStatus(id: string, status: NodeStatus): Promise<TrainingNode> {
  const { data, error } = await supabase
    .from("athlete_lab_nodes" as never)
    .update({ status } as never)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TrainingNode;
}

export interface AnalysisContext {
  camera_angle: string;
  people_in_video: string;
  route_direction: string;
  catch_included: boolean;
  catch_status: string;
  athlete_level: string;
  focus_area: string;
  athlete_height?: AthleteMeasurement;
  athlete_wingspan?: AthleteMeasurement;
}

export type MeasurementUnit = "inches" | "cm";

export interface AthleteMeasurement {
  value: number;
  unit: MeasurementUnit;
}

export async function runAnalysis(node: TrainingNode, videoDescription: string, analysisContext?: AnalysisContext): Promise<AnalysisResult> {
  const { data, error } = await supabase.functions.invoke("athlete-lab-analyze", {
    body: { node, videoDescription, analysis_context: analysisContext },
  });

  if (error) throw error;
  return data as AnalysisResult;
}

const TEST_VIDEO_BUCKET = "athlete-videos";
const TEST_VIDEO_FOLDER = "test-clips";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 240_000;

const FIXED_TEST_ATHLETE_ID = "8F42B1C3-5D9E-4A7B-B2E1-9C3F4D5A6E7B".toLowerCase();

export interface RunAnalysisSubmissionInput {
  node: TrainingNode;
  uploadedFile?: File | null;
  externalVideoUrl?: string;
  cameraAngle: string;
  startSeconds?: number;
  endSeconds?: number;
  analysisContext: AnalysisContext & Record<string, unknown>;
}

export interface SubmittedAnalysisJob {
  uploadId: string;
  upload: PipelineUploadSnapshot;
  videoUrl: string;
  storagePath: string | null;
}

export interface PollPipelineOptions {
  onStageChange?: (stage: PipelineRunStage, upload: PipelineUploadSnapshot | null) => void;
}

function getFileExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.trim().toLowerCase();
  return ext && ext.length > 0 ? ext : "mp4";
}

function buildTestClipPath(nodeId: string, fileName: string): string {
  return `${TEST_VIDEO_FOLDER}/${nodeId}-${Date.now()}.${getFileExtension(fileName)}`;
}

function parseNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseMetricResults(value: unknown): PipelineMetricResult[] {
  if (!Array.isArray(value)) return [];

  return value.map((entry, index) => {
    const record = parseRecord(entry);
    return {
      name: typeof record.name === "string" ? record.name : `Metric ${index + 1}`,
      unit: typeof record.unit === "string" ? record.unit : "",
      value: parseNumber(record.value),
      elite_target: typeof record.elite_target === "string" ? record.elite_target : "",
      tolerance: parseNumber(record.tolerance),
      deviation: parseNumber(record.deviation),
      score: parseNumber(record.score),
      weight: parseNumber(record.weight) ?? 0,
      status: typeof record.status === "string" ? (record.status as PipelineMetricResult["status"]) : "failed",
      reason: typeof record.reason === "string" ? record.reason : undefined,
      detail: record.detail && typeof record.detail === "object" && !Array.isArray(record.detail)
        ? (record.detail as Record<string, unknown>)
        : undefined,
      phase_id: typeof record.phase_id === "string" ? record.phase_id : null,
      phase_name: typeof record.phase_name === "string" ? record.phase_name : null,
      calculation_type: typeof record.calculation_type === "string" ? record.calculation_type : null,
    };
  });
}

function mapPhaseBreakdown(phaseScores: Record<string, number>, node: TrainingNode): PipelinePhaseScore[] {
  const configured = node.phase_breakdown.map((phase) => ({
    id: phase.id ?? phase.name,
    name: phase.name,
    score: Math.round(phaseScores[phase.id ?? phase.name] ?? 0),
  }));

  const extras = Object.entries(phaseScores)
    .filter(([phaseId]) => !configured.some((phase) => phase.id === phaseId))
    .map(([phaseId, score]) => ({ id: phaseId, name: phaseId, score: Math.round(score) }));

  return [...configured, ...extras];
}

async function uploadTestClip(file: File, node: TrainingNode): Promise<{ signedUrl: string; path: string }> {
  const path = buildTestClipPath(node.id, file.name);
  const { error: uploadError } = await supabase.storage
    .from(TEST_VIDEO_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });

  if (uploadError) {
    throw new Error(`Video upload failed: ${uploadError.message}`);
  }

  const { data: signedData, error: signError } = await supabase.storage
    .from(TEST_VIDEO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signedData?.signedUrl) {
    throw new Error(`Signed URL generation failed: ${signError?.message ?? "Unknown error"}`);
  }

  return { signedUrl: signedData.signedUrl, path };
}

export async function submitRunAnalysisJob(input: RunAnalysisSubmissionInput): Promise<SubmittedAnalysisJob> {
  const { node, uploadedFile, externalVideoUrl, cameraAngle, startSeconds = 0, endSeconds, analysisContext } = input;

  let signedVideoUrl = externalVideoUrl?.trim() ?? "";
  let storagePath: string | null = null;

  if (uploadedFile) {
    const uploaded = await uploadTestClip(uploadedFile, node);
    signedVideoUrl = uploaded.signedUrl;
    storagePath = uploaded.path;
  }

  if (!signedVideoUrl) {
    throw new Error("Provide a video file or a direct video URL before running analysis.");
  }

  const payload = {
    athleteId: FIXED_TEST_ATHLETE_ID,
    nodeId: node.id,
    nodeVersion: node.node_version,
    videoUrl: signedVideoUrl,
    cameraAngle,
    startSeconds,
    endSeconds: typeof endSeconds === "number" && Number.isFinite(endSeconds) ? endSeconds : null,
    analysisContext,
  };

  const { data, error } = await supabase.functions.invoke("admin-create-athlete-upload", {
    body: payload,
  });

  if (error) {
    throw new Error(error.message || "Failed to create analysis job.");
  }

  const record = parseRecord(data);
  const uploadId = typeof record.uploadId === "string" ? record.uploadId : "";
  if (!uploadId) {
    throw new Error("Analysis job did not return an upload ID.");
  }

  const upload = await fetchUploadStatus(uploadId);
  return { uploadId, upload, videoUrl: signedVideoUrl, storagePath };
}

export async function fetchUploadStatus(uploadId: string): Promise<PipelineUploadSnapshot> {
  const { data, error } = await supabase
    .from("athlete_uploads")
    .select("id, status, error_message, created_at, video_url, node_id, node_version, camera_angle, start_seconds, end_seconds, analysis_context")
    .eq("id", uploadId)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to load upload status.");
  }

  return {
    id: data.id,
    status: (data.status ?? "pending") as PipelineUploadStatus,
    error_message: data.error_message,
    created_at: data.created_at,
    video_url: data.video_url,
    node_id: data.node_id,
    node_version: data.node_version,
    camera_angle: data.camera_angle,
    start_seconds: data.start_seconds,
    end_seconds: data.end_seconds,
    analysis_context: parseRecord(data.analysis_context),
  };
}

async function fetchPipelineResult(uploadId: string, node: TrainingNode): Promise<PipelineAnalysisResult | null> {
  const { data, error } = await supabase
    .from("athlete_lab_results")
    .select("id, upload_id, aggregate_score, phase_scores, metric_results, confidence_flags, detected_errors, feedback, analyzed_at")
    .eq("upload_id", uploadId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const fallbackQuery = async () => {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("athlete_lab_results")
      .select("id, upload_id, aggregate_score, phase_scores, metric_results, confidence_flags, detected_errors, feedback, analyzed_at")
      .eq("athlete_id", FIXED_TEST_ATHLETE_ID)
      .eq("node_id", node.id)
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallbackError) {
      throw new Error(fallbackError.message);
    }

    return fallbackData;
  };

  const row = data ?? await fallbackQuery();
  if (!row) return null;

  const phaseScores = parseRecord(row.phase_scores) as Record<string, number>;
  return {
    uploadId,
    resultId: row.id ?? null,
    uploadStatus: "complete",
    aggregateScore: row.aggregate_score,
    phaseScores,
    phaseBreakdown: mapPhaseBreakdown(phaseScores, node),
    metricResults: parseMetricResults(row.metric_results),
    confidenceFlags: Array.isArray(row.confidence_flags) ? row.confidence_flags as Array<{ metric: string; reason: string }> : [],
    detectedErrors: Array.isArray(row.detected_errors) ? row.detected_errors as Array<Record<string, unknown>> : [],
    feedback: row.feedback ?? "",
    analyzedAt: row.analyzed_at ?? null,
    errorMessage: null,
  };
}

export async function pollRunAnalysisResult(
  uploadId: string,
  node: TrainingNode,
  options: PollPipelineOptions = {},
): Promise<{ stage: PipelineRunStage; upload: PipelineUploadSnapshot; result: PipelineAnalysisResult | null }> {
  const startedAt = Date.now();
  let latestUpload = await fetchUploadStatus(uploadId);
  options.onStageChange?.(latestUpload.status === "pending" ? "queued" : "processing", latestUpload);

  while (Date.now() - startedAt <= POLL_TIMEOUT_MS) {
    if (latestUpload.status === "complete") {
      options.onStageChange?.("fetching_results", latestUpload);
      const result = await fetchPipelineResult(uploadId, node);
      return { stage: "complete", upload: latestUpload, result };
    }

    if (latestUpload.status === "failed") {
      options.onStageChange?.("failed", latestUpload);
      return { stage: "failed", upload: latestUpload, result: null };
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    latestUpload = await fetchUploadStatus(uploadId);
    options.onStageChange?.(latestUpload.status === "pending" ? "queued" : "processing", latestUpload);
  }

  const finalUpload = await fetchUploadStatus(uploadId);
  options.onStageChange?.("timed_out", finalUpload);
  return { stage: "timed_out", upload: finalUpload, result: null };
}
