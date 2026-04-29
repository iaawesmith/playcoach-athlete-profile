import { useState, useMemo, useRef } from "react";
import type { TrainingNode } from "../types";
import { checkCameraCompleteness } from "./CameraEditor";
import { migrateCheckpoints } from "./CheckpointsEditor";
import { generateFullNodeMarkdown } from "../utils/nodeExport";

type TabKey = "basics" | "videos" | "metrics" | "scoring" | "errors" | "phases" | "reference" | "camera" | "checkpoints" | "prompt" | "badges" | "training_status" | "test";

interface ReadinessCheck {
  label: string;
  pass: boolean;
  warning?: boolean; // amber warning, doesn't block
}

interface ReadinessCategory {
  name: string;
  icon: string;
  weight: number;
  checks: ReadinessCheck[];
  tab: TabKey;
  tooltip: string;
}

export function computeCategories(node: TrainingNode): ReadinessCategory[] {
  const categories: ReadinessCategory[] = [];

  // Active-only metrics (inactive ones are preserved in storage but excluded from readiness/scoring)
  const allMetrics = node.key_metrics ?? [];
  const activeMetrics = allMetrics.filter((m) => m.active !== false);
  const inactiveCount = allMetrics.length - activeMetrics.length;

  // 1. METRICS & KEYPOINTS — 25%
  const metricsChecks: ReadinessCheck[] = [];
  const activeCountLabel = inactiveCount > 0
    ? `${activeMetrics.length} active metrics scored, ${inactiveCount} inactive metric${inactiveCount > 1 ? "s" : ""} excluded from scoring`
    : `${activeMetrics.length} active metrics defined (min 4)`;
  metricsChecks.push({ label: activeCountLabel, pass: activeMetrics.length >= 4 });
  const metricWeightSum = activeMetrics.reduce((s, m) => s + m.weight, 0);
  metricsChecks.push({ label: `Active weights sum to ${metricWeightSum}% (must be 100%)`, pass: metricWeightSum === 100 });
  const allMapped = activeMetrics.every(m => m.keypoint_mapping?.calculation_type && (m.keypoint_mapping?.keypoint_indices?.length ?? 0) > 0);
  metricsChecks.push({ label: "All active metrics have keypoint mapping", pass: allMapped });
  const allPhased = activeMetrics.every(m => m.keypoint_mapping?.phase_id);
  metricsChecks.push({ label: "All active metrics have phase assigned", pass: allPhased });
  // Phase reference resolution — catches orphaned phase_ids from deleted phases
  const phaseIds = new Set((node.phase_breakdown ?? []).map(p => p.id));
  const orphanedRefs = activeMetrics.filter(m =>
    m.keypoint_mapping?.phase_id && !phaseIds.has(m.keypoint_mapping.phase_id)
  );
  const phaseRefsValid = orphanedRefs.length === 0;
  metricsChecks.push({
    label: phaseRefsValid
      ? "All metric phase references resolve to existing phases"
      : `${orphanedRefs.length} metric${orphanedRefs.length > 1 ? "s" : ""} reference deleted phase(s): ${orphanedRefs.map(m => m.name || "Untitled").join(", ")}`,
    pass: phaseRefsValid,
  });
  // Keypoint counts valid
  let kpCountsValid = true;
  for (const m of activeMetrics) {
    const km = m.keypoint_mapping;
    if (!km) continue;
    const count = km.keypoint_indices.length;
    if (km.calculation_type === "angle" && count !== 3) kpCountsValid = false;
    else if ((km.calculation_type === "distance" || km.calculation_type === "frame_delta") && count !== 2) kpCountsValid = false;
    else if ((km.calculation_type === "velocity" || km.calculation_type === "acceleration") && (count < 1 || count > 2)) kpCountsValid = false;
    else if (km.calculation_type === "distance_variance" && count !== 2) kpCountsValid = false;
  }
  metricsChecks.push({ label: "Keypoint counts valid for calculation types", pass: kpCountsValid });
  // Temporal windows
  let twValid = true;
  for (const m of activeMetrics) {
    const km = m.keypoint_mapping;
    if (!km) continue;
    const tw = m.temporal_window ?? 1;
    if (km.calculation_type === "velocity" && tw < 3) twValid = false;
    else if (km.calculation_type === "acceleration" && tw < 5) twValid = false;
    else if (km.calculation_type === "frame_delta" && tw < 10) twValid = false;
    else if (km.calculation_type === "distance_variance" && tw < 5) twValid = false;
  }
  metricsChecks.push({ label: "Temporal windows compatible", pass: twValid });
  categories.push({
    name: "Metrics & Keypoints", icon: "analytics", weight: 25, checks: metricsChecks, tab: "metrics",
    tooltip: "Highest priority — the pipeline has no instructions for what to measure without complete keypoint mappings."
  });

  // 2. TRAINING STATUS — 20%
  const tsChecks: ReadinessCheck[] = [];
  const scConfigured = !!node.solution_class && node.solution_class.trim().length > 0;
  tsChecks.push({ label: scConfigured ? `Solution class: ${node.solution_class}` : "Solution class not configured", pass: scConfigured });
  let scSupportsAll = true;
  if (scConfigured) {
    const sc = node.solution_class;
    for (const m of activeMetrics) {
      const indices = m.keypoint_mapping?.keypoint_indices ?? [];
      if (sc === "body" && indices.some(i => i >= 17)) { scSupportsAll = false; break; }
      if (sc === "body_with_feet" && indices.some(i => i >= 91)) { scSupportsAll = false; break; }
    }
  }
  tsChecks.push({ label: "Solution class supports all keypoint indices", pass: scSupportsAll });
  categories.push({
    name: "Training Status", icon: "memory", weight: 20, checks: tsChecks, tab: "training_status",
    tooltip: "The pose engine will not instantiate correctly without a configured model. Keypoint mismatch causes silent empty arrays."
  });

  // 3. PHASES & STRUCTURE — 15%
  const phaseChecks: ReadinessCheck[] = [];
  phaseChecks.push({ label: `${node.phase_breakdown.length} phases defined (min 4)`, pass: node.phase_breakdown.length >= 4 });
  const segMethod = node.segmentation_method ?? "proportional";
  if (segMethod === "proportional" && node.phase_breakdown.length > 0) {
    const phaseWeightSum = node.phase_breakdown.reduce((s, p) => s + (p.proportion_weight ?? 0), 0);
    phaseChecks.push({ label: `Phase weights sum to ${phaseWeightSum}% (must be 100%)`, pass: phaseWeightSum === 100 });
  } else {
    phaseChecks.push({ label: "Phase weights sum to 100%", pass: true });
  }
  phaseChecks.push({ label: `Segmentation method: ${segMethod}`, pass: true });
  // Checkpoint check if checkpoint-triggered
  if (segMethod === "checkpoint") {
    const cps = migrateCheckpoints(node.form_checkpoints);
    phaseChecks.push({ label: "Checkpoints defined for checkpoint segmentation", pass: cps.length > 0 });
  }
  categories.push({
    name: "Phases & Structure", icon: "timeline", weight: 15, checks: phaseChecks, tab: "phases",
    tooltip: "Incorrect phase weights cause metrics to be evaluated on the wrong frames."
  });

  // 4. VIDEOS & REFERENCE — 15%
  const videoChecks: ReadinessCheck[] = [];
  const vids = node.elite_videos ?? [];
  const configuredVids = vids.filter(v => v.url && v.url.trim().length > 0);
  videoChecks.push({ label: `${configuredVids.length} video(s) configured`, pass: configuredVids.length >= 1 });
  const allTimestamps = configuredVids.every(v => v.start_seconds != null && v.end_seconds != null);
  videoChecks.push({ label: "All videos have timestamps", pass: allTimestamps || configuredVids.length === 0 });
  const hasRef = configuredVids.some(v => v.is_reference);
  videoChecks.push({ label: "Reference video flagged", pass: hasRef || configuredVids.length === 0 });
  // Calibration check
  if (node.solution_class !== "wholebody3d") {
    const cals = node.reference_calibrations ?? [];
    const hasAtLeastOne = cals.some(c => c.pixels_per_yard != null && c.pixels_per_yard > 0);
    videoChecks.push({ label: "At least 1 camera angle calibrated", pass: hasAtLeastOne });
  } else {
    videoChecks.push({ label: "Reference not required — 3D pose engine node", pass: true, warning: true });
  }
  categories.push({
    name: "Videos & Reference", icon: "video_library", weight: 15, checks: videoChecks, tab: "videos",
    tooltip: "Missing timestamps causes the pose engine to process the entire video including non-skill footage."
  });

  // 5. LLM PROMPT — 10%
  const llmChecks: ReadinessCheck[] = [];
  const promptNotEmpty = !!node.llm_prompt_template && node.llm_prompt_template.trim().length > 0;
  llmChecks.push({ label: promptNotEmpty ? "Prompt template configured" : "Prompt is empty", pass: promptNotEmpty });
  const hasVars = /\{\{.+?\}\}/.test(node.llm_prompt_template || "");
  const hasMastery = /\{\{mastery_score\}\}/.test(node.llm_prompt_template || "");
  const hasMetricResults = /\{\{metric_results\}\}/.test(node.llm_prompt_template || "");
  llmChecks.push({ label: "{{mastery_score}} present", pass: hasMastery, warning: !hasMastery && promptNotEmpty });
  llmChecks.push({ label: "{{metric_results}} present", pass: hasMetricResults, warning: !hasMetricResults && promptNotEmpty });
  categories.push({
    name: "LLM Prompt", icon: "smart_toy", weight: 10, checks: llmChecks, tab: "prompt",
    tooltip: "An empty prompt causes Claude to generate completely generic feedback with no analysis data."
  });

  // 6. CAMERA — 10%
  const camChecks: ReadinessCheck[] = [];
  const camIssues = checkCameraCompleteness(node);
  const fpsOk = !camIssues.some(i => i.detail.toLowerCase().includes("fps"));
  const resOk = !camIssues.some(i => i.detail.toLowerCase().includes("resolution"));
  const distOk = !camIssues.some(i => i.detail.toLowerCase().includes("distance"));
  camChecks.push({ label: "Minimum FPS configured", pass: fpsOk });
  camChecks.push({ label: "Minimum resolution configured", pass: resOk });
  camChecks.push({ label: "Recommended distance configured", pass: distOk });
  categories.push({
    name: "Camera", icon: "videocam", weight: 10, checks: camChecks, tab: "camera",
    tooltip: "Camera requirements validate upload quality before analysis runs. Unconfigured = no quality control."
  });

  // 7. REFERENCE CALIBRATION — 5%
  const refChecks: ReadinessCheck[] = [];
  if (node.solution_class === "wholebody3d") {
    refChecks.push({ label: "Not required — 3D pose engine", pass: true, warning: true });
  } else {
    const usedAngles = new Set(configuredVids.map(v => v.camera_angle).filter(Boolean) as string[]);
    const cals = node.reference_calibrations ?? [];
    if (usedAngles.size === 0) {
      refChecks.push({ label: "No camera angles configured in videos", pass: true });
    } else {
      for (const angle of usedAngles) {
        const cal = cals.find(c => c.camera_angle === angle);
        const hasPixels = cal && cal.pixels_per_yard && cal.pixels_per_yard > 0;
        const angleLabel = angle === "behind_qb" ? "Behind QB" : angle.charAt(0).toUpperCase() + angle.slice(1);
        refChecks.push({
          label: hasPixels ? `${angleLabel}: ${cal!.pixels_per_yard} px/yard` : `No calibration for ${angleLabel}`,
          pass: !!hasPixels,
        });
      }
    }
  }
  categories.push({
    name: "Reference Calibration", icon: "straighten", weight: 5, checks: refChecks, tab: "reference",
    tooltip: "Without calibration, Distance and Velocity metrics return pixel values not yards."
  });

  return categories;
}

