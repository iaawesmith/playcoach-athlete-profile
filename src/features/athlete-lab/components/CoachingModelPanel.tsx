import { useEffect, useState } from "react";
import { getCoachingModelSettings, type BuiltinModelOption, type CoachingModelDefault } from "@/services/coachingModel";
import { validateCoachModel, type CoachProvider } from "../../../../supabase/functions/_shared/coachModel";

const INPUT_CLASS = "w-full rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface focus:outline-none";
const LABEL_CLASS = "text-on-surface-variant text-[10px] font-medium uppercase tracking-widest";

interface CoachingModelPanelProps {
  nodeProvider: CoachProvider | null;
  nodeModel: string | null;
  onNodeChange: (provider: CoachProvider | null, model: string | null) => void;
}

/** Shows the effective coaching model and an optional per-node override. Empty override = workspace default. */
export function CoachingModelPanel({ nodeProvider, nodeModel, onNodeChange }: CoachingModelPanelProps) {
  const [workspaceDefault, setWorkspaceDefault] = useState<CoachingModelDefault | null>(null);
  const [options, setOptions] = useState<BuiltinModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getCoachingModelSettings()
      .then((r) => { setWorkspaceDefault(r.default); setOptions(r.builtin_options); })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : "Could not load coaching model settings"))
      .finally(() => setLoading(false));
  }, []);

  const overriding = Boolean(nodeProvider && nodeModel);
  const validation = overriding ? validateCoachModel(nodeProvider, nodeModel) : null;
  const effective = overriding ? `${nodeProvider} · ${nodeModel}` : workspaceDefault ? `${workspaceDefault.provider} · ${workspaceDefault.model}` : "—";

  return (
    <div className="mt-6 space-y-4 rounded-xl bg-surface-container-high p-5">
      <span className="text-on-surface font-black uppercase tracking-tighter text-sm">Coaching Model</span>
      {loading ? (
        <div className="h-10 animate-pulse rounded-xl bg-surface-container-lowest" />
      ) : (
        <p className="text-sm text-on-surface">
          In use: <span className="font-semibold">{effective}</span>{" "}
          <span className="text-on-surface-variant">({overriding ? "node override" : "workspace default"})</span>
        </p>
      )}
      {loadError && <p className="text-xs text-error-dim">{loadError}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className={LABEL_CLASS}>Node Override Provider</span>
          <select
            className={`${INPUT_CLASS} mt-2`}
            value={nodeProvider ?? ""}
            onChange={(e) => {
              const p = e.target.value === "" ? null : (e.target.value as CoachProvider);
              onNodeChange(p, p ? nodeModel : null);
            }}
          >
            <option value="">Use workspace default</option>
            <option value="anthropic">Anthropic (direct)</option>
            <option value="lovable_ai">Built-in AI (OpenAI / Google)</option>
          </select>
        </div>
        <div>
          <span className={LABEL_CLASS}>Exact Model Id</span>
          {nodeProvider === "lovable_ai" ? (
            <select className={`${INPUT_CLASS} mt-2`} value={nodeModel ?? ""} onChange={(e) => onNodeChange(nodeProvider, e.target.value || null)}>
              <option value="">Choose a model</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>{o.id}{o.deprecated ? " (deprecated)" : ""}</option>
              ))}
            </select>
          ) : (
            <input
              className={`${INPUT_CLASS} mt-2`}
              disabled={!nodeProvider}
              value={nodeModel ?? ""}
              placeholder="e.g. claude-sonnet-4-5-20250929"
              onChange={(e) => onNodeChange(nodeProvider, e.target.value || null)}
            />
          )}
        </div>
      </div>
      {validation && (
        <p className={`text-xs ${validation.ok ? "text-on-surface-variant" : "text-error-dim"}`}>
          {validation.ok ? validation.reason ?? "Pinned to an exact snapshot." : validation.reason}
        </p>
      )}
      <p className="text-[11px] text-on-surface-variant">Leave empty to use the workspace default. Prompts never include athlete names.</p>
    </div>
  );
}
