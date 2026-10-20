import type { PipelineAnalysisResult, TrainingNode } from "../types";
import { buildDepthComparison, computeExpectedDepth, yardMetricNames, type CalibrationClip } from "@/services/calibrationLibrary";

interface GroundTruthComparisonProps {
  clip: CalibrationClip;
  node: TrainingNode;
  result: PipelineAnalysisResult;
}

const fmt = (v: number | null, digits = 2) => (v === null ? "—" : v.toFixed(digits));
const SOURCE_LABEL: Record<string, string> = { dynamic: "Dynamic", body_based: "Body based", static: "Static", unknown: "Unknown", none: "None" };

export function GroundTruthComparison({ clip, node, result }: GroundTruthComparisonProps) {
  const audit = result.calibrationAudit ?? null;
  const expectedDepth = clip.expected_route_depth_yards ?? computeExpectedDepth(clip.start_yard_line, clip.break_yard_line);
  const cmp = buildDepthComparison(expectedDepth, clip.depth_metric_key, yardMetricNames(node), result.metricResults);
  const actualSource = audit?.selected_source ?? null;
  const sourceKnown = clip.expected_calibration_source !== "unknown" && actualSource !== null;
  const sourceMatch = sourceKnown && actualSource === clip.expected_calibration_source;

  const cell = "rounded-xl bg-surface-container-lowest p-3";
  const label = "text-[10px] font-medium uppercase tracking-widest text-on-surface-variant";

  return (
    <div className="space-y-4 rounded-xl border border-white/5 bg-surface-container p-5">
      <h4 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>straighten</span>
        Ground truth vs pipeline · {clip.title}
      </h4>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={cell}>
          <div className={label}>Calibration source</div>
          <div className="mt-1 text-sm text-on-surface">Expected <b>{SOURCE_LABEL[clip.expected_calibration_source]}</b></div>
          <div className="text-sm text-on-surface">Actual <b>{actualSource ? SOURCE_LABEL[actualSource] ?? actualSource : "Not reported by pipeline"}</b></div>
          {sourceKnown && (
            <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${sourceMatch ? "bg-primary-container/15 text-primary" : "bg-error-dim/15 text-error-dim"}`}>
              {sourceMatch ? "Match" : "Mismatch"}
            </span>
          )}
        </div>
        <div className={cell}>
          <div className={label}>Pixels per yard</div>
          {audit ? (
            <div className="mt-1 space-y-0.5 text-xs text-on-surface">
              <div>Selected <b>{fmt(audit.selected_ppy)}</b></div>
              <div className="text-on-surface-variant">Body based {fmt(audit.body_based_ppy)} · Static {fmt(audit.static_ppy)}</div>
            </div>
          ) : <div className="mt-1 text-xs text-on-surface-variant">Not reported by pipeline</div>}
        </div>
        <div className={cell}>
          <div className={label}>Route depth</div>
          <div className="mt-1 text-sm text-on-surface">Expected <b>{expectedDepth !== null ? `${expectedDepth} yd` : "—"}</b></div>
          {cmp.primary ? (
            <>
              <div className="text-sm text-on-surface">{cmp.primary.name} <b>{cmp.primary.measured !== null ? `${fmt(cmp.primary.measured)} yd` : "Not measured"}</b></div>
              {cmp.primary.difference !== null && <div className="text-xs text-on-surface-variant">Difference {cmp.primary.difference > 0 ? "+" : ""}{fmt(cmp.primary.difference)} yd</div>}
            </>
          ) : <div className="text-xs text-on-surface-variant">No depth metric chosen for this clip</div>}
        </div>
      </div>

      {cmp.others.length > 0 && (
        <div className="space-y-2">
          <div className={label}>Other distance metrics (reference)</div>
          <div className="flex flex-wrap gap-2">
            {cmp.others.map((o) => (
              <span key={o.name} className="rounded-lg bg-surface-container-lowest px-3 py-1.5 text-xs text-on-surface">
                {o.name}: {o.measured !== null ? `${fmt(o.measured)} yd` : "—"}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
