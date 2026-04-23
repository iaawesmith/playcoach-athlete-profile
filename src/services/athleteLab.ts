import { supabase } from "@/integrations/supabase/client";
import type {
  TrainingNode,
  AnalysisResult,
  AdminHistoryCalibrationFilter,
  AdminHistoryCalibrationSummary,
  AdminHistoryDateRange,
  AdminHistoryRecord,
  AdminHistorySortOption,
  AdminHistoryStatusFilter,
  NodeStatus,
  PipelineAnalysisResult,
  PipelineConfidenceFlag,
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
  route_direction?: string;
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

const TEST_VIDEO_FOLDER = "test-clips";
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 240_000;

const FIXED_TEST_ATHLETE_ID = "8F42B1C3-5D9E-4A7B-B2E1-9C3F4D5A6E7B".toLowerCase();

export const ADMIN_TEST_ATHLETE_ID = FIXED_TEST_ATHLETE_ID;

const ADMIN_HISTORY_LIMIT = 25;

type UploadHistoryRow = {
  id: string;
  node_id: string | null;
  node_version: number | null;
  video_url: string | null;
  analysis_context: unknown;
  created_at: string | null;
  status: string | null;
  error_message: string | null;
  athlete_lab_nodes?: { name: string | null } | null;
};

type ResultHistoryRow = {
  id: string;
  upload_id: string | null;
  node_id: string;
  athlete_id: string | null;
  aggregate_score: number | null;
  phase_scores: unknown;
  metric_results: unknown;
  confidence_flags: unknown;
  detected_errors: unknown;
  feedback: string | null;
  analyzed_at: string | null;
};

export interface FetchAdminHistoryOptions {
  limit?: number;
}

export interface AdminHistoryFilters {
  nodeId: string;
  dateRange: AdminHistoryDateRange;
  calibrationSource: AdminHistoryCalibrationFilter;
  status: AdminHistoryStatusFilter;
  sort: AdminHistorySortOption;
}

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
  const formData = new FormData();
  formData.append("file", file);
  formData.append("path", path);

  const { data, error } = await supabase.functions.invoke("admin-test-upload", {
    body: formData,
  });

  if (error) {
    throw new Error(`Video upload failed: ${error.message}`);
  }

  const record = parseRecord(data);
  const signedUrl = typeof record.signedUrl === "string" ? record.signedUrl : "";
  const uploadedPath = typeof record.path === "string" ? record.path : path;

  if (!signedUrl) {
    const uploadError = typeof record.error === "string"
      ? record.error
      : "Unexpected response from upload helper.";
    throw new Error(`Video upload failed: ${uploadError}`);
  }

  return { signedUrl, path: uploadedPath };
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

  const phaseScores = Object.entries(parseRecord(row.phase_scores)).reduce<Record<string, number>>((acc, [key, value]) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      acc[key] = value;
    }
    return acc;
  }, {});
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

function parseConfidenceFlags(value: unknown): PipelineConfidenceFlag[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    const record = parseRecord(entry);
    const metric = typeof record.metric === "string" ? record.metric : "Unknown metric";
    const reason = typeof record.reason === "string" ? record.reason : "No reason provided";
    return [{ metric, reason, ...record }];
  });
}

function parseDetectedErrors(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => parseRecord(entry));
}

function parsePhaseScores(value: unknown): Record<string, number> {
  return Object.entries(parseRecord(value)).reduce<Record<string, number>>((acc, [key, raw]) => {
    if (typeof raw === "number" && Number.isFinite(raw)) acc[key] = raw;
    return acc;
  }, {});
}

function formatMeasurement(value: unknown): string | null {
  const record = parseRecord(value);
  const numeric = parseNumber(record.value);
  const unit = typeof record.unit === "string" ? record.unit : "";
  if (numeric === null) return null;
  return `${numeric}${unit ? ` ${unit}` : ""}`;
}

function formatContextField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractVideoIdentifier(videoUrl: string | null, uploadId: string): string {
  if (!videoUrl) return uploadId;

  try {
    const parsed = new URL(videoUrl);
    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
    if (lastSegment) return decodeURIComponent(lastSegment);
  } catch {
    const fallbackSegment = videoUrl.split("/").filter(Boolean).pop();
    if (fallbackSegment && !fallbackSegment.includes(":")) return decodeURIComponent(fallbackSegment);
  }

  if (videoUrl.length > 20) {
    return `…${videoUrl.slice(-20)}`;
  }

  return videoUrl || uploadId;
}

