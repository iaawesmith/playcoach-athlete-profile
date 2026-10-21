import type { AnalysisLogData, KeyMetric, PipelineMetricResult } from "../types";

export const isOptionalLogVariable = (name: string): boolean =>
  ["focus_area", "skipped_metrics", "confidence_flags"].includes(name.replace(/^\{\{|\}\}$/g, "").trim());

/** Presentation only: never mutates a stored run or feeds back into scoring. */
export function buildAnalysisLogReporting(log: AnalysisLogData, nodeMetrics: KeyMetric[], results: PipelineMetricResult[]) {
  const active = nodeMetrics.filter((metric) => metric.active !== false);
  const activeIndices = new Set(active.flatMap((metric) => {
    const result = results.find((entry) => entry.name === metric.name);
    const decision = result?.detail?.bilateralDecision;
    const effective = decision && typeof decision === "object" && "effectiveIndices" in decision
      ? decision.effectiveIndices : undefined;
    return Array.isArray(effective) ? effective.filter((index): index is number => typeof index === "number")
      : metric.keypoint_mapping?.keypoint_indices ?? [];
  }));
  const warnings = (log.rtmlib?.keypoint_confidence ?? []).filter((kp) => {
    if (kp.status === "RELIABLE" || !activeIndices.has(kp.index)) return false;
    // The clip summary uses a global threshold; active metrics may use a lower
    // threshold and a reliable measurement window. Prefer those recorded checks.
    const usages = results.filter((result) => active.some((metric) => metric.name === result.name)).flatMap((result) => {
      const diagnostics = result.detail?.confidenceDiagnostics;
      if (!diagnostics || typeof diagnostics !== "object" || Array.isArray(diagnostics)) return [];
      const record = diagnostics as Record<string, unknown>;
      const averages = record.per_keypoint_avg_confidence;
      if (!averages || typeof averages !== "object" || !(String(kp.index) in averages)) return [];
      return [record];
    });
    return !usages.length || usages.some((usage) =>
      typeof usage.pass_ratio !== "number" || typeof usage.threshold !== "number" || usage.pass_ratio < usage.threshold);
  });
  const warningIndices = new Set(warnings.map((kp) => kp.index));
  const informational = (log.rtmlib?.keypoint_confidence ?? []).filter((kp) => kp.status !== "RELIABLE" && !warningIndices.has(kp.index));
  const metrics = (log.metrics ?? []).map((metric) => {
    const configured = nodeMetrics.find((entry) => entry.name === metric.name);
    const detail = results.find((entry) => entry.name === metric.name)?.detail;
    const frames = detail?.framesUsed ?? detail?.actualWindow;
    return {
      ...metric,
      temporal_window: configured?.temporal_window ?? metric.temporal_window,
      frames_used: Array.isArray(frames) ? frames.length : typeof frames === "number" ? frames : metric.frames_evaluated,
    };
  });
  return { metrics, warnings, informational, activeIndices, warningIndices };
}