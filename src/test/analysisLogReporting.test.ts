import { describe, expect, it } from "vitest";
import { buildAnalysisLogReporting } from "../features/athlete-lab/utils/analysisLogReporting";
import type { AnalysisLogData, KeyMetric, PipelineMetricResult } from "../features/athlete-lab/types";

const metrics = [
  { name: "Plant Leg Extension", temporal_window: 3, active: true },
  { name: "Hip Stability", temporal_window: 15, active: true },
  { name: "Release Speed", temporal_window: 10, active: true },
] as KeyMetric[];

describe("Analysis Log reporting", () => {
  it("reports configured measurement windows 3/15/10 without modifying historical values", () => {
    const log = { metrics: metrics.map((metric, i) => ({ name: metric.name, temporal_window: [0, 10, 3][i] })) } as AnalysisLogData;
    expect(buildAnalysisLogReporting(log, metrics, []).metrics.map(metric => metric.temporal_window)).toEqual([3, 15, 10]);
    expect(log.metrics?.map(metric => metric.temporal_window)).toEqual([0, 10, 3]);
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
    const result = { name: "Plant Leg Extension", detail: { confidenceDiagnostics: { pass_ratio: 1, threshold: 0.8, per_keypoint_avg_confidence: { "25": 0.7876 } } } } as PipelineMetricResult;
    expect(buildAnalysisLogReporting(log, [nodeMetric], [result]).warnings).toHaveLength(0);
    const failing = { ...result, detail: { confidenceDiagnostics: { pass_ratio: 0.6, threshold: 0.8, per_keypoint_avg_confidence: { "25": 0.3 } } } };
    expect(buildAnalysisLogReporting(log, [nodeMetric], [failing]).warnings).toHaveLength(1);
  });
});