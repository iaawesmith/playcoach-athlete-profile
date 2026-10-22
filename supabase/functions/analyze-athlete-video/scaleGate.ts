// Pure scale gate: a metric whose unit is a real-world distance or speed can
// only be scored when the run resolved a real scale. Without one, its value
// would be in pixels, so it is skipped with reason "no_scale".

const DISTANCE_UNIT = /\b(yards?|yd|yds|mph|ft|feet|foot|inch(es)?|in|meters?|m|cm|km\/h|kph|m\/s|yd\/s)\b/i

export function unitNeedsScale(unit: string | null | undefined): boolean {
  if (!unit) return false
  // Normalise compound units ("mph/s", "yd/s") so each piece is checked.
  return unit.split(/[\s/·*]+/).some((part) => DISTANCE_UNIT.test(part)) || DISTANCE_UNIT.test(unit)
}

export function hasRealScale(calibration: { source?: string | null; pixelsPerYard?: number | null } | null | undefined): boolean {
  if (!calibration) return false
  if (calibration.source === 'none') return false
  return calibration.pixelsPerYard != null && Number.isFinite(calibration.pixelsPerYard) && calibration.pixelsPerYard > 0
}

export function noScaleSkip(unit: string | null | undefined, calibration: Parameters<typeof hasRealScale>[0]): boolean {
  return unitNeedsScale(unit) && !hasRealScale(calibration)
}
