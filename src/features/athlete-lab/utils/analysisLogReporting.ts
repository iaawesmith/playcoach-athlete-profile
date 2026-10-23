import { measurementDescription, measurementFrames } from "../../../../supabase/functions/analyze-athlete-video/measurementWindow";
import type { AnalysisLogData, KeyMetric, PipelineMetricResult } from "../types";
import { describeAgainstTarget, formatMetricValue, metricValueContext } from "../../../../supabase/functions/analyze-athlete-video/scoring";

export const isOptionalLogVariable = (name: string): boolean =>
  ["focus_area", "skipped_metrics", "confidence_flags"].includes(name.replace(/^\{\{|\}\}$/g, "").trim());

/** Presentation only: never mutates a stored run or feeds back into scoring. */
export function buildAnalysisLogReporting(log: AnalysisLogData, nodeMetrics: KeyMetric[], results: PipelineMetricResult[]) {
  const active = nodeMetrics.filter((metric) => metric.active !== false);
  const activeIndices = new Set(active.flatMap((metric) => {
    const result = results.find((entry) => entry.name === metric.name);
    const decision = result?.detail?.bilateralDecision;
    const effective = decision && typeof decision === "object" && "effectiveIndices" in decision
      ? decision.effectiveIndices : undefined;
    return Array.isArray(effective) ? effective.filter((index): index is number => typeof index === "number")
      : metric.keypoint_mapping?.keypoint_indices ?? [];
  }));
  const warnings = (log.rtmlib?.keypoint_confidence ?? []).filter((kp) => {
    if (kp.status === "RELIABLE" || !activeIndices.has(kp.index)) return false;
    // The clip summary uses a global threshold; active metrics may use a lower
    // threshold and a reliable measurement window. Prefer those recorded checks.
    const usages = results.filter((result) => active.some((metric) => metric.name === result.name)).flatMap((result) => {
      const diagnostics = result.detail?.confidenceDiagnostics;
      if (!diagnostics || typeof diagnostics !== "object" || Array.isArray(diagnostics)) return [];
      const record = diagnostics as Record<string, unknown>;
      const averages = record.per_keypoint_avg_confidence;
      if (!averages || typeof averages !== "object" || !(String(kp.index) in averages)) return [];
      return [record];
    });
    return !usages.length || usages.some((usage) =>
      typeof usage.pass_ratio !== "number" || typeof usage.threshold !== "number" || usage.pass_ratio < usage.threshold);
  });
  const warningIndices = new Set(warnings.map((kp) => kp.index));
  const informational = (log.rtmlib?.keypoint_confidence ?? []).filter((kp) => kp.status !== "RELIABLE" && !warningIndices.has(kp.index));
  const metrics = (log.metrics ?? []).map((metric) => {
    const configured = nodeMetrics.find((entry) => entry.name === metric.name);
    const detail = results.find((entry) => entry.name === metric.name)?.detail;
    const frames = detail?.framesUsed ?? detail?.actualWindow;
    const calculationType = configured?.keypoint_mapping?.calculation_type ?? metric.calculation_type;
    const first = detail?.firstFrameIndex;
    const last = detail?.lastFrameIndex;
    const frameCount = calculationType === "velocity" && typeof first === "number" && typeof last === "number" && first >= 0 && last >= first
      ? last - first + 1
      : Array.isArray(frames) ? frames.length : typeof frames === "number" ? frames : metric.frames_evaluated;
    const result = results.find((entry) => entry.name === metric.name);
    const value = result?.value ?? metric.calculated_result;
    const target = result?.elite_target ?? metric.elite_target;
    return {
      ...metric,
      // Fixed per calculation type: the same constant the analyzer used.
      temporal_window: calculationType === "velocity" ? 0 : measurementFrames(calculationType) ?? metric.temporal_window,
      measurement_window: calculationType === "velocity"
        ? `Phase window, ${frameCount ?? "not recorded"} frames; minimum 3 elapsed frames`
        : measurementDescription(calculationType),
      frames_used: frameCount,
      ...(metric.unit === "ratio" ? {
        calculated_result: `${formatMetricValue(value, "ratio")}${metricValueContext(metric.name, "ratio")}`,
        elite_target: formatMetricValue(target, "ratio"),
        deviation: Number.isFinite(Number(value)) && Number.isFinite(Number(target)) ? `${Number((Math.abs(Number(value) - Number(target)) * 100).toFixed(2))} percentage points` : metric.deviation,
        against_target: Number.isFinite(Number(value)) && Number.isFinite(Number(target))
          ? describeAgainstTarget(Number(value), Number(target), configured?.tolerance, result?.target_direction ?? configured?.target_direction, "ratio") : metric.against_target,
        unit: "",
      } : {}),
    };
  });
  return { metrics, warnings, informational, activeIndices, warningIndices };
}
/** Build stamp line for the Analysis Log: shows the stamp's date and how old it was at run time. */
export function analyzerBuildLine(build: string | null | undefined, runAt?: string | null): string {
  if (!build) return "Analyzer build: not recorded";
  const m = /(\d{4}-\d{2}-\d{2})/.exec(build);
  if (!m) return `Analyzer build: ${build} (stamp date unknown)`;
  const stamp = m[1];
  const run = runAt ? runAt.slice(0, 10) : null;
  if (!run || !/^\d{4}-\d{2}-\d{2}$/.test(run)) return `Analyzer build: ${build} (stamped ${stamp})`;
  const days = Math.round((Date.parse(run) - Date.parse(stamp)) / 86_400_000);
  const age = days <= 0 ? "same day as this run" : `${days} day${days === 1 ? "" : "s"} before this run`;
  return `Analyzer build: ${build} (stamped ${stamp}, ${age})`;
}

