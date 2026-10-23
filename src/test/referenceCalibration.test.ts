import { describe, expect, it } from "vitest";
import { withReferenceScale } from "../features/athlete-lab/utils/referenceCalibration";

describe("Reference scale changes preserve hidden saved fields", () => {
  const original = {
    camera_angle: "sideline" as const, status: "primary" as const,
    reference_object_name: "5-Yard Line Spacing", known_size_yards: 5,
    known_size_unit: "yards", placement_instructions: "Original placement",
    pixels_per_yard: 170, filming_instructions: "Original filming",
    calibration_notes: "Original notes", legacy: { retained: true },
  };
  it("changes only pixels per yard, preserving hidden metadata and order", () => {
    const other = { ...original, camera_angle: "endzone" as const, pixels_per_yard: 200 };
    const result = withReferenceScale([original, other], "sideline", 180);
    expect(result).toEqual([{ ...original, pixels_per_yard: 180 }, other]);
    expect(original.pixels_per_yard).toBe(170);
  });
  it("clears only the scale, never the hidden saved calibration fields", () => {
    expect(withReferenceScale([original], "sideline", null)).toEqual([{ ...original, pixels_per_yard: null }]);
  });
  it("adding a missing angle preserves existing angles without fabricated reference guidance", () => {
    expect(withReferenceScale([original], "behind_qb", 190)).toEqual([original, {
      camera_angle: "behind_qb", pixels_per_yard: 190,
      reference_object_name: "", known_size_yards: null, placement_instructions: "",
    }]);
  });
});