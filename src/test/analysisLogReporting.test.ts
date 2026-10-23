import { describe, expect, it } from "vitest";
import { buildAnalysisLogReporting } from "../features/athlete-lab/utils/analysisLogReporting";
import type { AnalysisLogData, KeyMetric, PipelineMetricResult } from "../features/athlete-lab/types";

const metrics = [
  { name: "Plant Leg Extension", temporal_window: 3, active: true, keypoint_mapping: { calculation_type: "angle", keypoint_indices: [23, 25, 27] } },
  { name: "Hip Stability", temporal_window: 15, active: true, keypoint_mapping: { calculation_type: "distance_variance", keypoint_indices: [23, 24] } },
  { name: "Release Speed", temporal_window: 10, active: true, keypoint_mapping: { calculation_type: "velocity", keypoint_indices: [23, 24] } },
  { name: "Speed into the break", temporal_window: 5, active: true, keypoint_mapping: { calculation_type: "speed_retention", keypoint_indices: [23, 24] } },
] as KeyMetric[];

describe("Analysis Log reporting", () => {
  it("reports the fixed window the analyzer used, ignoring the retired per-metric setting", () => {
    const log = { metrics: metrics.map((metric, i) => ({ name: metric.name, temporal_window: [0, 10, 3, 5][i] })) } as AnalysisLogData;
    const rows = buildAnalysisLogReporting(log, metrics, []).metrics;
    expect(rows.map(metric => metric.temporal_window)).toEqual([5, 10, 3, 5]);
    expect(rows[0].measurement_window).toBe("Phase midpoint ±2 frames");
    expect(log.metrics?.map(metric => metric.temporal_window)).toEqual([0, 10, 3, 5]);
  });

  it("does not count inactive-only unreliable keypoints as confidence warnings", () => {
    const log = { rtmlib: { keypoint_confidence: [{ index: 19, status: "UNRELIABLE" }] } } as AnalysisLogData;
    const inactive = { name: "Hands Extension at Catch", active: false, keypoint_mapping: { keypoint_indices: [19, 20] } } as KeyMetric;
    const reporting = buildAnalysisLogReporting(log, [...metrics, inactive], []);
    expect(reporting.warnings).toHaveLength(0);
    expect(reporting.informational.map(kp => kp.index)).toEqual([19]);
  });

  it("prefers recorded passing active-window checks over clip-global marginal status", () => {
    const nodeMetric = { ...metrics[0], keypoint_mapping: { keypoint_indices: [25] } } as KeyMetric;
    const log = { rtmlib: { keypoint_confidence: [{ index: 25, status: "MARGINAL" }] } } as AnalysisLogData;
    const result: PipelineMetricResult = { name: "Plant Leg Extension", unit: "degrees", value: 139.61, elite_target: "140", weight: 59, status: "scored", detail: { confidenceDiagnostics: { pass_ratio: 1, threshold: 0.8, per_keypoint_avg_confidence: { "25": 0.7876 } } } };
    expect(buildAnalysisLogReporting(log, [nodeMetric], [result]).warnings).toHaveLength(0);
    const failing = { ...result, detail: { confidenceDiagnostics: { pass_ratio: 0.6, threshold: 0.8, per_keypoint_avg_confidence: { "25": 0.3 } } } };
    expect(buildAnalysisLogReporting(log, [nodeMetric], [failing]).warnings).toHaveLength(1);
  });
});