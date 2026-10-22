import { supabase } from "@/integrations/supabase/client";
import type { PipelineMetricResult, TrainingNode } from "@/features/athlete-lab/types";

export const LIBRARY_MAX_BYTES = 500 * 1024 * 1024;
export const LIBRARY_RUN_SOURCE = "calibration_library";
const FUNCTION_NAME = "admin-calibration-clips";

export type ExpectedCalibrationSource = "dynamic" | "height_based" | "body_based" | "static" | "unknown";

export interface CalibrationClipMetadata {
  title: string;
  node_id: string | null;
  duration_seconds: number | null;
  resolution: string | null;
  fps: number | null;
  file_size_bytes: number | null;
  created_by: string | null;
  camera_angle: "sideline" | "behind_wr" | "behind_qb" | "endzone" | "other";
  people_in_video: "solo" | "with_defender" | "multiple";
  route_direction: "left" | "right" | "both" | "straight";
  catch_status: "yes" | "no" | "partial";
  athlete_level: "youth" | "high_school" | "college" | "professional";
  athlete_height: number | null;
  athlete_height_unit: "inches" | "cm";
  athlete_wingspan: number | null;
  athlete_wingspan_unit: "inches" | "cm";
  yard_lines_visible: boolean;
  yard_line_notes: string;
  start_yard_line: number | null;
  break_yard_line: number | null;
  expected_calibration_source: ExpectedCalibrationSource;
  hand_timed_splits: string;
  camera_setup: "tripod" | "handheld";
  camera_distance_notes: string;
  depth_metric_key: string | null;
  notes: string;
}

export interface CalibrationClip extends CalibrationClipMetadata {
  id: string;
  storage_path: string;
  expected_route_depth_yards: number | null;
  archived: boolean;
  created_at: string;
  run_count: number;
  node: { name: string; position: string | null; status: string } | null;
}

export const EMPTY_CLIP_METADATA: CalibrationClipMetadata = {
  title: "",
  node_id: null,
  duration_seconds: null,
  resolution: null,
  fps: null,
  file_size_bytes: null,
  created_by: null,
  camera_angle: "sideline",
  people_in_video: "solo",
  route_direction: "left",
  catch_status: "yes",
  athlete_level: "high_school",
  athlete_height: null,
  athlete_height_unit: "inches",
  athlete_wingspan: null,
  athlete_wingspan_unit: "inches",
  yard_lines_visible: false,
  yard_line_notes: "",
  start_yard_line: null,
  break_yard_line: null,
  expected_calibration_source: "unknown",
  hand_timed_splits: "",
  camera_setup: "tripod",
  camera_distance_notes: "",
  depth_metric_key: null,
  notes: "",
};

/* ------------------------------------------------------------ pure rules --- */

export function checkClipSize(bytes: number): string | null {
  if (bytes > LIBRARY_MAX_BYTES) {
    return `File is ${(bytes / 1024 / 1024).toFixed(1)} MB — library limit is 500 MB.`;
  }
  return null;
}

export function computeExpectedDepth(start: number | null, breakLine: number | null): number | null {
  if (start === null || breakLine === null || !Number.isFinite(start) || !Number.isFinite(breakLine)) return null;
  return Math.abs(breakLine - start);
}

export function yardMetricNames(node: Pick<TrainingNode, "key_metrics"> | null | undefined): string[] {
  if (!node) return [];
  return node.key_metrics
    .filter((m) => m.active !== false && /^(yards?|yd)$/i.test(m.unit.trim()))
    .map((m) => m.name);
}

export interface LibraryRunTag {
  source: typeof LIBRARY_RUN_SOURCE;
  calibration_clip_id: string;
  ground_truth: {
    start_yard_line: number | null;
    break_yard_line: number | null;
    expected_route_depth_yards: number | null;
    expected_calibration_source: ExpectedCalibrationSource;
    depth_metric_key: string | null;
  };
}

export function buildLibraryRunTag(clip: Pick<CalibrationClip, "id" | "start_yard_line" | "break_yard_line" | "expected_calibration_source" | "depth_metric_key">): LibraryRunTag {
  return {
    source: LIBRARY_RUN_SOURCE,
    calibration_clip_id: clip.id,
    ground_truth: {
      start_yard_line: clip.start_yard_line,
      break_yard_line: clip.break_yard_line,
      expected_route_depth_yards: computeExpectedDepth(clip.start_yard_line, clip.break_yard_line),
      expected_calibration_source: clip.expected_calibration_source,
      depth_metric_key: clip.depth_metric_key,
    },
  };
}

