import { describe, expect, it } from "vitest";
import { computeCategories } from "@/features/athlete-lab/components/NodeReadinessBar";
import type { EliteVideo, TrainingNode } from "@/features/athlete-lab/types";

const baseNode = {
  elite_videos: [], reference_calibrations: [], key_metrics: [], phase_breakdown: [], common_errors: [], badges: [], form_checkpoints: [],
  llm_prompt_template: "", overview: "", camera_guidelines: {},
} as unknown as TrainingNode;

const videoCategory = (videos: EliteVideo[]) =>
  computeCategories({ ...baseNode, elite_videos: videos }).find((c) => c.name === "Reference video");

describe("Videos tab readiness", () => {
  it("a missing Reference video is a warning only, never a counted check", () => {
    const cat = videoCategory([]);
    expect(cat?.checks).toHaveLength(1);
    expect(cat?.checks[0].pass).toBe(false);
    expect(cat?.checks[0].warning).toBe(true);
  });

  it("timestamps and camera angle no longer create checks", () => {
    const cat = videoCategory([{ url: "https://youtube.com/watch?v=x", label: "Teach tape", is_reference: true }]);
    expect(cat?.checks.map((c) => c.label)).toEqual(["Reference video for athletes"]);
    expect(cat?.checks[0].pass).toBe(true);
  });

  it("calibration check does not read video camera angles and is a warning", () => {
    const nodes = [[], [{ url: "u", label: "l", camera_angle: "endzone" as const }]];
    const labels = nodes.map((v) =>
      computeCategories({ ...baseNode, elite_videos: v }).find((c) => c.name === "Reference Calibration")?.checks.map((c) => c.label),
    );
    expect(labels[0]).toEqual(labels[1]);
  });
});
