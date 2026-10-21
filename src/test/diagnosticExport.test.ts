import { describe, expect, it } from "vitest";
import { buildDiagnosticExport, NOT_RECORDED, RAW_KEYPOINTS_EXCLUDED } from "@/features/athlete-lab/utils/diagnosticExport";
import type { DiagnosticExportInput } from "@/features/athlete-lab/utils/diagnosticExport";
import type { CalibrationClip } from "@/services/calibrationLibrary";

const baseUpload: DiagnosticExportInput["upload"] = {
  id: "upload-1",
  node_id: "node-1",
  node_version: 3,
  created_at: "2026-10-20T10:00:00Z",
  start_seconds: 0,
  end_seconds: 2.27,
  camera_angle: "sideline",
  video_url: "https://example.test/clip.mp4",
  status: "complete",
  analysis_context: { camera_angle: "sideline", people_in_video: "solo" },
};

const oldStyleResult: DiagnosticExportInput["result"] = {
  id: "result-1",
  aggregate_score: 12,
  phase_scores: { p1: 20 },
  metric_results: [
    { name: "Plant Leg Extension", value: 84.98, score: 40, status: "scored", unit: "°", weight: 40 },
    { name: "Release Speed", value: null, score: null, status: "skipped", reason: "low_confidence", unit: "mph", weight: 20 },
  ],
  confidence_flags: [{ metric: "Release Speed", reason: "low_confidence" }],
  detected_errors: [{ name: "Rounding the break", condition: "plant_leg_extension < 125", metric_value: 84.98, severity: "critical" }],
  feedback: "Get your whole body in frame next time.",
  analyzed_at: "2026-10-20T10:01:00Z",
  result_data: {
    log_data: {
      rtmlib: {
        phase_windows: [{ phase: "Release", start: 0, end: 17, frame_count: 18, percent: 26.5 }],
        keypoint_confidence: [{ index: 0, name: "nose", mean_confidence: 0.9, status: "RELIABLE" }],
      },
      error_detection: [{ name: "Rounding the break", condition: "plant_leg_extension < 125", metric_value: "84.98", evaluation_expression: "84.98 < 125", triggered: true, auto_detectable: true }],
    },
    calibration_audit: { selected_source: "height_based", selected_ppy: 207.5 },
  },
};

const newStyleResult: DiagnosticExportInput["result"] = {
  ...oldStyleResult,
  result_data: {
    ...oldStyleResult!.result_data,
    diagnostics: {
      schema_version: 1,
      analyzer_build: "2026-10-21.diagnostic-export.1",
      deployment_id: "dep-123",
      cloud_run_revision: "pose-service-00042",
      service: { frames_detected: 60, missed_frame_indices: [0, 1], det_frequency_used: 1, frame_width: 3840, frame_height: 2160, frame_count: 68, fps: 30, timings: null },
      per_frame: [{ frame: 0, detected: false, mean_confidence: null, hip_center_x: null, hip_center_y: null, athlete_height_px: null, scale_ppy: 207.5, phases: ["Release"] }],
      metrics: [{ name: "Plant Leg Extension", value: 84.98, detail: { raw_value: 84.98 } }],
      errors: { evaluations: [{ name: "Rounding the break", triggered: true }], detected: [{ name: "Rounding the break" }] },
      aggregate: { aggregate_score: 12, scored_count: 3, flagged_count: 0, skipped_count: 1 },
      llm: { model: "claude-sonnet-4-5", status: "COMPLETE", system_instructions: "SYS", prompt: "PROMPT", response: "RESP", input_tokens: 100, output_tokens: 50, skipped_reason: null },
      fingerprints: { keypoints_sha256: "abc", metric_results_sha256: "def", calibration_audit_sha256: "ghi" },
      raw_keypoints: [[[[1, 2]]]],
      raw_scores: [[[0.9]]],
    },
  },
};

const clip: CalibrationClip = {
  id: "clip-1",
  title: "Slant – Indoor Diagonal – 4K30",
  storage_path: "library/slant.mp4",
  node_id: "node-1",
  duration_seconds: 2.27,
  resolution: "3840x2160",
  fps: 30,
  file_size_bytes: 1000,
  created_by: null,
  camera_angle: "sideline",
  people_in_video: "solo",
  route_direction: "right",
  catch_status: "yes",
  athlete_level: "college",
  athlete_height: 69,
  athlete_height_unit: "inches",
  athlete_wingspan: null,
  athlete_wingspan_unit: "inches",
  yard_lines_visible: false,
  yard_line_notes: "",
  start_yard_line: 0,
  break_yard_line: 5,
  expected_route_depth_yards: 5,
  expected_calibration_source: "height_based",
  hand_timed_splits: "",
  camera_setup: "tripod",
  camera_distance_notes: "",
  depth_metric_key: "Hands Extension at Catch",
  notes: "",
  archived: false,
  created_at: "2026-10-01T00:00:00Z",
  run_count: 2,
  node: { name: "Slant", position: "WR", status: "live" },
};