function normalizeCalibrationSource(value: unknown): Exclude<AdminHistoryCalibrationFilter, "all"> {
  if (typeof value !== "string") return "none";
  const normalized = value.trim().toLowerCase().replace(/[-\s]+/g, "_");
  if (normalized === "dynamic" || normalized === "body_based" || normalized === "static") {
    return normalized;
  }
  return "none";
}

function getCalibrationSummary(metricResults: PipelineMetricResult[]): AdminHistoryCalibrationSummary | null {
  for (const metric of metricResults) {
    const detail = parseRecord(metric.detail);
    const source = detail.calibrationSource ?? detail.calibration_source;
    const confidence = detail.calibrationConfidence ?? detail.calibration_confidence;
    const pixelsPerYard = parseNumber(detail.pixelsPerYard ?? detail.pixels_per_yard);
    const rawPixelValue = parseNumber(detail.rawPixelValue ?? detail.raw_pixel_value ?? detail.pixelValue ?? detail.pixel_value);
    const details = parseRecord(detail.calibrationDetails ?? detail.calibration_details);

    if (typeof source === "string" || confidence !== undefined || pixelsPerYard !== null || Object.keys(details).length > 0) {
      return {
        source: typeof source === "string" ? source : null,
        normalizedSource: normalizeCalibrationSource(source),
        confidence: typeof confidence === "number" || typeof confidence === "string" ? confidence : null,
        pixelsPerYard,
        rawPixelValue,
        details: Object.keys(details).length > 0 ? details : Object.keys(detail).length > 0 ? detail : null,
      };
    }
  }

  return null;
}

function normalizeHistoryRow(upload: UploadHistoryRow, result: ResultHistoryRow | null): AdminHistoryRecord {
  const metricResults = parseMetricResults(result?.metric_results);
  const phaseScores = parsePhaseScores(result?.phase_scores);
  const context = parseRecord(upload.analysis_context);
  const nodeName = upload.athlete_lab_nodes?.name?.trim() || "Unknown node";

  return {
    uploadId: upload.id,
    resultId: result?.id ?? null,
    nodeId: upload.node_id,
    nodeName,
    nodeVersion: upload.node_version,
    status: (upload.status ?? "pending") as PipelineUploadStatus,
    errorMessage: upload.error_message,
    uploadCreatedAt: upload.created_at,
    analyzedAt: result?.analyzed_at ?? null,
    videoUrl: upload.video_url,
    videoIdentifier: extractVideoIdentifier(upload.video_url, upload.id),
    aggregateScore: result?.aggregate_score ?? null,
    phaseScores,
    phaseBreakdown: Object.entries(phaseScores).map(([id, score]) => ({ id, name: id, score: Math.round(score) })),
    metricResults,
    confidenceFlags: parseConfidenceFlags(result?.confidence_flags),
    detectedErrors: parseDetectedErrors(result?.detected_errors),
    feedback: result?.feedback ?? "",
    calibration: getCalibrationSummary(metricResults),
    analysisContext: {
      athleteHeightText: formatMeasurement(context.athlete_height),
      athleteWingspanText: formatMeasurement(context.athlete_wingspan),
      cameraAngle: formatContextField(context.camera_angle) ?? formatContextField(upload.analysis_context && parseRecord(upload.analysis_context).camera_angle),
      routeDirection: formatContextField(context.route_direction),
      raw: context,
    },
  };
}

function diffMillis(a: string | null, b: string | null): number {
  const aMs = a ? new Date(a).getTime() : Number.NaN;
  const bMs = b ? new Date(b).getTime() : Number.NaN;
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) return Number.POSITIVE_INFINITY;
  return Math.abs(aMs - bMs);
}

function resolveFallbackResult(upload: UploadHistoryRow, results: ResultHistoryRow[]): ResultHistoryRow | null {
  if (!upload.node_id) return null;

  const candidates = results.filter((result) => result.node_id === upload.node_id && result.athlete_id === FIXED_TEST_ATHLETE_ID);
  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => diffMillis(a.analyzed_at, upload.created_at) - diffMillis(b.analyzed_at, upload.created_at))[0] ?? null;
}

