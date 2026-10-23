export function confidenceThresholdError(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 1) {
    return "Confidence threshold must be greater than 0 and at most 1.";
  }
  return null;
}

export function metricConfidenceErrors(metrics: readonly { name: string; keypoint_mapping?: { confidence_threshold?: unknown } | null }[]): string[] {
  return metrics.flatMap(metric => {
    if (!metric.keypoint_mapping) return [];
    const error = confidenceThresholdError(metric.keypoint_mapping.confidence_threshold);
    return error ? [`${metric.name || "Untitled metric"}: ${error}`] : [];
  });
}