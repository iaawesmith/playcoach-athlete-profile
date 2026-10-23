// Fixed measurement window per calculation type. Pure (no Deno imports) so the
// analyzer, the editor and the Analysis Log share one definition. Values match
// the analyzer's behaviour before the per-metric setting was removed (no node
// ever set the nested value the math read, so these defaults were always used).

export type MeasurementWindow = { frames: number | null; description: string }

export const MEASUREMENT_WINDOWS: Record<string, MeasurementWindow> = {
  angle: { frames: 5, description: "Phase midpoint ±2 frames" },
  distance: { frames: 5, description: "Phase midpoint ±2 frames (catch arrival ±2 for catch metrics)" },
  velocity: { frames: 3, description: "Net displacement over the phase window; minimum 3 elapsed frames between first and last valid point" },
  acceleration: { frames: 5, description: "Velocity change across the phase, split at 2 frames (needs at least 5 frames)" },
  frame_delta: { frames: 10, description: "First 10 frames of the phase" },
  distance_variance: { frames: 10, description: "First 10 frames of the phase (needs at least 5)" },
  speed_retention: { frames: 5, description: "5-frame average before the next phase ÷ peak 5-frame average in this phase before the next phase starts" },
}

/** Frame count the calculation uses; null for unknown types. */
export function measurementFrames(calculationType: unknown): number | null {
  return typeof calculationType === "string" ? MEASUREMENT_WINDOWS[calculationType]?.frames ?? null : null
}

export function measurementDescription(calculationType: unknown): string {
  return typeof calculationType === "string" && MEASUREMENT_WINDOWS[calculationType]
    ? MEASUREMENT_WINDOWS[calculationType].description
    : "Not defined for this calculation type"
}
