import type { TrainingNode, KeyMetric } from "../types";

/**
 * Returns metrics that are active for scoring/display/export.
 *
 * The `active` field defaults to `true` — only metrics explicitly set to
 * `active: false` are excluded. Inactive metrics are preserved in storage
 * (so admins can re-enable them) but must never count toward weight sums,
 * solution-class derivation, readiness scoring, or any LLM-facing surface.
 *
 * Use this helper everywhere you enumerate metrics for those purposes.
 * Inline `metrics.filter(m => m.active !== false)` is the same logic but
 * easy to forget when a new surface is added — prefer this helper.
 *
 * Existing pre-Phase-1b surfaces (NodeReadinessBar, KeyMetricsEditor,
 * Pipeline Setup, Mechanics summary, Scoring widget, renormalize cap hint)
 * still inline the filter. They are intentionally not refactored in the
 * patch that introduced this helper — convert them opportunistically as
 * each surface is touched next.
 */
export function getActiveMetrics(node: TrainingNode): KeyMetric[] {
  return (node.key_metrics ?? []).filter((m) => m.active !== false);
}

/**
 * Convenience: split metrics into active and inactive arrays in one pass.
 * Useful for export surfaces that need to render both groups separately.
 */
export function partitionMetricsByActive(node: TrainingNode): {
  active: KeyMetric[];
  inactive: KeyMetric[];
} {
  const active: KeyMetric[] = [];
  const inactive: KeyMetric[] = [];
  for (const m of node.key_metrics ?? []) {
    if (m.active === false) inactive.push(m);
    else active.push(m);
  }
  return { active, inactive };
}
