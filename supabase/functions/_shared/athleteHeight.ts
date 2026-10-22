// Athlete height sanity rule shared by the browser forms and edge functions.
// Height drives the per-run scale used for speed and distance metrics.

export const HEIGHT_MIN_INCHES = 48
export const HEIGHT_MAX_INCHES = 90
export const CM_PER_INCH = 2.54
export const HEIGHT_HELP = 'Used to measure speed and distance accurately.'

export type HeightUnit = 'inches' | 'cm'

/** Returns null when valid, otherwise a message to show the admin. */
export function athleteHeightError(value: unknown, unit: HeightUnit): string | null {
  if (value === null || value === undefined || value === '') return `Athlete height is required. ${HEIGHT_HELP}`
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 'Athlete height must be a number.'
  const inches = unit === 'cm' ? n / CM_PER_INCH : n
  if (inches < HEIGHT_MIN_INCHES || inches > HEIGHT_MAX_INCHES) {
    const range = unit === 'cm'
      ? `${Math.round(HEIGHT_MIN_INCHES * CM_PER_INCH)}–${Math.round(HEIGHT_MAX_INCHES * CM_PER_INCH)} cm`
      : `${HEIGHT_MIN_INCHES}–${HEIGHT_MAX_INCHES} inches`
    return `Athlete height must be between ${range} (entered ${n} ${unit === 'cm' ? 'cm' : 'in'}).`
  }
  return null
}
