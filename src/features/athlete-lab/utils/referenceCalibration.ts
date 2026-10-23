import type { CameraAngle, ReferenceCalibration } from "../types";

/** Update scale only, preserving all legacy metadata and array order. */
export function withReferenceScale(
  calibrations: ReferenceCalibration[],
  angle: CameraAngle,
  pixelsPerYard: number | null,
): ReferenceCalibration[] {
  const existing = calibrations.find((calibration) => calibration.camera_angle === angle);
  if (existing) {
    return calibrations.map((calibration) => calibration === existing
      ? { ...calibration, pixels_per_yard: pixelsPerYard }
      : calibration);
  }
  return [...calibrations, {
    camera_angle: angle,
    reference_object_name: "",
    known_size_yards: null,
    placement_instructions: "",
    pixels_per_yard: pixelsPerYard,
  }];
}