export function computeScore(categories: ReadinessCategory[]): number {
  let total = 0;
  for (const cat of categories) {
    const blocking = cat.checks.filter(c => !c.warning);
    if (blocking.length === 0) { total += cat.weight; continue; }
    const passing = blocking.filter(c => c.pass).length;
    total += (passing / blocking.length) * cat.weight;
  }
  return Math.round(total);
}

export function scoreColor(score: number): string {
  if (score < 60) return "#ef4444"; // red
  if (score < 90) return "#f59e0b"; // amber
  return "#22c55e"; // green
}

interface Props {
  node: TrainingNode;
  onTabChange: (tab: TabKey) => void;
  onSetLive: () => void;
}

export function NodeReadinessBar({ node, onTabChange, onSetLive }: Props) {
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [expanded, setExpanded] = useState(false);

  const categories = useMemo(() => computeCategories(node), [node]);
  const score = useMemo(() => computeScore(categories), [categories]);
  const color = scoreColor(score);
  const failCount = categories.filter(c => c.checks.some(ch => !ch.pass && !ch.warning)).length;

  return (
    <div className="border-b border-outline-variant/10" style={{ backgroundColor: '#0E1319' }}>
      {/* Collapsed bar */}
      <div
        className="h-12 px-6 flex items-center gap-4 cursor-pointer select-none hover:bg-surface-container/40 transition-colors"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("[data-setlive]")) return;
          setExpanded(!expanded);
        }}
      >
        {/* Progress bar */}
        <div className="w-28 h-2 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: '#1A2029' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${score}%`, backgroundColor: color }}
          />
        </div>

        <span className="text-on-surface text-[11px] font-bold uppercase tracking-widest whitespace-nowrap">
          Node Readiness: {score}%
        </span>

        <button
          className="text-on-surface-variant text-[10px] font-medium flex items-center gap-1 hover:text-on-surface transition-colors"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14, transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
            expand_more
          </span>
          {failCount > 0 ? `${failCount} item${failCount > 1 ? "s" : ""} need attention` : "All checks passed"}
        </button>

        <div className="flex-1" />

        <button
          data-setlive
          onClick={async (e) => {
            e.stopPropagation();
            try {
              const md = generateFullNodeMarkdown(node);
              await navigator.clipboard.writeText(md);
              setCopyState("success");
            } catch {
              setCopyState("error");
            }
            clearTimeout(copyTimerRef.current);
            copyTimerRef.current = setTimeout(() => setCopyState("idle"), 2000);
          }}
          className={`h-8 px-4 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5 transition-all active:scale-95 shrink-0 border ${
            copyState === "success"
              ? "border-[#22c55e]/40 text-[#22c55e]"
              : copyState === "error"
              ? "border-[#ef4444]/40 text-[#ef4444]"
              : "border-outline-variant/20 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
          }`}
          title={copyState === "error" ? "Copy failed — check clipboard permissions" : "Copy full node configuration for AI review"}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            {copyState === "success" ? "check_circle" : copyState === "error" ? "error" : "file_copy"}
          </span>
          {copyState === "success" ? "Copied!" : copyState === "error" ? "Failed" : "Copy Node"}
        </button>

        {(() => {
          const isLive = node.status === "live";
          const disabled = !isLive && score < 100;
          const label = isLive ? "Set to Draft" : "Set Live";
          const icon = isLive ? "pause_circle" : "rocket_launch";
          const tooltip = isLive
            ? "Pause automatic analysis for new uploads"
            : score < 100
            ? "Complete all readiness checks to go Live"
            : "Set this node to Live";
          const className = isLive
            ? "border border-outline-variant/30 bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high cursor-pointer"
            : score >= 100
            ? "kinetic-gradient text-[#00460a] cursor-pointer hover:brightness-110"
            : "bg-surface-container text-on-surface-variant/40 cursor-not-allowed";
          return (
            <button
              data-setlive
              disabled={disabled}
              onClick={(e) => { e.stopPropagation(); onSetLive(); }}
              className={`h-8 px-4 rounded-full text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-1.5 transition-all active:scale-95 shrink-0 ${className}`}
              title={tooltip}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{icon}</span>
              {label}
            </button>
          );
        })()}
      </div>

      {/* Expanded panel */}
      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{ maxHeight: expanded ? "340px" : "0px", opacity: expanded ? 1 : 0 }}
      >
        <div className="px-6 pb-4 pt-1 overflow-y-auto" style={{ maxHeight: "300px" }}>
          {/* Collapse button */}
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setExpanded(false)}
              className="text-on-surface-variant text-[10px] font-medium flex items-center gap-1 hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
              Collapse
            </button>
          </div>

          <div className="space-y-1">
            {categories.map((cat) => {
              const blocking = cat.checks.filter(c => !c.warning);
              const passing = blocking.filter(c => c.pass).length;
              const allPass = blocking.length > 0 ? passing === blocking.length : true;
              const hasWarnings = cat.checks.some(c => c.warning && !c.pass);
              // Status description
              let statusText = "";
              if (allPass && !hasWarnings) {
                const passDetails = cat.checks.filter(c => c.pass).map(c => c.label).join(" · ");
                statusText = passDetails;
              } else {
                const failedChecks = cat.checks.filter(c => !c.pass && !c.warning);
                const warnChecks = cat.checks.filter(c => c.warning && !c.pass);
                const parts = [
                  ...failedChecks.map(c => c.label),
                  ...warnChecks.map(c => c.label),
                ];
                statusText = parts.join(" · ");
              }

              return (
                <div
                  key={cat.name}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-surface-container/60 transition-colors group"
                  onClick={() => { onTabChange(cat.tab); setExpanded(false); }}
                >
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 16, color: allPass ? "#22c55e" : hasWarnings && blocking.every(c => c.pass) ? "#f59e0b" : "#ef4444" }}>
                    {allPass ? "check_circle" : "cancel"}
                  </span>
                  <span className="text-on-surface text-xs font-semibold whitespace-nowrap shrink-0 w-44">
                    {cat.name}
                  </span>
                  <span className="text-on-surface-variant/50 text-[10px] font-medium shrink-0 w-10 text-right">
                    {cat.weight}%
                  </span>
                  <span className={`text-[11px] truncate flex-1 min-w-0 ${allPass ? "text-on-surface-variant/60" : "text-on-surface-variant"}`}>
                    {statusText}
                  </span>
                  <SectionTooltip tip={`${cat.tooltip}\n\nSub-checks:\n${cat.checks.map(c => `${c.pass ? "✅" : c.warning ? "⚠️" : "❌"} ${c.label}`).join("\n")}`} />
                  <span className="material-symbols-outlined text-on-surface-variant/30 opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: 14 }}>
                    arrow_forward
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
