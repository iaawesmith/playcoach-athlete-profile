import { useState } from "react";
import { fetchRunDiagnosticData } from "@/services/athleteLab";
import { buildDiagnosticExport } from "../utils/diagnosticExport";

interface DiagnosticExportButtonProps {
  uploadId: string;
  nodeId: string | null;
}

/**
 * "Copy diagnostic export" control for a single run. Read-only: fetches the
 * stored run data, assembles the audit JSON, and copies it to the clipboard.
 * Never triggers or modifies analysis.
 */
export function DiagnosticExportButton({ uploadId, nodeId }: DiagnosticExportButtonProps) {
  const [includeRaw, setIncludeRaw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  const handleCopy = async () => {
    if (!nodeId || busy) return;
    setBusy(true);
    setState("idle");
    try {
      const data = await fetchRunDiagnosticData(uploadId, nodeId);
      const doc = buildDiagnosticExport({
        upload: {
          id: data.upload.id,
          node_id: data.upload.node_id,
          node_version: data.upload.node_version,
          created_at: data.upload.created_at,
          start_seconds: data.upload.start_seconds,
          end_seconds: data.upload.end_seconds,
          camera_angle: data.upload.camera_angle,
          video_url: data.upload.video_url,
          status: data.upload.status,
          analysis_context: data.upload.analysis_context,
        },
        result: data.result
          ? {
              id: typeof data.result.id === "string" ? data.result.id : "",
              aggregate_score: typeof data.result.aggregate_score === "number" ? data.result.aggregate_score : null,
              phase_scores:
                data.result.phase_scores && typeof data.result.phase_scores === "object" && !Array.isArray(data.result.phase_scores)
                  ? (data.result.phase_scores as Record<string, unknown>)
                  : {},
              metric_results: data.result.metric_results ?? null,
              confidence_flags: data.result.confidence_flags ?? null,
              detected_errors: data.result.detected_errors ?? null,
              feedback: typeof data.result.feedback === "string" ? data.result.feedback : null,
              analyzed_at: typeof data.result.analyzed_at === "string" ? data.result.analyzed_at : null,
              result_data:
                data.result.result_data && typeof data.result.result_data === "object" && !Array.isArray(data.result.result_data)
                  ? (data.result.result_data as Record<string, unknown>)
                  : {},
            }
          : null,
        clip: data.clip,
        includeRawKeypoints: includeRaw,
      });
      await navigator.clipboard.writeText(JSON.stringify(doc, null, 2));
      setState("copied");
      window.setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 4000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => void handleCopy()}
        disabled={!nodeId || busy}
        title={nodeId ? "Copy the full diagnostic export JSON for this run" : "Node unavailable for this run"}
        className="flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-high px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant transition-all duration-150 hover:border-white/20 hover:text-on-surface active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
          {busy ? "progress_activity" : state === "copied" ? "check" : "content_copy"}
        </span>
        {busy ? "Building export…" : state === "copied" ? "Copied" : state === "error" ? "Export failed" : "Copy diagnostic export"}
      </button>
      <label className="flex cursor-pointer items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-on-surface-variant/70">
        <input
          type="checkbox"
          checked={includeRaw}
          onChange={(event) => setIncludeRaw(event.target.checked)}
          className="h-3.5 w-3.5 accent-[#00e639]"
        />
        Include raw keypoints
      </label>
    </div>
  );
}
