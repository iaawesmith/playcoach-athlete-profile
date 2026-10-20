import { describe, expect, it } from "vitest";
import {
  LOW_QUALITY_FEEDBACK,
  buildLowQualityFeedback,
  checkPlausibility,
  evaluateErrorRules,
  passesWindowGate,
} from "../../supabase/functions/analyze-athlete-video/quality";
import { parseDetectedErrors, parseMetricResults, roundScore } from "@/features/athlete-lab/utils/pipelineResults";

describe("plausibility bounds", () => {
  it("rejects release speed of 436.58 mph (limit 0–25)", () => {
    expect(checkPlausibility("Release Speed", "mph", 436.58).ok).toBe(false);
    expect(checkPlausibility("Release Speed", "mph", 7).ok).toBe(true);
  });
  it("rejects hands extension of 1.95 yd (limit 0–1.2)", () => {
    expect(checkPlausibility("Hands Extension at Catch", "yards", 1.95).ok).toBe(false);
    expect(checkPlausibility("Hands Extension at Catch", "yards", 0.4).ok).toBe(true);
  });
  it("rejects angles above 180 degrees", () => {
    expect(checkPlausibility("Plant Leg Extension", "degrees", 190).ok).toBe(false);
  });
});

describe("confidence window gate", () => {
  it("defaults to a 0.8 minimum share", () => {
    expect(passesWindowGate(0.54)).toBe(false);
    expect(passesWindowGate(0.8)).toBe(true);
  });
  it("honours a configured minimum", () => {
    expect(passesWindowGate(0.54, 0.5)).toBe(true);
  });
});

describe("error rules", () => {
  const errors = [
    { error: "Rounding the break", auto_detectable: true, auto_detection_condition: "Plant Leg Extension < 125", severity: "critical" },
    { error: "Slowing down before the break", auto_detectable: true, auto_detection_condition: "Release Speed < 5" },
    { error: "Body catch", auto_detectable: false, auto_detection_condition: "Catch Efficiency < 70" },
    { error: "Drifting after the catch", auto_detectable: true, auto_detection_condition: "Post-Catch YAC Burst < 3.0" },
  ];
  const metrics = [
    { name: "Plant Leg Extension", status: "scored", value: 66.12, unit: "degrees" },
    { name: "Release Speed", status: "scored", value: 436.58, unit: "mph" },
  ];
  const result = evaluateErrorRules(errors, metrics);

  it("triggers a true condition and names it from the `error` key", () => {
    expect(result[0]).toMatchObject({ name: "Rounding the break", triggered: true });
  });
  it("never triggers on an implausible metric value", () => {
    expect(result[1].triggered).toBe(false);
  });
  it("never triggers manual or missing-metric rules", () => {
    expect(result[2].triggered).toBe(false);
    expect(result[3].triggered).toBe(false);
  });
  it("does not trigger a false condition", () => {
    const r = evaluateErrorRules(errors.slice(1, 2), [{ name: "Release Speed", status: "scored", value: 7, unit: "mph" }]);
    expect(r[0].triggered).toBe(false);
  });
});

describe("low-quality feedback", () => {
  it("is the calm fixed message with no affected phases", () => {
    expect(buildLowQualityFeedback([])).toBe(LOW_QUALITY_FEEDBACK);
  });
});

describe("results parsing", () => {
  it("reads numeric elite targets and nested phase / calc type", () => {
    const [m] = parseMetricResults(
      [{ name: "Plant Leg Extension", elite_target: 140, keypoint_mapping: { phase_id: "p1", calculation_type: "angle" } }],
      [{ id: "p1", name: "Break" }],
    );
    expect(m.elite_target).toBe("140");
    expect(m.phase_name).toBe("Break");
    expect(m.calculation_type).toBe("angle");
  });
  it("drops legacy null entries and accepts objects and strings", () => {
    expect(parseDetectedErrors([null, "Body catch", { name: "Rounding the break", condition: "x < 1", metric_value: 0.5 }]).map((e) => e.name))
      .toEqual(["Body catch", "Rounding the break"]);
  });
  it("rounds scores for display", () => {
    expect(roundScore(51.89904837269462)).toBe("52");
  });
});
