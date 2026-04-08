import { useState, useEffect, useCallback } from "react";
import type { TrainingNode, KeyMetric, CommonError, PhaseNote, Badge, EliteVideo } from "../types";
import { updateNode } from "@/services/athleteLab";
import { SectionTooltip } from "./SectionTooltip";
import { TestingPanel } from "./TestingPanel";

interface NodeEditorProps {
  node: TrainingNode;
  onUpdated: (node: TrainingNode) => void;
}

type TabKey = "basics" | "videos" | "overview" | "mechanics" | "metrics" | "scoring" | "errors" | "phases" | "reference" | "camera" | "checkpoints" | "prompt" | "badges" | "test";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "basics", label: "Basics", icon: "edit" },
  { key: "videos", label: "Videos", icon: "video_library" },
  { key: "overview", label: "Overview", icon: "description" },
  { key: "mechanics", label: "Mechanics", icon: "engineering" },
  { key: "metrics", label: "Metrics", icon: "analytics" },
  { key: "scoring", label: "Scoring", icon: "scoreboard" },
  { key: "errors", label: "Errors", icon: "error_outline" },
  { key: "phases", label: "Phases", icon: "timeline" },
  { key: "reference", label: "Reference", icon: "straighten" },
  { key: "camera", label: "Camera", icon: "videocam" },
  { key: "checkpoints", label: "Checkpoints", icon: "flag" },
  { key: "prompt", label: "LLM Prompt", icon: "smart_toy" },
  { key: "badges", label: "Badges", icon: "military_tech" },
  { key: "test", label: "Run Analysis", icon: "science" },
];

const TOOLTIPS: Record<TabKey, string> = {
  basics: "The official name of this drill or skill",
  videos: "High-quality videos of elite athletes performing this exact route/skill. These are the benchmarks the AI compares against.",
  overview: "Brief explanation of why this route/skill matters and what success looks like",
  mechanics: "Write the exact mechanics and cues used by top pros for this movement",
  metrics: "Define every metric the AI should calculate and how heavily it contributes to the overall score",
  scoring: "How the final Route Mastery Score is calculated",
  errors: "Help the AI identify and give constructive feedback on typical errors",
  phases: "Define the phases of this movement so the AI can give phase-specific feedback",
  reference: "Real-world scale reference needed for accurate measurements",
  camera: "Best camera positions for accurate analysis",
  checkpoints: "Key moments the AI should analyze closely",
  prompt: "Tailor the tone and focus of the AI coach feedback for this node",
  badges: "Achievements athletes can earn for this skill",
  test: "Upload a sample video or paste a URL to instantly test AI analysis against this node's configuration",
};

