import { describe, expect, it } from "vitest";
import { analyzerBuildLine } from "@/features/athlete-lab/utils/analysisLogReporting";

describe("analyzer build line", () => {
  it("shows the stamp date and its age at run time", () => {
    expect(analyzerBuildLine("498c118-2026-10-22", "2026-10-25T10:00:00Z")).toBe("Analyzer build: 498c118-2026-10-22 (stamped 2026-10-22, 3 days before this run)");
  });
  it("same-day stamp", () => {
    expect(analyzerBuildLine("498c118-2026-10-22", "2026-10-22T22:31:48Z")).toContain("same day as this run");
  });
  it("missing stamp", () => {
    expect(analyzerBuildLine(undefined, "2026-10-22")).toBe("Analyzer build: not recorded");
  });
});
