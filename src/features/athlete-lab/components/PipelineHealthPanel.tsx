import { useCallback, useState } from "react";
import {
  runPipelineHealthCheck,
  type HealthProbe,
  type HealthProbeStatus,
  type PipelineHealthReport,
} from "@/services/athleteLab";

const STATUS_META: Record<HealthProbeStatus, { icon: string; color: string; label: string }> = {
  pass: { icon: "check_circle", color: "#00e639", label: "OK" },
  fail: { icon: "cancel", color: "#d53d18", label: "FAILING" },
  warn: { icon: "warning", color: "#f59e0b", label: "WARNING" },
  skip: { icon: "remove_circle", color: "#a8abaf", label: "NOT RUN" },
};

const GROUP_ORDER = [
  "Ingest",
  "Trigger",
  "Edge Function",
  "Cloud Run Pose Service",
  "Scoring & Write",
  "Freshness",
];

function groupProbes(probes: HealthProbe[]): [string, HealthProbe[]][] {
  const map = new Map<string, HealthProbe[]>();
  for (const p of probes) {
    const existing = map.get(p.group);
    if (existing) existing.push(p);
    else map.set(p.group, [p]);
  }
  return [...map.entries()].sort(
    (a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]),
  );
}

function ProbeRow({ probe }: { probe: HealthProbe }) {
  const meta = STATUS_META[probe.status];
  const showDetail = probe.status !== "pass" || Boolean(probe.latency_ms);

  return (
    <div className="flex items-start gap-3 px-5 py-3 border-b border-outline-variant/5 last:border-b-0">
      <span className="material-symbols-outlined mt-0.5 shrink-0" style={{ fontSize: 18, color: meta.color }}>
        {meta.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-on-surface text-xs font-bold">{probe.label}</span>
          {typeof probe.latency_ms === "number" && (
            <span className="text-on-surface-variant text-[10px] font-mono">{probe.latency_ms}ms</span>
          )}
        </div>
        {showDetail && (
          <p className="text-on-surface-variant text-[11px] leading-relaxed mt-1">{probe.detail}</p>
        )}
      </div>
      <span
        className="shrink-0 text-[9px] font-black uppercase tracking-[0.2em] mt-1"
        style={{ color: meta.color }}
      >
        {meta.label}
      </span>
    </div>
  );
}

export function PipelineHealthPanel() {
  const [report, setReport] = useState<PipelineHealthReport | null>(null);
  const [running, setRunning] = useState(false);
  const [deep, setDeep] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      setReport(await runPipelineHealthCheck(deep));
    } catch (err) {
      setError((err as Error).message);
      setReport(null);
    } finally {
      setRunning(false);
    }
  }, [deep]);

  const banner = (() => {
    if (!report) return null;
    if (report.summary.fail > 0) {
      return { color: "#d53d18", text: `${report.summary.fail} CHECK${report.summary.fail === 1 ? "" : "S"} FAILING` };
    }
    if (report.summary.warn > 0) {
      return { color: "#f59e0b", text: `OPERATIONAL — ${report.summary.warn} WARNING${report.summary.warn === 1 ? "" : "S"}` };
    }
    return { color: "#00e639", text: "ALL SYSTEMS OPERATIONAL" };
  })();

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/10 overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h3 className="text-on-surface font-black uppercase tracking-[0.15em] text-xs">Pipeline Health</h3>
          <p className="text-on-surface-variant text-[11px] mt-1 max-w-xl">
            Live probe of every component a MediaPipe pose analysis depends on. Green means it answered right now.
          </p>
        </div>

        <button
          onClick={() => setDeep((d) => !d)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest transition-colors active:scale-95 duration-150"
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 16, color: deep ? "#00e639" : "#a8abaf" }}
          >
            {deep ? "toggle_on" : "toggle_off"}
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Deep Check</span>
        </button>

        <button
          onClick={run}
          disabled={running}
          className="px-4 py-2 rounded-full kinetic-gradient text-[#00250a] text-xs font-black uppercase tracking-[0.2em] transition-all duration-150 active:scale-95 disabled:opacity-50"
        >
          {running ? "Probing…" : "Run Health Check"}
        </button>
      </div>

      {deep && (
        <p className="px-5 pb-3 text-on-surface-variant text-[10px] uppercase tracking-widest">
          Deep check runs a real /analyze contract probe against the reference clip and a 1-token LLM ping. Slower.
        </p>
      )}

      {running && (
        <div className="border-t border-outline-variant/10">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3 border-b border-outline-variant/5 last:border-b-0">
              <div className="w-4 h-4 rounded-full bg-surface-container-highest animate-pulse" />
              <div className="h-3 rounded bg-surface-container-highest animate-pulse" style={{ width: `${40 + i * 7}%` }} />
            </div>
          ))}
        </div>
      )}

      {!running && error && (
        <div className="border-t border-outline-variant/10 px-5 py-4">
          <span className="text-[11px] font-bold" style={{ color: "#d53d18" }}>
            Health check failed to run: {error}
          </span>
        </div>
      )}

      {!running && report && banner && (
        <div className="border-t border-outline-variant/10">
          <div className="px-5 py-3 flex items-center gap-3 flex-wrap bg-surface-container-high/40">
            <span className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: banner.color }}>
              {banner.text}
            </span>
            <span className="text-on-surface-variant text-[10px] font-mono">
              {report.summary.pass} pass · {report.summary.warn} warn · {report.summary.fail} fail · {report.summary.skip} skipped
            </span>
            <div className="flex-1" />
            <span className="text-on-surface-variant text-[10px] font-mono">
              {new Date(report.ran_at).toLocaleTimeString()} · {(report.duration_ms / 1000).toFixed(1)}s
            </span>
          </div>

          {groupProbes(report.probes).map(([group, probes]) => (
            <div key={group}>
              <div className="px-5 pt-4 pb-2">
                <span className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.4em]">
                  {group}
                </span>
              </div>
              {probes.map((probe) => (
                <ProbeRow key={probe.id} probe={probe} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
