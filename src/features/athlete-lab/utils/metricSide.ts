import type { BilateralMode, BilateralOverride } from "../types";

export type MetricSide = "auto" | "left" | "right" | "none";
type SideFields = { bilateral?: BilateralMode; bilateral_override?: BilateralOverride };

/** Match analyzer precedence without normalizing or mutating saved settings. */
export function metricSide(mapping: SideFields | null | undefined): MetricSide {
  if (mapping?.bilateral_override === "force_left") return "left";
  if (mapping?.bilateral_override === "force_right") return "right";
  if (mapping?.bilateral_override === "none" || mapping?.bilateral === "none") return "none";
  if (mapping?.bilateral === "left" || mapping?.bilateral === "right") return mapping.bilateral;
  return "auto";
}

/** Only an explicit Side selection writes both legacy fields. Preserve all others. */
export function withMetricSide<T extends SideFields>(mapping: T, side: MetricSide): T & Required<SideFields> {
  const override: BilateralOverride = side === "left" ? "force_left" : side === "right" ? "force_right" : side;
  return { ...mapping, bilateral: side, bilateral_override: override };
}

/** Picker changes never rewrite the hidden group list or reorder supplied indices. */
export function withMetricKeypoints<T extends { keypoint_indices: number[] }>(mapping: T, indices: number[]): T {
  return { ...mapping, keypoint_indices: [...indices] };
}