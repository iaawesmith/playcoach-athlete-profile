import type { PipelineAnalysisResult } from "../types";

type Audit = NonNullable<PipelineAnalysisResult["calibrationAudit"]>;

const LABEL: Record<string, string> = {
  dynamic: "Yard lines",
  service_body_width: "Service body width",
  height_based: "Athlete height",
  body_width: "Body width",
  static: "Static (node)",
};

const fmt = (v: number | null | undefined) => (typeof v === "number" ? v.toFixed(1) : "—");

export function CalibrationAuditPanel({ audit }: { audit: Audit }) {
  const candidates = audit.candidates ?? [];
  const flags = audit.flags ?? [];
  const pf = audit.per_frame_scale ?? null;

  return (
    <div className="rounded-xl border border-white/5 bg-surface-container p-5">
      <h4 className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>straighten</span>
        Calibration
      </h4>
      <p className="text-sm text-on-surface">
        Selected <b>{LABEL[audit.selected_source === "body_based" ? "body_width" : audit.selected_source ?? ""] ?? audit.selected_source ?? "None"}</b>
        {audit.selected_mode ? ` · ${audit.selected_mode.replace("_", "-")}` : ""} · {fmt(audit.selected_ppy)} px/yd
      </p>
      {pf && (
        <p className="mt-1 text-xs text-on-surface-variant">
          Per-frame scale: start {fmt(pf.start)} · end {fmt(pf.end)} · range {fmt(pf.min)}–{fmt(pf.max)} px/yd
        </p>
      )}
      {candidates.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {candidates.map((c) => (
            <li
              key={c.source}
              className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-xs ${c.status === "used" ? "bg-primary-container/10 text-on-surface" : "bg-surface-container-lowest text-on-surface-variant"}`}
            >
              <div>
                <div className="font-semibold">{LABEL[c.source] ?? c.source}</div>
                {c.reason && <div className="mt-0.5 text-[11px] opacity-80">{c.reason}</div>}
              </div>
              <div className="text-right">
                <div className="font-semibold">{fmt(c.ppy)}</div>
                <div className="text-[10px] uppercase tracking-widest">{c.status.replace(/_/g, " ")}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-on-surface-variant">This run predates the full calibration record. Rerun the clip to see every candidate.</p>
      )}
      {flags.length > 0 && (
        <ul className="mt-4 space-y-2">
          {flags.map((f) => (
            <li key={f.flag} className="rounded-lg bg-error-dim/10 px-3 py-2 text-xs text-on-surface">
              <div className="font-semibold uppercase tracking-widest text-[10px]">{f.flag.replace(/_/g, " ")}</div>
              <div className="mt-0.5 text-on-surface-variant">{f.note}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
