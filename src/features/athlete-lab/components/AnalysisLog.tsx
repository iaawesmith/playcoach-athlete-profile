import { useState, useRef } from "react";
import type { AnalysisLogData } from "../types";

type CopyState = "idle" | "success" | "error";

interface AnalysisLogProps {
  logData: AnalysisLogData | null | undefined;
  nodeName: string;
  hasResult: boolean;
}

type LogStatus = "PASS" | "WARN" | "ERROR";

const STATUS_COLORS: Record<LogStatus, string> = {
  PASS: "#22c55e",
  WARN: "#f59e0b",
  ERROR: "#ef4444",
};

function statusIcon(status: LogStatus) {
  return status === "PASS" ? "check_circle" : status === "WARN" ? "warning" : "error";
}

function statusBadge(status: LogStatus) {
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: STATUS_COLORS[status] }}>
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{statusIcon(status)}</span>
      {status}
    </span>
  );
}

function deriveOverallStatus(logData: AnalysisLogData): LogStatus {
  const poseEngineLog = logData.rtmlib;
  if (logData.preflight?.checks?.some(c => c.result === "FAIL")) return "ERROR";
  if (logData.claude_api?.status === "FAILED") return "ERROR";
  if (poseEngineLog?.keypoint_confidence?.some(kp => kp.status === "UNRELIABLE")) return "WARN";
  if (logData.metrics?.some(m => m.status === "SKIPPED" || m.status === "FLAGGED")) return "WARN";
  if (logData.preflight?.checks?.some(c => c.result === "WARN")) return "WARN";
  return "PASS";
}

function deriveSectionStatus(section: string, logData: AnalysisLogData): LogStatus {
  switch (section) {
    case "scoring_config": {
      const sc = logData.scoring_config;
      // Missing scoring_config means the edge function failed to surface
      // observability for the run. The whole point of Section 0 is to PROVE
      // scoring config was read correctly — absence is a signal, not silent
      // success. Force WARN so admins notice.
      if (!sc) return "WARN";
      if (sc.skipped_percent > sc.min_metrics_threshold) return "ERROR";
      if (sc.flagged_count > 0 || sc.skipped_count > 0) return "WARN";
      return "PASS";
    }
    case "preflight": {
      const checks = logData.preflight?.checks ?? [];
      if (checks.some(c => c.result === "FAIL")) return "ERROR";
      if (checks.some(c => c.result === "WARN")) return "WARN";
      return "PASS";
    }
    case "pose_engine": {
      const kps = logData.rtmlib?.keypoint_confidence ?? [];
      if (kps.some(kp => kp.status === "UNRELIABLE")) return "WARN";
      if (kps.some(kp => kp.status === "MARGINAL")) return "WARN";
      return "PASS";
    }
    case "metrics": {
      const metrics = logData.metrics ?? [];
      if (metrics.some(m => m.status === "SKIPPED")) return "WARN";
      if (metrics.some(m => m.status === "FLAGGED")) return "WARN";
      return "PASS";
    }
    case "errors": {
      return "PASS";
    }
    case "claude": {
      if (logData.claude_api?.status === "FAILED") return "ERROR";
      if (logData.claude_api?.missing_variables?.length) return "WARN";
      return "PASS";
    }
    default: return "PASS";
  }
}

function CollapsibleSection({ title, status, defaultOpen = false, children }: {
  title: string;
  status: LogStatus;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-outline-variant/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-surface-container-high hover:bg-surface-container-highest transition-colors text-left"
      >
        <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 14, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          expand_more
        </span>
        <span className="text-on-surface text-xs font-bold uppercase tracking-widest flex-1">{title}</span>
        {statusBadge(status)}
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? "2000px" : "0px", opacity: open ? 1 : 0 }}
      >
        <div className="px-4 py-4 space-y-3 bg-surface-container">
          {children}
        </div>
      </div>
    </div>
  );
}

const MONO = "font-mono text-[11px]";
const DIM = "text-on-surface-variant/70";

function CheckRow({ check }: { check: AnalysisLogData["preflight"]["checks"][0] }) {
  const icon = check.result === "PASS" ? "✅" : check.result === "WARN" ? "⚠️" : "❌";
  const color = check.result === "PASS" ? STATUS_COLORS.PASS : check.result === "WARN" ? STATUS_COLORS.WARN : STATUS_COLORS.ERROR;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <span className="text-on-surface text-xs font-semibold">{check.name}</span>
        <span className="text-[10px] font-bold uppercase" style={{ color }}>{check.result}</span>
      </div>
      <div className={`${MONO} ${DIM} pl-7 space-y-0.5`}>
        <div>Expected: {check.expected}</div>
        <div>Actual: {check.actual}</div>
      </div>
    </div>
  );
}