describe("buildDiagnosticExport", () => {
  it("marks sections missing from older runs as not_recorded", () => {
    const doc = buildDiagnosticExport({ upload: baseUpload, result: oldStyleResult, clip: null, includeRawKeypoints: false });
    expect(doc.service_diagnostics).toBe(NOT_RECORDED);
    expect(doc.per_frame).toBe(NOT_RECORDED);
    expect(doc.fingerprints).toBe(NOT_RECORDED);
    expect(doc.run_identity).toMatchObject({ analyzer_build: NOT_RECORDED, deployment_id: NOT_RECORDED });
  });

  it("passes stored metric values, scores, and errors through unchanged for older runs", () => {
    const doc = buildDiagnosticExport({ upload: baseUpload, result: oldStyleResult, clip: null, includeRawKeypoints: false });
    expect(doc.metrics).toEqual(oldStyleResult!.metric_results);
    expect(doc.errors).toMatchObject({ detected: oldStyleResult!.detected_errors });
    expect(doc.aggregate).toMatchObject({ aggregate_score: 12 });
    expect(doc.calibration_audit).toEqual({ selected_source: "height_based", selected_ppy: 207.5 });
  });

  it("populates diagnostics sections for new runs", () => {
    const doc = buildDiagnosticExport({ upload: baseUpload, result: newStyleResult, clip: null, includeRawKeypoints: false });
    expect(doc.run_identity).toMatchObject({ analyzer_build: "2026-10-21.diagnostic-export.1", cloud_run_revision: "pose-service-00042" });
    expect(doc.service_diagnostics).toMatchObject({ frames_detected: 60, det_frequency_used: 1 });
    expect(doc.per_frame).toHaveLength(1);
    expect(doc.fingerprints).toEqual({ keypoints_sha256: "abc", metric_results_sha256: "def", calibration_audit_sha256: "ghi" });
    expect(doc.llm).toMatchObject({ prompt: "PROMPT", response: "RESP", input_tokens: 100 });
  });

  it("excludes raw keypoints by default and includes them on request", () => {
    const excluded = buildDiagnosticExport({ upload: baseUpload, result: newStyleResult, clip: null, includeRawKeypoints: false });
    expect(excluded.raw_keypoints).toBe(RAW_KEYPOINTS_EXCLUDED);
    const included = buildDiagnosticExport({ upload: baseUpload, result: newStyleResult, clip: null, includeRawKeypoints: true });
    expect(included.raw_keypoints).toEqual([[[[1, 2]]]]);
  });

  it("marks raw keypoints not_recorded for older runs even when requested", () => {
    const doc = buildDiagnosticExport({ upload: baseUpload, result: oldStyleResult, clip: null, includeRawKeypoints: true });
    expect(doc.raw_keypoints).toBe(NOT_RECORDED);
  });

  it("includes library clip identity, ground truth, and overrides for library runs", () => {
    const upload: DiagnosticExportInput["upload"] = {
      ...baseUpload,
      analysis_context: {
        ...baseUpload.analysis_context,
        calibration_clip_id: "clip-1",
        overrides: [{ field: "athlete_height", clip_value: 69, run_value: 70 }],
      },
    };
    const doc = buildDiagnosticExport({ upload, result: oldStyleResult, clip, includeRawKeypoints: false });
    expect(doc.input).toMatchObject({ library_clip_id: "clip-1", library_clip_title: "Slant – Indoor Diagonal – 4K30" });
    expect(doc.input).toMatchObject({ overrides: [{ field: "athlete_height", clip_value: 69, run_value: 70 }] });
    expect(doc.input).toMatchObject({
      ground_truth_snapshot: { start_yard_line: 0, break_yard_line: 5, expected_route_depth_yards: 5, depth_metric_key: "Hands Extension at Catch" },
    });
  });

  it("computes clip duration from the upload window", () => {
    const doc = buildDiagnosticExport({ upload: baseUpload, result: oldStyleResult, clip: null, includeRawKeypoints: false });
    expect(doc.clip_metadata).toMatchObject({ duration_seconds: 2.27, start_seconds: 0, end_seconds: 2.27 });
  });

  it("produces identical output for identical input", () => {
    const a = buildDiagnosticExport({ upload: baseUpload, result: newStyleResult, clip, includeRawKeypoints: true });
    const b = buildDiagnosticExport({ upload: baseUpload, result: newStyleResult, clip, includeRawKeypoints: true });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
