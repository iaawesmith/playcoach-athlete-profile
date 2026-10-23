import { describe, expect, it } from "vitest";
import { computeCategories } from "@/features/athlete-lab/components/NodeReadinessBar";
import type { TrainingNode } from "@/features/athlete-lab/types";

const node = {
  key_metrics: [], elite_videos: [], reference_calibrations: [],
  llm_prompt_template: "", camera_guidelines: {}, form_checkpoints: [],
  segmentation_method: "checkpoint",
  phase_breakdown: [{ id: "stem", name: "Stem", proportion_weight: 100 }],
} as unknown as TrainingNode;

describe("Retired checkpoint configuration cannot gate proportional phase readiness", () => {
  it("saved checkpoint mode with no checkpoints passes with 100% phase weight", () => {
    const category = computeCategories(node).find((item) => item.name === "Phases & Structure");
    expect(category?.checks.filter((check) => !check.pass)).toHaveLength(1); // minimum 4 phases only
    expect(category?.checks).toHaveLength(2);
    expect(category?.checks[1].pass).toBe(true);
  });

  it("saved checkpoint mode cannot bypass an invalid proportion sum", () => {
    const invalid = { ...node, phase_breakdown: node.phase_breakdown.map((phase) => ({ ...phase, proportion_weight: 90 })) };
    const category = computeCategories(invalid).find((item) => item.name === "Phases & Structure");
    expect(category?.checks[1].pass).toBe(false);
  });
});