function generateLogMarkdown(logData: AnalysisLogData, nodeName: string): string {
  const overall = deriveOverallStatus(logData);
  const ts = logData.timestamp ?? new Date().toISOString();
  let md = `# AthleteLab Analysis Log\n# Node: ${nodeName}\n# Timestamp: ${ts}\n# Overall Status: ${overall}\n\n---\n\n`;

  // Scoring Configuration (Section 0)
  md += `## Scoring Configuration\n\n`;
  const sc = logData.scoring_config;
  if (sc) {
    md += `Confidence handling: ${sc.confidence_handling}\nRenormalize on skip: ${sc.renormalize_on_skip ? "Yes" : "No"}\nMin metrics threshold: ${sc.min_metrics_threshold}%\nSkipped vs threshold: ${sc.skipped_percent}% / ${sc.min_metrics_threshold}%\nMetric outcomes: ${sc.scored_count} scored · ${sc.flagged_count} flagged · ${sc.skipped_count} skipped of ${sc.total_metrics}\n\n---\n\n`;
  } else {
    md += `⚠️ scoring_config missing from log_data — admin observability gap.\n\n---\n\n`;
  }

  // Preflight
  md += `## Pre-Flight Validation\n\n`;
  for (const c of logData.preflight?.checks ?? []) {
    const icon = c.result === "PASS" ? "✅" : c.result === "WARN" ? "⚠️" : "❌";
    md += `${icon} ${c.name}\n  Expected: ${c.expected}\n  Actual: ${c.actual}\n  Result: ${c.result}\n\n`;
  }
  if (logData.preflight?.pipeline_stopped) {
    md += `🛑 PIPELINE STOPPED — ${logData.preflight.stop_reason}\n\n`;
  }

  // Pose Engine Output
  md += `---\n\n## Pose Engine Output\n\n`;
  const r = logData.rtmlib;
  if (r) {
    md += `Solution Class: ${r.solution_class ?? "N/A"}\nModel: ${r.model ?? "N/A"}\nBackend: ${r.backend ?? "N/A"}\nTotal frames: ${r.total_frames ?? "N/A"}\nSource FPS: ${r.source_fps ?? "N/A"}\nProcessing time: ${r.processing_time_ms ?? "N/A"}ms\n\n`;
    if (r.phase_windows?.length) {
      md += `Phase Frame Windows:\n`;
      for (const pw of r.phase_windows) {
        md += `  ${pw.phase}: frames ${pw.start} to ${pw.end} (${pw.frame_count} frames, ${pw.percent}%)\n`;
      }
      md += "\n";
    }
    if (r.keypoint_confidence?.length) {
      md += `Keypoint Confidence Summary:\n`;
      for (const kp of r.keypoint_confidence) {
        md += `  Index ${kp.index} — ${kp.name}:\n    Mean: ${kp.mean_confidence}\n    Min: ${kp.min_confidence} (frame ${kp.min_frame})\n    Below threshold: ${kp.frames_below} of ${kp.total_frames} (${kp.percent_below}%)\n    Status: ${kp.status}\n\n`;
      }
    }
  }

  // Metrics
  md += `---\n\n## Metric Calculations\n\n`;
  for (const m of logData.metrics ?? []) {
    md += `### ${m.name} (${m.weight}%)\nPhase: ${m.phase}\nFrames: ${m.frames_evaluated} (${m.frame_range})\nKeypoints: ${m.keypoints}\nCalc type: ${m.calculation_type}\nTemporal window: ${m.temporal_window} frames\nRaw value: ${m.calculated_result} ${m.unit}\nElite target: ${m.elite_target}\nDeviation: ${m.deviation}\nRaw score: ${m.raw_score}\nWeighted contribution: ${m.weighted_contribution}\nStatus: ${m.status}${m.skip_reason ? `\nReason: ${m.skip_reason}` : ""}\n\n`;
  }
  if (logData.aggregate) {
    md += `AGGREGATE:\n  Total Mastery Score: ${logData.aggregate.mastery_score}/100\n  Confidence-adjusted: ${logData.aggregate.confidence_adjusted ? "Yes" : "No"}\n  Metrics skipped: ${logData.aggregate.metrics_skipped} of ${logData.aggregate.metrics_total}\n\n`;
  }

  // Errors
  md += `---\n\n## Error Detection\n\n`;
  for (const e of logData.error_detection ?? []) {
    md += `### ${e.name}\nAuto-detectable: ${e.auto_detectable ? "Yes" : "No"}\nCondition: ${e.condition}\nMetric value: ${e.metric_value}\nResult: ${e.triggered ? "TRIGGERED" : "NOT TRIGGERED"}\n\n`;
  }

  // Claude
  md += `---\n\n## Claude API\n\n`;
  const c = logData.claude_api;
  if (c) {
    md += `Model: ${c.model ?? "N/A"}\nSystem instructions: ${c.system_instructions_present ? "PRESENT" : "NOT CONFIGURED"} (${c.system_instructions_chars ?? 0} chars)\n\n`;
    if (c.variables_injected?.length) {
      md += `Variables injected:\n`;
      for (const v of c.variables_injected) {
        md += `  ${v.name}: ${v.value_summary} ${v.present ? "✅" : "⚠️"}\n`;
      }
      md += "\n";
    }
    md += `Tokens:\n  Prompt: ${c.prompt_tokens ?? "N/A"}\n  Response: ${c.response_tokens ?? "N/A"}\n  Total: ${c.total_tokens ?? "N/A"}\n\nWord count: ${c.word_count ?? "N/A"} (target: ${c.target_words ?? "N/A"})\nStatus: ${c.status ?? "N/A"}\n`;
  }

  // Summary
  md += `\n---\n\nQUICK SUMMARY FOR AI REVIEW:\n`;
  md += `Mastery Score: ${logData.aggregate?.mastery_score ?? "N/A"}/100\n`;
  md += `Metrics scored: ${(logData.aggregate?.metrics_total ?? 0) - (logData.aggregate?.metrics_skipped ?? 0)} of ${logData.aggregate?.metrics_total ?? 0}\n`;
  md += `Metrics skipped: ${logData.aggregate?.metrics_skipped ?? 0}\n`;
  md += `Errors triggered: ${logData.error_detection?.filter(e => e.triggered).length ?? 0}\n`;
  md += `Confidence warnings: ${logData.rtmlib?.keypoint_confidence?.filter(kp => kp.status !== "RELIABLE").length ?? 0}\n`;
  md += `Pipeline status: ${overall}\n`;

  return md;
}

