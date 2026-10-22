import type { CalibrationClip } from "@/services/calibrationLibrary";
import { frameSourceSeams, type FrameSourceSeam } from "./poseOverlay";

/**
 * Diagnostic export builder — read-only reporting.
 *
 * Assembles one JSON document per run for audit and run-to-run comparison.
 * Nothing here feeds back into analysis, scoring, calibration, or feedback.
 * Sections that were not recorded for a run (older runs, or data the pose
 * service does not report) are emitted as the string "not_recorded".
 */

export const NOT_RECORDED = "not_recorded";
export const RAW_KEYPOINTS_EXCLUDED = "excluded_by_default";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function present<T>(value: T | null | undefined): T | typeof NOT_RECORDED {
  return value === null || value === undefined ? NOT_RECORDED : value;
}

export interface DiagnosticExportInput {
  upload: {
    id: string;
    node_id: string | null;
    node_version: number | null;
    created_at: string | null;
    start_seconds: number | null;
    end_seconds: number | null;
    camera_angle: string | null;
    video_url: string | null;
    status: string;
    analysis_context: JsonRecord;
  };
  result: {
    id: string;
    aggregate_score: number | null;
    phase_scores: JsonRecord;
    metric_results: unknown;
    confidence_flags?: unknown;
    detected_errors: unknown;
    feedback: string | null;
    analyzed_at: string | null;
    result_data: JsonRecord;
  } | null;
  clip: CalibrationClip | null;
  includeRawKeypoints: boolean;
}

/**
 * Older exports marked zero-filled (service "no detection") frames as detected.
 * A frame is detected only when it is not a reported miss and has a real hip position.
 */
function normalizePerFrame(rows: unknown[] | null, service: JsonRecord | null): unknown[] | null {
  if (!rows) return null;
  const missed = new Set<number>(
    (asArray(service?.missed_frame_indices) ?? []).filter((v): v is number => typeof v === "number"),
  );
  return rows.map((row) => {
    const r = asRecord(row);
    if (!r) return row;
    const frame = typeof r.frame === "number" ? r.frame : -1;
    const zeroHip = r.hip_center_x === 0 && r.hip_center_y === 0;
    const noHip = r.hip_center_x === null || r.hip_center_x === undefined;
    const detected = r.detected === true && !missed.has(frame) && !zeroHip && !noHip;
    return { ...r, detected };
  });
}

const numSet = (v: unknown): Set<number> =>
  new Set((asArray(v) ?? []).filter((n): n is number => typeof n === "number"));

/** Frame-source seams from the service's recovered / following-crop / missed / rejected lists. */
export function exportSeams(service: JsonRecord | null, frameCount: number): FrameSourceSeam[] | null {
  if (!service || !(frameCount > 0)) return null;
  const rejected = new Map<number, string>([...numSet(service.rejected_frame_indices)].map((f) => [f, ""]));
  return frameSourceSeams(frameCount, {
    missed: numSet(service.missed_frame_indices),
    rejected,
    leadingRecovery: numSet(service.recovered_frame_indices),
    followingCrop: numSet(service.zoom_fallback_frame_indices),
  });
}

function markSeams(rows: unknown[] | null, seams: FrameSourceSeam[] | null): unknown[] | null {
  if (!rows || !seams) return rows;
  const at = new Set(seams.map((s) => s.frame));
  return rows.map((row, i) => {
    const r = asRecord(row);
    if (!r) return row;
    const frame = typeof r.frame === "number" ? r.frame : i;
    return { ...r, seam: at.has(frame) };
  });
}

