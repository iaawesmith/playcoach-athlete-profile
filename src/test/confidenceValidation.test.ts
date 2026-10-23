import { describe, expect, it } from "vitest";
import { confidenceThresholdError, metricConfidenceErrors } from "../features/athlete-lab/utils/confidenceValidation";

describe("metric confidence validation", () => {
  it("rejects zero rather than silently letting the analyzer default it", () => {
    expect(confidenceThresholdError(0)).not.toBeNull();
    expect(metricConfidenceErrors([{ name: "Plant Leg Extension", keypoint_mapping: { confidence_threshold: 0 } }])).toHaveLength(1);
  });
  it("accepts positive thresholds up to one", () => {
    expect(confidenceThresholdError(0.05)).toBeNull();
    expect(confidenceThresholdError(0.7)).toBeNull();
    expect(confidenceThresholdError(1)).toBeNull();
    expect(confidenceThresholdError(-0.05)).not.toBeNull();
    expect(confidenceThresholdError(1.05)).not.toBeNull();
    expect(confidenceThresholdError(Number.NaN)).not.toBeNull();
  });
});