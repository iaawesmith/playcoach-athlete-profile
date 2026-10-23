import { describe, expect, it } from "vitest";
import { metricSide, withMetricSide, withMetricKeypoints } from "../features/athlete-lab/utils/metricSide";

describe("single metric Side control", () => {
  const original = { bilateral: "left" as const, bilateral_override: "auto" as const, body_groups: ["body"], keypoint_indices: [23, 25, 27], side_rule: "plant_outside", legacy: { preserved: true } };
  it("writes Auto to both saved fields", () => expect(withMetricSide(original, "auto")).toMatchObject({ bilateral: "auto", bilateral_override: "auto" }));
  it("writes Left to both saved fields", () => expect(withMetricSide(original, "left")).toMatchObject({ bilateral: "left", bilateral_override: "force_left" }));
  it("writes Right to both saved fields", () => expect(withMetricSide(original, "right")).toMatchObject({ bilateral: "right", bilateral_override: "force_right" }));
  it("writes Not bilateral to both saved fields", () => expect(withMetricSide(original, "none")).toMatchObject({ bilateral: "none", bilateral_override: "none" }));
  it("displays conflicting legacy settings using analyzer precedence, without mutation", () => {
    const forced = Object.freeze({ bilateral: "none" as const, bilateral_override: "force_right" as const });
    expect(metricSide(forced)).toBe("right");
    expect(metricSide({ bilateral: "left", bilateral_override: "none" })).toBe("none");
    expect(metricSide({ bilateral: "none", bilateral_override: "auto" })).toBe("none");
    expect(metricSide(original)).toBe("left");
    expect(metricSide(undefined)).toBe("auto");
    expect(forced).toEqual({ bilateral: "none", bilateral_override: "force_right" });
  });
  it("preserves hidden groups, indices, side_rule and unknown fields on explicit Side change", () => {
    const changed = withMetricSide(original, "right");
    expect(changed.body_groups).toEqual(["body"]);
    expect(changed.keypoint_indices).toEqual([23, 25, 27]);
    expect(changed.side_rule).toBe("plant_outside");
    expect(changed.legacy).toEqual({ preserved: true });
    expect(original.bilateral_override).toBe("auto");
  });
  it("picker and presets preserve hidden groups and supplied keypoint order", () => {
    const selected = withMetricKeypoints(original, [20, 19]);
    expect(selected.body_groups).toEqual(["body"]);
    expect(selected.keypoint_indices).toEqual([20, 19]);
    expect(selected.bilateral_override).toBe("auto");
    expect(original.keypoint_indices).toEqual([23, 25, 27]);
  });
});