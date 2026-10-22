import type { PipelinePhaseScore } from "../types";

export type PhaseStatus = "scored" | "no_active_metric" | "not_measurable";

export const PHASE_STATUS_REASON: Record<Exclude<PhaseStatus, "scored">, string> = {
  no_active_metric: "no active metric",
  not_measurable: "metric not measurable this run",
};

type PhaseRef = { id?: string | null; name: string };
type RunMetric = { phase_id?: string | null; keypoint_mapping?: { phase_id?: string | null } | null; active?: boolean };

const metricPhase = (m: RunMetric) => m.phase_id ?? m.keypoint_mapping?.phase_id ?? null;

/**
 * Every configured phase with its status for this run. A phase is
 * "not measurable" when the run evaluated at least one metric for it but
 * none scored; "no active metric" when the run had none for it.
 */
export function buildPhaseStatuses(
  phases: PhaseRef[],
  phaseScores: Record<string, number>,
  runMetrics: RunMetric[],
): PipelinePhaseScore[] {
  return phases.map((phase) => {
    const id = phase.id ?? phase.name;
    const raw = phaseScores[id];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return { id, name: phase.name, score: Math.round(raw), status: "scored", reason: null };
    }
    const hasMetric = runMetrics.some((m) => m.active !== false && metricPhase(m) === id);
    const status: PhaseStatus = hasMetric ? "not_measurable" : "no_active_metric";
    return { id, name: phase.name, score: null, status, reason: PHASE_STATUS_REASON[status] };
  });
}

/** Athlete-facing results show only phases with at least one scored metric. */
export function athleteVisiblePhases(phases: PipelinePhaseScore[]): PipelinePhaseScore[] {
  return phases.filter((p) => p.score !== null);
}