export function buildDiagnosticExport(input: DiagnosticExportInput): JsonRecord {
  const { upload, result, clip, includeRawKeypoints } = input;
  const resultData = result ? asRecord(result.result_data) ?? {} : {};
  const diagnostics = asRecord(resultData.diagnostics);
  const logData = asRecord(resultData.log_data);
  const rtmlibLog = logData ? asRecord(logData.rtmlib) : null;
  const context = upload.analysis_context ?? {};
  const overrides = asArray(context.overrides) ?? asRecord(context.overrides);

  const clipGroundTruth = clip
    ? {
        start_yard_line: clip.start_yard_line,
        break_yard_line: clip.break_yard_line,
        expected_route_depth_yards: clip.expected_route_depth_yards,
        expected_calibration_source: clip.expected_calibration_source,
        depth_metric_key: clip.depth_metric_key,
        yard_lines_visible: clip.yard_lines_visible,
        yard_line_notes: clip.yard_line_notes,
        hand_timed_splits: clip.hand_timed_splits,
      }
    : null;

  const service = diagnostics ? asRecord(diagnostics.service) : null;
  const perFrameRows = diagnostics ? asArray(diagnostics.per_frame) : null;
  const seamFrameCount = typeof service?.frame_count === "number" ? service.frame_count : perFrameRows?.length ?? 0;
  const seams = exportSeams(service, seamFrameCount);
  const frameWidth = service?.frame_width ?? null;
  const frameHeight = service?.frame_height ?? null;

  const metrics =
    (diagnostics ? asArray(diagnostics.metrics) : null) ??
    (result ? asArray(result.metric_results) : null);

  const llm =
    (diagnostics ? asRecord(diagnostics.llm) : null) ??
    (logData ? asRecord(logData.claude_api) : null);

  const aggregate =
    (diagnostics ? asRecord(diagnostics.aggregate) : null) ??
    (result
      ? {
          aggregate_score: result.aggregate_score,
          phase_scores: result.phase_scores,
          scoring_config: logData ? asRecord(logData.scoring_config) ?? NOT_RECORDED : NOT_RECORDED,
        }
      : null);

  const rawKeypoints = diagnostics ? diagnostics.raw_keypoints : undefined;

  return {
    export_kind: "athlete_lab_run_diagnostic",
    export_version: 1,
    run_identity: {
      result_id: result?.id ?? NOT_RECORDED,
      upload_id: upload.id,
      upload_created_at: present(upload.created_at),
      analyzed_at: present(result?.analyzed_at ?? null),
      node_id: present(upload.node_id),
      node_version: present(upload.node_version),
      analyzer_build: present(diagnostics?.analyzer_build as string | undefined),
      deployment_id: present(diagnostics?.deployment_id as string | null | undefined),
      cloud_run_revision: present(diagnostics?.cloud_run_revision as string | null | undefined),
      service_build: present((service?.service_build as string | null | undefined) ?? (service?.service_revision as string | null | undefined)),
    },
    input: {
      library_clip_id: present(typeof context.calibration_clip_id === "string" ? context.calibration_clip_id : null),
      library_clip_title: present(clip?.title ?? null),
      run_context: context,
      overrides: overrides ?? "none",
      ground_truth_snapshot: clipGroundTruth ?? NOT_RECORDED,
    },
    clip_metadata: {
      resolution:
        typeof frameWidth === "number" && typeof frameHeight === "number"
          ? `${frameWidth}x${frameHeight}`
          : present(clip?.resolution ?? null),
      fps: present((service?.fps as number | undefined) ?? clip?.fps ?? null),
      frame_count: present(service?.frame_count as number | undefined),
      duration_seconds:
        typeof upload.start_seconds === "number" && typeof upload.end_seconds === "number"
          ? Math.round((upload.end_seconds - upload.start_seconds) * 1000) / 1000
          : present(clip?.duration_seconds ?? null),
      start_seconds: present(upload.start_seconds),
      end_seconds: present(upload.end_seconds),
    },
    service_diagnostics: service ?? NOT_RECORDED,
    per_frame: markSeams(normalizePerFrame(diagnostics ? asArray(diagnostics.per_frame) : null, service), seams) ?? NOT_RECORDED,
    frame_source_seams: seams ?? NOT_RECORDED,
    ground_truth_distance: diagnostics ? present(asRecord(diagnostics.ground_truth_distance)) : NOT_RECORDED,
    release_anchor: (rtmlibLog ? asRecord(rtmlibLog.release_anchor) : null) ?? NOT_RECORDED,
    // Keypoint smoothing window — separate from each metric's measurement window (metrics[].temporal_window).
    temporal_smoothing: (rtmlibLog ? asRecord(rtmlibLog.temporal_smoothing) : null) ?? NOT_RECORDED,
    confidence_flags: result ? present(result.confidence_flags ?? null) : NOT_RECORDED,
    calibration_audit: asRecord(resultData.calibration_audit) ?? NOT_RECORDED,
    phase_windows: (rtmlibLog ? asArray(rtmlibLog.phase_windows) : null) ?? NOT_RECORDED,
    metrics: metrics ?? NOT_RECORDED,
    keypoint_confidence: (rtmlibLog ? asArray(rtmlibLog.keypoint_confidence) : null) ?? NOT_RECORDED,
    errors: {
      rule_evaluations:
        (diagnostics ? asRecord(diagnostics.errors)?.evaluations : null) ??
        (logData ? asArray(logData.error_detection) : null) ??
        NOT_RECORDED,
      detected: result ? present(result.detected_errors) : NOT_RECORDED,
    },
    aggregate: aggregate ?? NOT_RECORDED,
    llm: llm ?? NOT_RECORDED,
    fingerprints: (diagnostics ? asRecord(diagnostics.fingerprints) : null) ?? NOT_RECORDED,
    raw_keypoints: includeRawKeypoints ? present(rawKeypoints) : RAW_KEYPOINTS_EXCLUDED,
  };
}