type DecodeLog = {
  frame_cap?: number | null; frame_cap_reached?: boolean | null; frames_decoded?: number | null;
  achieved_fps?: number | null; clip_duration_s?: number | null; frames_requested?: number | null;
};
type RouteEventLog = { detected?: boolean; frame?: number; start?: number; end?: number; confidence?: number; reason?: string } | null | undefined;

/** "Frame cap 300 (10.0 s @ 30 fps) · decoded 240 · achieved 30.0 fps · clip 8.00 s · cap not reached" */
export function decodeLine(decode: DecodeLog | null | undefined, fps = 30): string {
  if (!decode || typeof decode.frame_cap !== "number") return "Decode: not recorded (pose service predates the frame cap)";
  const n = (v: number | null | undefined, d: number) => (typeof v === "number" ? v.toFixed(d) : "not recorded");
  const cap = decode.frame_cap_reached === true ? "cap reached" : decode.frame_cap_reached === false ? "cap not reached" : "cap status not recorded";
  return `Frame cap ${decode.frame_cap} (${(decode.frame_cap / fps).toFixed(1)} s @ ${fps} fps) · decoded ${decode.frames_decoded ?? "not recorded"} · achieved ${n(decode.achieved_fps, 1)} fps · clip ${n(decode.clip_duration_s, 2)} s · ${cap}`;
}

/** One line per detected event; null = this route/clip has no such event. */
export function routeEventLines(events: { snap?: RouteEventLog; break?: RouteEventLog; catch?: RouteEventLog } | null | undefined, fps = 30): string[] {
  if (!events) return [];
  const label = { snap: "Snap (first movement)", break: "Break", catch: "Catch" } as const;
  return (["snap", "break", "catch"] as const).map((key) => {
    const e = events[key];
    if (e === null) return `${label[key]}: not applicable ${key === "break" ? "(route has no break phase)" : "(clip has no catch)"}`;
    if (!e) return `${label[key]}: not recorded`;
    if (!e.detected) return `${label[key]}: NOT DETECTED (${e.reason ?? "unknown"}) — dependent metrics skipped`;
    const span = e.start !== undefined && e.end !== undefined && e.start !== e.end ? `, frames ${e.start}–${e.end}` : "";
    return `${label[key]}: frame ${e.frame} (${((e.frame ?? 0) / fps).toFixed(2)} s${span}), confidence ${e.confidence ?? "—"}`;
  });
}

export function phaseWindowLine(pw: { phase: string; start: number; end: number; frame_count: number; percent: number; not_measured?: string }): string {
  if (pw.not_measured) return `${pw.phase}: no window — ${pw.not_measured}`;
  return `${pw.phase}: frames ${pw.start} to ${pw.end} (${pw.frame_count} frames, ${pw.percent}%)`;
}