export function NodeEditor({ node, onUpdated }: NodeEditorProps) {
  const [tab, setTab] = useState<TabKey>("basics");
  const [draft, setDraft] = useState<TrainingNode>(node);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(node);
    setDirty(false);
  }, [node.id]);

  const update = useCallback(<K extends keyof TrainingNode>(key: K, value: TrainingNode[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateNode(draft.id, {
        name: draft.name,
        icon_url: draft.icon_url,
        overview: draft.overview,
        pro_mechanics: draft.pro_mechanics,
        key_metrics: draft.key_metrics,
        scoring_rules: draft.scoring_rules,
        common_errors: draft.common_errors,
        phase_breakdown: draft.phase_breakdown,
        reference_object: draft.reference_object,
        camera_guidelines: draft.camera_guidelines,
        form_checkpoints: draft.form_checkpoints,
        llm_prompt_template: draft.llm_prompt_template,
        badges: draft.badges,
        elite_videos: draft.elite_videos,
      });
      onUpdated(updated);
      setDirty(false);
    } catch {
      // error handling would go here
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl px-4 py-3 text-on-surface text-sm placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container/50 transition-colors";
  const labelClass = "block text-on-surface-variant text-[10px] font-medium uppercase tracking-widest mb-2";

  return (
    <div className="flex-1 h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface/90 backdrop-blur-xl px-6 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 24 }}>neurology</span>
          <h1 className="text-on-surface font-black uppercase tracking-tighter text-xl">{draft.name || "New Node"}</h1>
        </div>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="h-10 px-6 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
        >
          {saving ? (
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>progress_activity</span>
          ) : (
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>save</span>
          )}
          {saving ? "Saving..." : "Save Node"}
        </button>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4 flex gap-1 overflow-x-auto scrollbar-thin shrink-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-[0.15em] flex items-center gap-1.5 whitespace-nowrap transition-all duration-200 shrink-0 ${
              tab === t.key
                ? "bg-primary-container/15 text-primary-container border border-primary-container/30"
                : "text-on-surface-variant hover:bg-surface-container border border-transparent"
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-6">
        <div className="flex items-center gap-1 mb-2">
          <h3 className="text-on-surface font-extrabold uppercase text-sm tracking-wide">
            {TABS.find((t) => t.key === tab)?.label}
          </h3>
          <SectionTooltip tip={TOOLTIPS[tab]} />
        </div>

        {tab === "basics" && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Route / Skill Name</label>
              <input className={inputClass} value={draft.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Slant Route" />
            </div>
            <div>
              <div className="flex items-center gap-1 mb-2">
                <label className="text-on-surface-variant text-[10px] font-medium uppercase tracking-widest">Icon / Visual Diagram</label>
                <SectionTooltip tip="Upload an icon or diagram, or paste a URL. This will appear next to the node name in the sidebar." />
              </div>
              <div className="flex gap-3">
                <input className={`${inputClass} flex-1`} value={draft.icon_url || ""} onChange={(e) => update("icon_url", e.target.value || null)} placeholder="Paste image URL..." />
                <label className="h-11 px-4 rounded-xl bg-surface-container-high border border-outline-variant/10 text-on-surface-variant text-xs font-semibold uppercase tracking-widest flex items-center gap-2 cursor-pointer hover:bg-surface-container-highest transition-colors shrink-0">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload</span>
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const { supabase } = await import("@/integrations/supabase/client");
                      const ext = file.name.split(".").pop() || "png";
                      const path = `node-icons/${draft.id}-${Date.now()}.${ext}`;
                      const { error } = await supabase.storage.from("athlete-media").upload(path, file, { upsert: true });
                      if (!error) {
                        const { data: urlData } = supabase.storage.from("athlete-media").getPublicUrl(path);
                        update("icon_url", urlData.publicUrl);
                      }
                    }}
                  />
                </label>
              </div>
              {draft.icon_url && (
                <div className="mt-3 p-3 rounded-xl bg-surface-container-high border border-white/5 inline-flex items-center gap-3">
                  <img src={draft.icon_url} alt="Node icon" className="w-12 h-12 rounded-lg object-cover bg-surface-container-lowest" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <span className="text-on-surface-variant text-xs truncate max-w-[200px]">{draft.icon_url.split("/").pop()}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "videos" && (
          <EliteVideosEditor videos={draft.elite_videos} onChange={(v) => update("elite_videos", v)} />
        )}

        {tab === "overview" && (
          <textarea className={`${inputClass} min-h-[200px] resize-y`} value={draft.overview} onChange={(e) => update("overview", e.target.value)} placeholder="Describe the purpose of this skill..." />
        )}

        {tab === "mechanics" && (
          <MechanicsEditor value={draft.pro_mechanics} onChange={(v) => update("pro_mechanics", v)} inputClass={inputClass} labelClass={labelClass} />
        )}

        {tab === "metrics" && (
          <KeyMetricsEditor metrics={draft.key_metrics} onChange={(m) => update("key_metrics", m)} />
        )}

        {tab === "scoring" && (
          <ScoringEditor
            scoringRules={draft.scoring_rules}
            onScoringRulesChange={(v) => update("scoring_rules", v)}
            metrics={draft.key_metrics}
            inputClass={inputClass}
            labelClass={labelClass}
          />
        )}

        {tab === "errors" && (
          <CommonErrorsEditor errors={draft.common_errors} onChange={(e) => update("common_errors", e)} />
        )}

        {tab === "phases" && (
          <PhasesEditor phases={draft.phase_breakdown} onChange={(p) => update("phase_breakdown", p)} />
        )}

        {tab === "reference" && (
          <ReferenceEditor value={draft.reference_object} onChange={(v) => update("reference_object", v)} inputClass={inputClass} labelClass={labelClass} />
        )}

        {tab === "camera" && (
          <CameraEditor value={draft.camera_guidelines} onChange={(v) => update("camera_guidelines", v)} inputClass={inputClass} labelClass={labelClass} />
        )}

        {tab === "checkpoints" && (
          <CheckpointsEditor checkpoints={draft.form_checkpoints} onChange={(c) => update("form_checkpoints", c)} />
        )}

        {tab === "prompt" && (
          <textarea className={`${inputClass} min-h-[300px] resize-y font-mono text-xs`} value={draft.llm_prompt_template} onChange={(e) => update("llm_prompt_template", e.target.value)} placeholder="Custom LLM prompt template..." />
        )}

        {tab === "badges" && (
          <BadgesEditor badges={draft.badges} onChange={(b) => update("badges", b)} />
        )}

        {tab === "test" && (
          <TestingPanel node={draft} />
        )}
      </div>
    </div>
  );
}

/* ── Sub-editors ── */

function EliteVideosEditor({ videos, onChange }: { videos: EliteVideo[]; onChange: (v: EliteVideo[]) => void }) {
  const inputClass = "w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl px-4 py-3 text-on-surface text-sm placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container/50 transition-colors";
  return (
    <div className="space-y-3">
      {videos.map((v, i) => (
        <div key={i} className="flex gap-2">
          <input className={`${inputClass} flex-1`} value={v.url} onChange={(e) => { const n = [...videos]; n[i] = { ...v, url: e.target.value }; onChange(n); }} placeholder="Video URL" />
          <input className={`${inputClass} w-48`} value={v.label} onChange={(e) => { const n = [...videos]; n[i] = { ...v, label: e.target.value }; onChange(n); }} placeholder="Label" />
          <button onClick={() => onChange(videos.filter((_, j) => j !== i))} className="text-on-surface-variant hover:text-red-400 px-2">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...videos, { url: "", label: "" }])} className="text-primary-container text-xs font-semibold uppercase tracking-widest flex items-center gap-1 hover:opacity-80">
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Add Video
      </button>
    </div>
  );
}

function KeyMetricsEditor({ metrics, onChange }: { metrics: KeyMetric[]; onChange: (m: KeyMetric[]) => void }) {
  const inputClass = "w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl px-3 py-2 text-on-surface text-sm placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container/50 transition-colors";
  const labelClass = "text-on-surface-variant text-[9px] font-medium uppercase tracking-widest mb-1";

  const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0);

  return (
    <div className="space-y-4">
      <div className={`text-xs font-semibold ${totalWeight === 100 ? "text-primary-container" : "text-orange-400"}`}>
        Total Weight: {totalWeight}% {totalWeight !== 100 && "(should be 100%)"}
      </div>
      {metrics.map((m, i) => (
        <div key={i} className="p-4 rounded-xl bg-surface-container-high border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-on-surface text-xs font-bold">Metric {i + 1}</span>
            <button onClick={() => onChange(metrics.filter((_, j) => j !== i))} className="text-on-surface-variant hover:text-red-400">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><div className={labelClass}>Name</div><input className={inputClass} value={m.name} onChange={(e) => { const n = [...metrics]; n[i] = { ...m, name: e.target.value }; onChange(n); }} /></div>
            <div><div className={labelClass}>Unit</div><input className={inputClass} value={m.unit} onChange={(e) => { const n = [...metrics]; n[i] = { ...m, unit: e.target.value }; onChange(n); }} /></div>
          </div>
          <div><div className={labelClass}>Description</div><textarea className={`${inputClass} min-h-[60px] resize-y`} value={m.description} onChange={(e) => { const n = [...metrics]; n[i] = { ...m, description: e.target.value }; onChange(n); }} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><div className={labelClass}>Elite Target</div><input className={inputClass} value={m.eliteTarget} onChange={(e) => { const n = [...metrics]; n[i] = { ...m, eliteTarget: e.target.value }; onChange(n); }} /></div>
            <div><div className={labelClass}>Weight (%)</div><input type="number" className={inputClass} value={m.weight} onChange={(e) => { const n = [...metrics]; n[i] = { ...m, weight: Number(e.target.value) }; onChange(n); }} /></div>
          </div>
        </div>
      ))}
      <button onClick={() => onChange([...metrics, { name: "", description: "", eliteTarget: "", unit: "", weight: 0 }])} className="text-primary-container text-xs font-semibold uppercase tracking-widest flex items-center gap-1 hover:opacity-80">
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Add Metric
      </button>
    </div>
  );
}

function CommonErrorsEditor({ errors, onChange }: { errors: CommonError[]; onChange: (e: CommonError[]) => void }) {
  const inputClass = "w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl px-3 py-2 text-on-surface text-sm placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container/50 transition-colors";
  return (
    <div className="space-y-3">
      {errors.map((err, i) => (
        <div key={i} className="p-4 rounded-xl bg-surface-container-high border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-on-surface text-xs font-bold">Error {i + 1}</span>
            <button onClick={() => onChange(errors.filter((_, j) => j !== i))} className="text-on-surface-variant hover:text-red-400">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          </div>
          <input className={inputClass} value={err.error} onChange={(e) => { const n = [...errors]; n[i] = { ...err, error: e.target.value }; onChange(n); }} placeholder="Common error..." />
          <textarea className={`${inputClass} min-h-[60px] resize-y`} value={err.correction} onChange={(e) => { const n = [...errors]; n[i] = { ...err, correction: e.target.value }; onChange(n); }} placeholder="How to fix it..." />
        </div>
      ))}
      <button onClick={() => onChange([...errors, { error: "", correction: "" }])} className="text-primary-container text-xs font-semibold uppercase tracking-widest flex items-center gap-1 hover:opacity-80">
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Add Error
      </button>
    </div>
  );
}

function PhasesEditor({ phases, onChange }: { phases: PhaseNote[]; onChange: (p: PhaseNote[]) => void }) {
  const inputClass = "w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl px-3 py-2 text-on-surface text-sm placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container/50 transition-colors";
  return (
    <div className="space-y-3">
      {phases.map((p, i) => (
        <div key={i} className="p-4 rounded-xl bg-surface-container-high border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <input className={`${inputClass} w-48`} value={p.phase} onChange={(e) => { const n = [...phases]; n[i] = { ...p, phase: e.target.value }; onChange(n); }} placeholder="Phase name" />
            <button onClick={() => onChange(phases.filter((_, j) => j !== i))} className="text-on-surface-variant hover:text-red-400">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          </div>
          <textarea className={`${inputClass} min-h-[60px] resize-y`} value={p.notes} onChange={(e) => { const n = [...phases]; n[i] = { ...p, notes: e.target.value }; onChange(n); }} placeholder="Phase notes..." />
        </div>
      ))}
      <button onClick={() => onChange([...phases, { phase: "", notes: "" }])} className="text-primary-container text-xs font-semibold uppercase tracking-widest flex items-center gap-1 hover:opacity-80">
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Add Phase
      </button>
    </div>
  );
}

function CheckpointsEditor({ checkpoints, onChange }: { checkpoints: string[]; onChange: (c: string[]) => void }) {
  const inputClass = "w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl px-3 py-2 text-on-surface text-sm placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container/50 transition-colors";
  return (
    <div className="space-y-2">
      {checkpoints.map((c, i) => (
        <div key={i} className="flex gap-2 items-center">
          <span className="text-on-surface-variant text-xs font-mono w-6">{i + 1}.</span>
          <input className={`${inputClass} flex-1`} value={c} onChange={(e) => { const n = [...checkpoints]; n[i] = e.target.value; onChange(n); }} placeholder="Checkpoint..." />
          <button onClick={() => onChange(checkpoints.filter((_, j) => j !== i))} className="text-on-surface-variant hover:text-red-400">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...checkpoints, ""])} className="text-primary-container text-xs font-semibold uppercase tracking-widest flex items-center gap-1 hover:opacity-80">
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Add Checkpoint
      </button>
    </div>
  );
}

function BadgesEditor({ badges, onChange }: { badges: Badge[]; onChange: (b: Badge[]) => void }) {
  const inputClass = "w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl px-3 py-2 text-on-surface text-sm placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container/50 transition-colors";
  return (
    <div className="space-y-3">
      {badges.map((b, i) => (
        <div key={i} className="p-4 rounded-xl bg-surface-container-high border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-on-surface text-xs font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 16 }}>military_tech</span>
              Badge {i + 1}
            </span>
            <button onClick={() => onChange(badges.filter((_, j) => j !== i))} className="text-on-surface-variant hover:text-red-400">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          </div>
          <input className={inputClass} value={b.name} onChange={(e) => { const n = [...badges]; n[i] = { ...b, name: e.target.value }; onChange(n); }} placeholder="Badge name" />
          <input className={inputClass} value={b.condition} onChange={(e) => { const n = [...badges]; n[i] = { ...b, condition: e.target.value }; onChange(n); }} placeholder="Unlock condition" />
        </div>
      ))}
      <button onClick={() => onChange([...badges, { name: "", condition: "" }])} className="text-primary-container text-xs font-semibold uppercase tracking-widest flex items-center gap-1 hover:opacity-80">
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Add Badge
      </button>
    </div>
  );
}

/* ── Structured Mechanics Editor ── */

interface StructuredEditorProps {
  value: string;
  onChange: (v: string) => void;
  inputClass: string;
  labelClass: string;
}

function parseStructuredField(raw: string, sections: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  sections.forEach((s) => { result[s] = ""; });

  let currentSection = "";
  for (const line of raw.split("\n")) {
    const matchedSection = sections.find((s) => line.trim().toLowerCase().startsWith(s.toLowerCase() + ":"));
    if (matchedSection) {
      currentSection = matchedSection;
      const afterColon = line.substring(line.indexOf(":") + 1).trim();
      result[currentSection] = afterColon;
    } else if (currentSection) {
      result[currentSection] = result[currentSection] ? result[currentSection] + "\n" + line : line;
    }
  }
  return result;
}

function serializeStructuredField(fields: Record<string, string>): string {
  return Object.entries(fields)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `${k}: ${v.trim()}`)
    .join("\n\n");
}

function MechanicsEditor({ value, onChange, inputClass, labelClass }: StructuredEditorProps) {
  const sections = ["Release Phase", "Stem Phase", "Break Phase", "Catch Phase", "General Tips"];
  const parsed = parseStructuredField(value, sections);
  const hasStructured = sections.some((s) => parsed[s].trim());
  const [fields, setFields] = useState<Record<string, string>>(hasStructured ? parsed : (() => {
    const init: Record<string, string> = {};
    sections.forEach((s) => { init[s] = ""; });
    if (value.trim() && !hasStructured) init["General Tips"] = value;
    return init;
  }));

  const handleChange = (section: string, val: string) => {
    const next = { ...fields, [section]: val };
    setFields(next);
    onChange(serializeStructuredField(next));
  };

  return (
    <div className="space-y-4">
      <p className="text-on-surface-variant text-xs leading-relaxed">
        Break down the ideal technique into phase-specific notes for precise AI coaching.
      </p>
      {sections.map((s) => (
        <div key={s} className="p-4 rounded-xl bg-surface-container-high border border-white/5">
          <label className={labelClass}>{s}</label>
          <textarea
            className={`${inputClass} min-h-[80px] resize-y`}
            value={fields[s] || ""}
            onChange={(e) => handleChange(s, e.target.value)}
            placeholder={`Notes for ${s.toLowerCase()}...`}
          />
        </div>
      ))}
    </div>
  );
}

function ReferenceEditor({ value, onChange, inputClass, labelClass }: StructuredEditorProps) {
  const sections = ["Reference Object", "Calibration Instructions", "Scale Notes"];
  const parsed = parseStructuredField(value, sections);
  const hasStructured = sections.some((s) => parsed[s].trim());
  const [fields, setFields] = useState<Record<string, string>>(hasStructured ? parsed : (() => {
    const init: Record<string, string> = {};
    sections.forEach((s) => { init[s] = ""; });
    if (value.trim() && !hasStructured) init["Reference Object"] = value;
    return init;
  }));

  const handleChange = (section: string, val: string) => {
    const next = { ...fields, [section]: val };
    setFields(next);
    onChange(serializeStructuredField(next));
  };

  const descriptions: Record<string, string> = {
    "Reference Object": "What real-world object should be in frame for scale (e.g. football, cone, yard line)",
    "Calibration Instructions": "How the AI should use the reference object to calculate distances and angles",
    "Scale Notes": "Additional notes on measurement accuracy or environment considerations",
  };

  return (
    <div className="space-y-4">
      <p className="text-on-surface-variant text-xs leading-relaxed">
        Define reference objects and calibration instructions for accurate AI measurements.
      </p>
      {sections.map((s) => (
        <div key={s} className="p-4 rounded-xl bg-surface-container-high border border-white/5">
          <div className="flex items-center gap-1 mb-1">
            <label className={labelClass}>{s}</label>
            <SectionTooltip tip={descriptions[s]} />
          </div>
          <textarea
            className={`${inputClass} min-h-[70px] resize-y`}
            value={fields[s] || ""}
            onChange={(e) => handleChange(s, e.target.value)}
            placeholder={descriptions[s]}
          />
        </div>
      ))}
    </div>
  );
}

function CameraEditor({ value, onChange, inputClass, labelClass }: StructuredEditorProps) {
  const sections = ["Primary Camera Angle", "Secondary Camera Angle", "Lighting & Environment"];
  const parsed = parseStructuredField(value, sections);
  const hasStructured = sections.some((s) => parsed[s].trim());
  const [fields, setFields] = useState<Record<string, string>>(hasStructured ? parsed : (() => {
    const init: Record<string, string> = {};
    sections.forEach((s) => { init[s] = ""; });
    if (value.trim() && !hasStructured) init["Primary Camera Angle"] = value;
    return init;
  }));

  const handleChange = (section: string, val: string) => {
    const next = { ...fields, [section]: val };
    setFields(next);
    onChange(serializeStructuredField(next));
  };

  const descriptions: Record<string, string> = {
    "Primary Camera Angle": "Best camera position for primary analysis (e.g. sideline, 10 yards back, waist height)",
    "Secondary Camera Angle": "Optional second angle for deeper analysis (e.g. end zone, elevated)",
    "Lighting & Environment": "Tips for optimal video quality (e.g. avoid backlit, outdoor daylight preferred)",
  };

  return (
    <div className="space-y-4">
      <p className="text-on-surface-variant text-xs leading-relaxed">
        Define optimal camera positions and environment guidelines for accurate video analysis.
      </p>
      {sections.map((s) => (
        <div key={s} className="p-4 rounded-xl bg-surface-container-high border border-white/5">
          <div className="flex items-center gap-1 mb-1">
            <label className={labelClass}>{s}</label>
            <SectionTooltip tip={descriptions[s]} />
          </div>
          <textarea
            className={`${inputClass} min-h-[70px] resize-y`}
            value={fields[s] || ""}
            onChange={(e) => handleChange(s, e.target.value)}
            placeholder={descriptions[s]}
          />
        </div>
      ))}
    </div>
  );
}