export async function fetchAdminTestHistory(options: FetchAdminHistoryOptions = {}): Promise<AdminHistoryRecord[]> {
  const limit = options.limit ?? ADMIN_HISTORY_LIMIT;
  const { data: uploads, error: uploadError } = await supabase
    .from("athlete_uploads")
    .select("id, node_id, node_version, video_url, analysis_context, created_at, status, error_message, athlete_lab_nodes(name)")
    .eq("athlete_id", FIXED_TEST_ATHLETE_ID)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (uploadError) throw uploadError;

  const typedUploads = (uploads ?? []) as unknown as UploadHistoryRow[];
  if (typedUploads.length === 0) return [];

  const uploadIds = typedUploads.map((upload) => upload.id);
  const nodeIds = Array.from(new Set(typedUploads.map((upload) => upload.node_id).filter((value): value is string => Boolean(value))));

  const { data: linkedResults, error: linkedError } = await supabase
    .from("athlete_lab_results")
    .select("id, upload_id, node_id, athlete_id, aggregate_score, phase_scores, metric_results, confidence_flags, detected_errors, feedback, analyzed_at")
    .in("upload_id", uploadIds);

  if (linkedError) throw linkedError;

  const { data: fallbackResults, error: fallbackError } = await supabase
    .from("athlete_lab_results")
    .select("id, upload_id, node_id, athlete_id, aggregate_score, phase_scores, metric_results, confidence_flags, detected_errors, feedback, analyzed_at")
    .eq("athlete_id", FIXED_TEST_ATHLETE_ID)
    .in("node_id", nodeIds)
    .order("analyzed_at", { ascending: false })
    .limit(limit * 3);

  if (fallbackError) throw fallbackError;

  const linkedByUpload = new Map<string, ResultHistoryRow>();
  ((linkedResults ?? []) as unknown as ResultHistoryRow[]).forEach((row) => {
    if (row.upload_id) linkedByUpload.set(row.upload_id, row);
  });

  const fallbackPool = (fallbackResults ?? []) as unknown as ResultHistoryRow[];
  return typedUploads.map((upload) => normalizeHistoryRow(upload, linkedByUpload.get(upload.id) ?? resolveFallbackResult(upload, fallbackPool)));
}

export function filterAndSortAdminHistory(records: AdminHistoryRecord[], filters: AdminHistoryFilters): AdminHistoryRecord[] {
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const last7DaysMs = now - 7 * 24 * 60 * 60 * 1000;

  const filtered = records.filter((record) => {
    if (filters.nodeId !== "all" && record.nodeId !== filters.nodeId) return false;
    if (filters.status !== "all" && record.status !== filters.status) return false;
    if (filters.calibrationSource !== "all" && (record.calibration?.normalizedSource ?? "none") !== filters.calibrationSource) return false;

    const timestamp = record.analyzedAt ?? record.uploadCreatedAt;
    const dateMs = timestamp ? new Date(timestamp).getTime() : Number.NaN;

    if (filters.dateRange === "today" && (!Number.isFinite(dateMs) || dateMs < todayMs)) return false;
    if (filters.dateRange === "last_7_days" && (!Number.isFinite(dateMs) || dateMs < last7DaysMs)) return false;

    return true;
  });

  return filtered.sort((a, b) => {
    if (filters.sort === "score_asc") return (a.aggregateScore ?? Number.POSITIVE_INFINITY) - (b.aggregateScore ?? Number.POSITIVE_INFINITY);
    if (filters.sort === "score_desc") return (b.aggregateScore ?? Number.NEGATIVE_INFINITY) - (a.aggregateScore ?? Number.NEGATIVE_INFINITY);
    if (filters.sort === "node_name_asc") return a.nodeName.localeCompare(b.nodeName);

    const aDate = new Date(a.analyzedAt ?? a.uploadCreatedAt ?? 0).getTime();
    const bDate = new Date(b.analyzedAt ?? b.uploadCreatedAt ?? 0).getTime();
    return filters.sort === "date_asc" ? aDate - bDate : bDate - aDate;
  });
}