export function AnalysisLog({ logData, nodeName, hasResult }: AnalysisLogProps) {
  const [expanded, setExpanded] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();

  const showEmptyState = !hasResult || !logData;

  if (showEmptyState) {
    return (
      <div className="bg-surface-container rounded-xl border border-white/5 overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-surface-container-high transition-colors text-left"
        >
          <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: 14, transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
            expand_more
          </span>
          <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: 18 }}>description</span>
          <span className="text-on-surface-variant/50 text-[10px] font-bold uppercase tracking-[0.3em] flex-1">
            {hasResult ? "Analysis Log — Log data not available" : "Analysis Log — Waiting for analysis..."}
          </span>
        </button>
        <div
          className="overflow-hidden transition-all duration-300"
          style={{ maxHeight: expanded ? "400px" : "0px", opacity: expanded ? 1 : 0 }}
        >
          <div className="px-5 pb-6 pt-2 flex flex-col items-center text-center space-y-4">
            <span className="material-symbols-outlined text-on-surface-variant/20" style={{ fontSize: 40 }}>bar_chart</span>
            <div>
              <div className="text-on-surface-variant text-sm font-semibold mb-1">
                {hasResult ? "Log data not available" : "No analysis run yet"}
              </div>
              <p className="text-on-surface-variant/60 text-xs max-w-md">
                {hasResult
                  ? "Edge Function must return log_data in results payload for the full pipeline log to appear here."
                  : "Run a video above to see the full pipeline log here — including pose engine output, metric calculations, confidence scores, error detection results, and Claude API details."}
              </p>
            </div>
            <div className="space-y-2 w-full max-w-xs">
              {["Pre-Flight Validation", "Pose Engine Output", "Metric Calculations", "Error Detection", "Claude API"].map((label) => (
                <div key={label} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-container-high/50">
                  <span className="text-on-surface-variant/20 text-sm">○</span>
                  <span className="text-on-surface-variant/30 text-[10px] font-semibold uppercase tracking-widest">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const overall = deriveOverallStatus(logData);
  const ts = logData.timestamp ? new Date(logData.timestamp).toLocaleString() : "N/A";

  const handleCopy = async () => {
    try {
      const md = generateLogMarkdown(logData, nodeName);
      await navigator.clipboard.writeText(md);
      setCopyState("success");
    } catch {
      setCopyState("error");
    }
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyState("idle"), 2000);
  };

  return (
    <div className="bg-surface-container rounded-xl border border-white/5 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-surface-container-high transition-colors text-left"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: STATUS_COLORS[overall], transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          expand_more
        </span>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: STATUS_COLORS[overall] }}>
          {statusIcon(overall)}
        </span>
        <span className="text-on-surface text-[10px] font-bold uppercase tracking-[0.3em] flex-1">
          Analysis Log — {ts} — <span style={{ color: STATUS_COLORS[overall] }}>{overall}</span>
        </span>
      </button>

      {/* Expanded content */}
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: expanded ? "10000px" : "0px", opacity: expanded ? 1 : 0 }}
      >
        <div className="px-5 pb-5 space-y-3">
          {/* Copy Log button */}
          <div className="flex justify-end">
            <button
              onClick={handleCopy}
              className={`h-8 px-4 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5 transition-all active:scale-95 border ${
                copyState === "success"
                  ? "border-[#22c55e]/40 text-[#22c55e]"
                  : copyState === "error"
                  ? "border-[#ef4444]/40 text-[#ef4444]"
                  : "border-outline-variant/20 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
              }`}
              title={copyState === "error" ? "Copy failed — check clipboard permissions" : "Copy full analysis log"}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                {copyState === "success" ? "check_circle" : copyState === "error" ? "error" : "content_copy"}
              </span>
              {copyState === "success" ? "Copied!" : copyState === "error" ? "Failed" : "Copy Log"}
            </button>
          </div>

          {/* Section 1: Pre-Flight */}
          <CollapsibleSection title="1. Pre-Flight Validation" status={deriveSectionStatus("preflight", logData)}>
            {logData.preflight?.checks?.length ? (
              <div className="space-y-3">
                {logData.preflight.checks.map((c, i) => <CheckRow key={i} check={c} />)}
                {logData.preflight.pipeline_stopped && (
                  <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <span className="text-red-400 text-xs font-bold uppercase">Pipeline Stopped — {logData.preflight.stop_reason}</span>
                  </div>
                )}
              </div>
            ) : (
              <span className={`${MONO} ${DIM}`}>No preflight data</span>
            )}
          </CollapsibleSection>

          {/* Section 2: Pose Engine */}
          <CollapsibleSection title="2. Pose Engine Output" status={deriveSectionStatus("pose_engine", logData)}>
            {logData.rtmlib ? (
              <div className="space-y-4">
                <div className={`${MONO} space-y-1`}>
                  <div className="text-on-surface">Solution Class: {logData.rtmlib.solution_class ?? "N/A"}</div>
                  <div className="text-on-surface">Model: {logData.rtmlib.model ?? "N/A"}</div>
                  <div className="text-on-surface">Backend: {logData.rtmlib.backend ?? "N/A"}</div>
                  <div className="text-on-surface">Total frames: {logData.rtmlib.total_frames ?? "N/A"}</div>
                  <div className="text-on-surface">Source FPS: {logData.rtmlib.source_fps ?? "N/A"}</div>
                  <div className="text-on-surface">Processing time: {logData.rtmlib.processing_time_ms ?? "N/A"}ms</div>
                </div>

                {logData.rtmlib.phase_windows?.length ? (
                  <div>
                    <div className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-widest mb-2">Phase Frame Windows</div>
                    <div className="space-y-1">
                      {logData.rtmlib.phase_windows.map((pw, i) => (
                        <div key={i} className={`${MONO} text-on-surface`}>
                          {pw.phase}: frames {pw.start} to {pw.end} ({pw.frame_count} frames, {pw.percent}%)
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {logData.rtmlib.keypoint_confidence?.length ? (
                  <div>
                    <div className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-widest mb-2">Keypoint Confidence Summary</div>
                    <div className="space-y-3">
                      {logData.rtmlib.keypoint_confidence.map((kp, i) => {
                        const kpColor = kp.status === "RELIABLE" ? STATUS_COLORS.PASS : kp.status === "MARGINAL" ? STATUS_COLORS.WARN : STATUS_COLORS.ERROR;
                        return (
                          <div key={i} className={`${MONO} space-y-0.5`}>
                            <div className="flex items-center gap-2">
                              <span className="text-on-surface font-semibold">Index {kp.index} — {kp.name}</span>
                              <span className="text-[9px] font-bold uppercase" style={{ color: kpColor }}>{kp.status}</span>
                            </div>
                            <div className={`${DIM} pl-4 space-y-0.5`}>
                              <div>Mean confidence: {kp.mean_confidence}</div>
                              <div>Min confidence: {kp.min_confidence} (frame {kp.min_frame})</div>
                              <div>Below threshold: {kp.frames_below} of {kp.total_frames} ({kp.percent_below}%)</div>
                            </div>
                            {kp.percent_below > 20 && (
                              <div className="flex items-start gap-1.5 mt-1 pl-4">
                                <span style={{ color: STATUS_COLORS.WARN }}>⚠</span>
                                <span className="text-[11px]" style={{ color: STATUS_COLORS.WARN }}>
                                  Index {kp.index} ({kp.name}) was below confidence threshold on {kp.percent_below}% of frames — metrics using this keypoint may be unreliable
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <span className={`${MONO} ${DIM}`}>No pose engine data</span>
            )}
          </CollapsibleSection>

          {/* Section 3: Metric Calculations */}
          <CollapsibleSection title="3. Metric Calculations" status={deriveSectionStatus("metrics", logData)}>
            {logData.metrics?.length ? (
              <div className="space-y-5">
                {logData.metrics.map((m, i) => {
                  const mColor = m.status === "SCORED" ? STATUS_COLORS.PASS : m.status === "FLAGGED" ? STATUS_COLORS.WARN : STATUS_COLORS.ERROR;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-on-surface text-xs font-bold">{m.name} ({m.weight}%)</span>
                        <span className="text-[9px] font-bold uppercase" style={{ color: mColor }}>{m.status}</span>
                      </div>
                      <div className={`${MONO} ${DIM} pl-4 space-y-0.5`}>
                        <div>Phase: {m.phase}</div>
                        <div>Frames: {m.frames_evaluated} ({m.frame_range})</div>
                        <div>Keypoints: {m.keypoints}</div>
                        <div>Calc type: {m.calculation_type}</div>
                        <div>Temporal window: {m.temporal_window} frames</div>
                        {m.extracted_values && <div>Extracted values: [{m.extracted_values}]</div>}
                        <div>Result: {m.calculated_result} {m.unit}</div>
                        <div>Elite target: {m.elite_target}</div>
                        <div>Deviation: {m.deviation}</div>
                        <div>Raw score: {m.raw_score}</div>
                        <div>Weighted contribution: {m.weighted_contribution}</div>
                        {m.skip_reason && <div className="text-[#f59e0b]">Reason: {m.skip_reason}</div>}
                      </div>
                    </div>
                  );
                })}

                {logData.aggregate && (
                  <div className="mt-4 p-3 rounded-lg border border-outline-variant/10 bg-surface-container-high">
                    <div className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-widest mb-2">Aggregate Score Calculation</div>
                    <div className={`${MONO} space-y-1`}>
                      {logData.metrics.map((m, i) => (
                        <div key={i} className="text-on-surface">{m.name}: {m.weighted_contribution}</div>
                      ))}
                      <div className="border-t border-outline-variant/10 pt-1 mt-2">
                        <div className="text-on-surface font-bold">Total Mastery Score: {logData.aggregate.mastery_score}/100</div>
                        <div className={DIM}>Confidence-adjusted: {logData.aggregate.confidence_adjusted ? "Yes" : "No"}</div>
                        <div className={DIM}>Metrics skipped: {logData.aggregate.metrics_skipped} of {logData.aggregate.metrics_total}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <span className={`${MONO} ${DIM}`}>No metric data</span>
            )}
          </CollapsibleSection>

          {/* Section 4: Error Detection */}
          <CollapsibleSection title="4. Error Detection" status={deriveSectionStatus("errors", logData)}>
            {logData.error_detection?.length ? (
              <div className="space-y-4">
                {logData.error_detection.map((e, i) => (
                  <div key={i} className="space-y-1">
                    <div className="text-on-surface text-xs font-bold">{e.name}</div>
                    <div className={`${MONO} ${DIM} pl-4 space-y-0.5`}>
                      <div>Auto-detectable: {e.auto_detectable ? "Yes" : "No"}</div>
                      <div>Condition: {e.condition}</div>
                      <div>Metric value: {e.metric_value}</div>
                      <div>Evaluated: {e.evaluation_expression}</div>
                      <div className="flex items-center gap-2">
                        Result: <span style={{ color: e.triggered ? STATUS_COLORS.PASS : STATUS_COLORS.WARN }}>{e.triggered ? "TRIGGERED" : "NOT TRIGGERED"}</span>
                      </div>
                    </div>
                    <div className={`${MONO} pl-4`}>
                      {e.triggered ? (
                        <span style={{ color: STATUS_COLORS.PASS }}>✅ Confirmed error — passed to Claude as observed fact</span>
                      ) : (
                        <span className={DIM}>➖ Not detected — passed to Claude as potential issue for context</span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="mt-2 p-3 rounded-lg border border-outline-variant/10 bg-surface-container-high">
                  <div className={`${MONO} space-y-1`}>
                    <div className="text-on-surface">Errors triggered: {logData.error_detection.filter(e => e.triggered).length} of {logData.error_detection.length}</div>
                    <div className={DIM}>As facts: {logData.error_detection.filter(e => e.triggered).map(e => e.name).join(", ") || "None"}</div>
                    <div className={DIM}>As context: {logData.error_detection.filter(e => !e.triggered).map(e => e.name).join(", ") || "None"}</div>
                  </div>
                </div>
              </div>
            ) : (
              <span className={`${MONO} ${DIM}`}>No error detection data</span>
            )}
          </CollapsibleSection>

          {/* Section 5: Claude API */}
          <CollapsibleSection title="5. Claude API" status={deriveSectionStatus("claude", logData)}>
            {logData.claude_api ? (
              <div className="space-y-4">
                <div className={`${MONO} space-y-1`}>
                  <div className="text-on-surface">Model: {logData.claude_api.model ?? "N/A"}</div>
                  <div className="text-on-surface">
                    System instructions: {logData.claude_api.system_instructions_present ? "PRESENT" : "NOT CONFIGURED"} ({logData.claude_api.system_instructions_chars ?? 0} chars)
                  </div>
                </div>

                {logData.claude_api.variables_injected?.length ? (
                  <div>
                    <div className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-widest mb-2">Template Variables</div>
                    <div className={`${MONO} space-y-1`}>
                      {logData.claude_api.variables_injected.map((v, i) => (
                        <div key={i} className="text-on-surface">
                          {v.name}: {v.value_summary} {v.present ? "✅" : "⚠️"}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {logData.claude_api.missing_variables?.length ? (
                  <div className="space-y-1">
                    {logData.claude_api.missing_variables.map((v, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span style={{ color: STATUS_COLORS.WARN }}>⚠</span>
                        <span className="text-[11px]" style={{ color: STATUS_COLORS.WARN }}>{v}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div>
                  <div className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-widest mb-2">Token Usage</div>
                  <div className={`${MONO} ${DIM} space-y-0.5`}>
                    <div>Prompt tokens: {logData.claude_api.prompt_tokens ?? "N/A"}</div>
                    <div>System tokens: {logData.claude_api.system_tokens ?? "N/A"}</div>
                    <div>Template tokens: {logData.claude_api.template_tokens ?? "N/A"}</div>
                    <div>Variable data tokens: {logData.claude_api.variable_tokens ?? "N/A"}</div>
                    <div>Response tokens: {logData.claude_api.response_tokens ?? "N/A"}</div>
                    <div className="text-on-surface font-semibold">Total tokens: {logData.claude_api.total_tokens ?? "N/A"}</div>
                  </div>
                </div>

                <div className={`${MONO} space-y-1`}>
                  <div className="text-on-surface">Word count: {logData.claude_api.word_count ?? "N/A"} (target: {logData.claude_api.target_words ?? "N/A"})</div>
                  <div className="text-on-surface">Truncated: {logData.claude_api.truncated ? "Yes" : "No"}</div>
                  <div className="flex items-center gap-2 text-on-surface">
                    Status: <span style={{ color: logData.claude_api.status === "COMPLETE" ? STATUS_COLORS.PASS : STATUS_COLORS.ERROR }}>{logData.claude_api.status} {logData.claude_api.status === "COMPLETE" ? "✅" : "❌"}</span>
                  </div>
                </div>
              </div>
            ) : (
              <span className={`${MONO} ${DIM}`}>No Claude API data</span>
            )}
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}