export function isLibraryRun(context: Record<string, unknown> | null | undefined): boolean {
  return Boolean(context && context.source === LIBRARY_RUN_SOURCE && typeof context.calibration_clip_id === "string");
}

export interface DepthComparison {
  primary: { name: string; measured: number | null; difference: number | null } | null;
  others: Array<{ name: string; measured: number | null }>;
}

export function buildDepthComparison(
  expectedDepth: number | null,
  depthMetricKey: string | null,
  yardMetrics: string[],
  results: PipelineMetricResult[],
): DepthComparison {
  const valueOf = (name: string): number | null => {
    const hit = results.find((r) => r.name === name);
    return hit && typeof hit.value === "number" && Number.isFinite(hit.value) ? hit.value : null;
  };
  const primary = depthMetricKey
    ? (() => {
        const measured = valueOf(depthMetricKey);
        return {
          name: depthMetricKey,
          measured,
          difference: measured !== null && expectedDepth !== null ? measured - expectedDepth : null,
        };
      })()
    : null;
  const others = yardMetrics.filter((n) => n !== depthMetricKey).map((name) => ({ name, measured: valueOf(name) }));
  return { primary, others };
}

/* ------------------------------------------------------------ backend calls --- */

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const payload: unknown = await context.json().catch(() => null);
      if (payload && typeof payload === "object" && "error" in payload && typeof (payload as { error: unknown }).error === "string") {
        throw new Error((payload as { error: string }).error);
      }
    }
    throw new Error(error.message);
  }
  return data as T;
}

interface RawClip extends Omit<CalibrationClip, "node"> {
  athlete_lab_nodes: { name: string; position: string | null; status: string } | null;
}

export async function listCalibrationClips(includeArchived: boolean): Promise<CalibrationClip[]> {
  const res = await call<{ clips: RawClip[] }>({ action: "list", includeArchived });
  return res.clips.map(({ athlete_lab_nodes, ...rest }) => ({ ...rest, node: athlete_lab_nodes }));
}

export async function uploadCalibrationClip(file: File, metadata: CalibrationClipMetadata): Promise<string> {
  const sizeError = checkClipSize(file.size);
  if (sizeError) throw new Error(sizeError);
  const issued = await call<{ path: string; token: string; bucket: string }>({
    action: "issue_upload",
    fileName: file.name,
    fileSize: file.size,
    contentType: file.type || "video/mp4",
  });
  const { error } = await supabase.storage.from(issued.bucket).uploadToSignedUrl(issued.path, issued.token, file, {
    contentType: file.type || "video/mp4",
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const created = await call<{ id: string }>({
    action: "create",
    storage_path: issued.path,
    metadata: { ...metadata, file_size_bytes: file.size },
  });
  return created.id;
}

export async function updateCalibrationClip(id: string, metadata: CalibrationClipMetadata): Promise<void> {
  await call({ action: "update", id, metadata });
}

export async function signCalibrationClip(id: string, purpose: "preview" | "test"): Promise<string> {
  const res = await call<{ signedUrl: string }>({ action: "sign", id, purpose });
  return res.signedUrl;
}

/** Fresh signed link for an existing upload's stored video (read-only). */
export async function signUploadVideo(uploadId: string): Promise<string> {
  const res = await call<{ signedUrl: string }>({ action: "sign_upload", upload_id: uploadId });
  return res.signedUrl;
}

export async function setCalibrationClipArchived(id: string, archived: boolean): Promise<void> {
  await call({ action: "set_archived", id, archived });
}

export async function deleteCalibrationClip(id: string): Promise<void> {
  await call({ action: "delete", id });
}

export function readVideoFileMetadata(file: File): Promise<{ duration: number | null; resolution: string | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? Math.round(video.duration * 100) / 100 : null;
      const resolution = video.videoWidth ? `${video.videoWidth}x${video.videoHeight}` : null;
      URL.revokeObjectURL(url);
      resolve({ duration, resolution });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ duration: null, resolution: null });
    };
    video.src = url;
  });
}
