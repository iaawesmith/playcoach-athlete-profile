import { describe, expect, it } from "vitest";
import { checkCameraCompleteness, getRequiredBodyParts, parseCameraSettings, serializeCameraSettings } from "@/features/athlete-lab/components/CameraEditor";
import { computeCategories } from "@/features/athlete-lab/components/NodeReadinessBar";
import type { KeyMetric, TrainingNode } from "@/features/athlete-lab/types";

const baseNode = {
  elite_videos: [], reference_calibrations: [], key_metrics: [], phase_breakdown: [],
  common_errors: [], badges: [], form_checkpoints: [], llm_prompt_template: "",
  camera_guidelines: JSON.stringify({ camera_min_distance: 8, camera_max_distance: 15 }),
} as unknown as TrainingNode;

describe("Camera guidance", () => {
  it("preserves hidden FPS, resolution and auto-reject values when guidance is edited", () => {
    const saved = { camera_min_fps: 60, camera_min_resolution: "1080p", auto_reject_athlete_too_small: true, camera_filming_instructions: "Original" };
    const edited = parseCameraSettings(serializeCameraSettings({ ...parseCameraSettings(JSON.stringify(saved)), camera_filming_instructions: "Updated" }));
    expect(edited.camera_min_fps).toBe(60);
    expect(edited.camera_min_resolution).toBe("1080p");
    expect(edited.auto_reject_athlete_too_small).toBe(true);
    expect(edited.camera_filming_instructions).toBe("Updated");
  });

  it("preserves instructions in both JSON without FPS and legacy plain text", () => {
    expect(parseCameraSettings('{"camera_filming_instructions":"Film for 3 seconds"}').camera_filming_instructions).toBe("Film for 3 seconds");
    expect(parseCameraSettings("Film for 3 seconds").camera_filming_instructions).toBe("Film for 3 seconds");
  });

  it("derives visible body parts only from active metrics, including active by default", () => {
    const metrics = [
      { name: "Hip Stability", keypoint_mapping: { keypoint_indices: [23, 24] } },
      { name: "Plant Leg Extension", active: true, keypoint_mapping: { keypoint_indices: [25] } },
      { name: "Inactive Catch", active: false, keypoint_mapping: { keypoint_indices: [19, 20] } },
    ] as unknown as KeyMetric[];
    expect(getRequiredBodyParts(metrics).map((part) => part.indices)).toEqual([[23, 24], [25]]);
    expect(getRequiredBodyParts([metrics[2]])).toEqual([]);
  });

  it("distance alone determines Camera readiness, without FPS or resolution settings", () => {
    expect(checkCameraCompleteness(baseNode)).toEqual([]);
    const checks = computeCategories(baseNode).find((category) => category.name === "Camera")?.checks;
    expect(checks).toHaveLength(1);
    expect(checks?.[0].pass).toBe(true);
  });

  it("still rejects a missing or reversed distance range", () => {
    expect(checkCameraCompleteness({ ...baseNode, camera_guidelines: "{}" })).toHaveLength(1);
    expect(checkCameraCompleteness({ ...baseNode, camera_guidelines: '{"camera_min_distance":15,"camera_max_distance":8}' })).toHaveLength(1);
  });
});