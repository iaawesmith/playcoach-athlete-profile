import { useState, useEffect, useCallback } from "react";
import type { TrainingNode, KeyMetric, CommonError, PhaseNote, Badge, EliteVideo } from "../types";
import { updateNode } from "@/services/athleteLab";
import { SectionTooltip } from "./SectionTooltip";
import { TestingPanel } from "./TestingPanel";
import { HelpDrawer } from "./HelpDrawer";

interface NodeEditorProps {
  node: TrainingNode;
  onUpdated: (node: TrainingNode) => void;
  onIconChange?: (nodeId: string, iconUrl: string | null) => void;
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
  mechanics: "Define the natural phases of this skill. You can add, rename, or remove phases as needed for any drill type (routes, QB drops, vertical jump, etc.).",
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

export function NodeEditor({ node, onUpdated, onIconChange }: NodeEditorProps) {
  const [tab, setTab] = useState<TabKey>("basics");
  const [draft, setDraft] = useState<TrainingNode>(node);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

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
          {draft.icon_url ? (
            <img src={draft.icon_url} alt="" className="w-6 h-6 rounded object-cover" />
          ) : (
            <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 24 }}>neurology</span>
          )}
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
          <button
            onClick={() => setHelpOpen(true)}
            title="Open admin guidance for this tab"
            className="ml-auto w-7 h-7 rounded-full bg-primary-container flex items-center justify-center text-white hover:brightness-110 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>help</span>
          </button>
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
                <SectionTooltip tip="Upload an icon or diagram. This will appear next to the node name in the sidebar." />
              </div>
              <div className="flex items-center gap-3">
                {draft.icon_url ? (
                  <div className="relative group">
                    <img src={draft.icon_url} alt="Node icon" className="w-14 h-14 rounded-xl object-cover bg-surface-container-lowest border border-white/5" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <button
                      onClick={() => {
                        update("icon_url", null);
                        onIconChange?.(draft.id, null);
                      }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                    </button>
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-surface-container-lowest border border-outline-variant/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: 24 }}>image</span>
                  </div>
                )}
                <label className="h-11 px-5 rounded-xl bg-surface-container-high border border-outline-variant/10 text-on-surface-variant text-xs font-semibold uppercase tracking-widest flex items-center gap-2 cursor-pointer hover:bg-surface-container-highest transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload</span>
                  {draft.icon_url ? "Replace" : "Upload"}
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
                        onIconChange?.(draft.id, urlData.publicUrl);
                      }
                    }}
                  />
                </label>
              </div>
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

        <HelpDrawer
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          tabKey={tab}
          tabLabel={TABS.find((t) => t.key === tab)?.label ?? tab}
        />
      </div>
    </div>
  );
}

/* ── Sub-editors ── */

function EliteVideosEditor({ videos, onChange }: { videos: EliteVideo[]; onChange: (v: EliteVideo[]) => void }) {
  const [adding, setAdding] = React.useState(false);
  const [newUrl, setNewUrl] = React.useState("");
  const [newLabel, setNewLabel] = React.useState("");
  const [editIdx, setEditIdx] = React.useState<number | null>(null);
  const [editUrl, setEditUrl] = React.useState("");
  const [editLabel, setEditLabel] = React.useState("");

  const inputClass = "w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl px-4 py-3 text-on-surface text-sm placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container/50 transition-colors";

  const handleAdd = () => {
    if (!newUrl.trim()) return;
    onChange([...videos, { url: newUrl.trim(), label: newLabel.trim() || newUrl.trim() }]);
    setNewUrl("");
    setNewLabel("");
    setAdding(false);
  };

  const handleEditSave = (i: number) => {
    if (!editUrl.trim()) return;
    const n = [...videos];
    n[i] = { url: editUrl.trim(), label: editLabel.trim() || editUrl.trim() };
    onChange(n);
    setEditIdx(null);
  };

  const startEdit = (i: number) => {
    setEditIdx(i);
    setEditUrl(videos[i].url);
    setEditLabel(videos[i].label);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <p className="text-on-surface-variant text-xs">
        Elite reference videos the AI uses as benchmarks. Add YouTube links, direct mp4 URLs, or any video reference.
      </p>

      {/* Video list */}
      {videos.length === 0 && !adding && (
        <div className="bg-surface-container rounded-xl p-8 text-center space-y-3">
          <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: 40 }}>video_library</span>
          <p className="text-on-surface-variant text-sm">No reference videos added yet</p>
          <p className="text-on-surface-variant/60 text-xs">Add elite examples for the AI to compare athlete footage against</p>
        </div>
      )}

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {videos.map((v, i) => (
          <div key={i} className="bg-surface-container rounded-xl p-4 group">
            {editIdx === i ? (
              <div className="space-y-3">
                <div>
                  <label className="text-on-surface-variant text-[9px] font-medium uppercase tracking-widest mb-1 block">Label</label>
                  <input className={inputClass} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder='e.g. "Davante Adams - Slant Release Technique"' />
                </div>
                <div>
                  <label className="text-on-surface-variant text-[9px] font-medium uppercase tracking-widest mb-1 block">Video URL</label>
                  <input className={inputClass} value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEditSave(i)} className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">Save</button>
                  <button onClick={() => setEditIdx(null)} className="px-4 py-2 rounded-lg bg-surface-container-high text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary-container mt-0.5" style={{ fontSize: 20 }}>play_circle</span>
                <div className="flex-1 min-w-0">
                  <p className="text-on-surface text-sm font-semibold truncate">{v.label || "Untitled Video"}</p>
                  <p className="text-on-surface-variant/60 text-xs truncate mt-0.5">{v.url}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(i)} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary-container hover:bg-surface-container-high transition-colors">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                  </button>
                  <button onClick={() => onChange(videos.filter((_, j) => j !== i))} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-red-400 hover:bg-surface-container-high transition-colors">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add new video form */}
      {adding ? (
        <div className="bg-surface-container-high rounded-xl p-4 space-y-3 border border-primary-container/20">
          <p className="text-on-surface text-xs font-bold uppercase tracking-widest">Add Reference Video</p>
          <div>
            <label className="text-on-surface-variant text-[9px] font-medium uppercase tracking-widest mb-1 block">Descriptive Label</label>
            <input className={inputClass} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder='e.g. "Tyreek Hill - Slant Route Breakdown"' />
          </div>
          <div>
            <label className="text-on-surface-variant text-[9px] font-medium uppercase tracking-widest mb-1 block">Video URL</label>
            <input className={inputClass} value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">Add</button>
            <button onClick={() => { setAdding(false); setNewUrl(""); setNewLabel(""); }} className="px-4 py-2 rounded-lg bg-surface-container text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full py-3 rounded-xl border border-dashed border-outline-variant/20 text-primary-container text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:border-primary-container/40 hover:bg-surface-container transition-all">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span> Add Video
        </button>
      )}
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
  const defaultSections = ["Release Phase", "Stem Phase", "Break Phase", "Catch Phase", "General Tips"];

  const initFromValue = useCallback((): { name: string; notes: string }[] => {
    if (!value.trim()) {
      return defaultSections.map((s) => ({ name: s, notes: "" }));
    }
    const parsed = parseStructuredField(value, defaultSections);
    const hasStructured = defaultSections.some((s) => parsed[s].trim());
    if (hasStructured) {
      return defaultSections.map((s) => ({ name: s, notes: parsed[s] }));
    }
    // Try to detect arbitrary sections from value
    const lines = value.split("\n");
    const detected: { name: string; notes: string }[] = [];
    let current: { name: string; notes: string } | null = null;
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.*)/);
      if (match && match[1].length < 60) {
        if (current) detected.push(current);
        current = { name: match[1].trim(), notes: match[2].trim() };
      } else if (current) {
        current.notes = current.notes ? current.notes + "\n" + line : line;
      }
    }
    if (current) detected.push(current);
    return detected.length > 0 ? detected : [{ name: "General Tips", notes: value }];
  }, [value]);

  const [phases, setPhases] = useState(initFromValue);
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Sync when node changes (value prop reference changes from parent useEffect)
  useEffect(() => {
    setPhases(initFromValue());
  }, [initFromValue]);

  const serialize = (list: { name: string; notes: string }[]) => {
    return list
      .filter((p) => p.notes.trim())
      .map((p) => `${p.name}: ${p.notes.trim()}`)
      .join("\n\n");
  };

  const updatePhase = (idx: number, notes: string) => {
    const next = phases.map((p, i) => (i === idx ? { ...p, notes } : p));
    setPhases(next);
    onChange(serialize(next));
  };

  const addPhase = () => {
    const next = [...phases, { name: `Phase ${phases.length + 1}`, notes: "" }];
    setPhases(next);
  };

  const removePhase = (idx: number) => {
    const next = phases.filter((_, i) => i !== idx);
    setPhases(next);
    onChange(serialize(next));
  };

  const startRename = (idx: number) => {
    setRenamingIdx(idx);
    setRenameValue(phases[idx].name);
  };

  const confirmRename = () => {
    if (renamingIdx === null) return;
    const trimmed = renameValue.trim();
    if (trimmed) {
      const next = phases.map((p, i) => (i === renamingIdx ? { ...p, name: trimmed } : p));
      setPhases(next);
      onChange(serialize(next));
    }
    setRenamingIdx(null);
  };

  const movePhase = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= phases.length) return;
    const next = [...phases];
    [next[idx], next[target]] = [next[target], next[idx]];
    setPhases(next);
    onChange(serialize(next));
  };

  return (
    <div className="space-y-4">
      <p className="text-on-surface-variant text-xs leading-relaxed">
        Define the natural phases of this skill. Add, rename, reorder, or remove phases as needed for any drill type.
      </p>

      {phases.map((phase, idx) => (
        <div key={idx} className="p-4 rounded-xl bg-surface-container-high border border-white/5 space-y-2">
          <div className="flex items-center gap-2">
            {/* Reorder buttons */}
            <div className="flex flex-col">
              <button onClick={() => movePhase(idx, -1)} disabled={idx === 0} className="text-on-surface-variant/40 hover:text-on-surface disabled:opacity-20 transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>keyboard_arrow_up</span>
              </button>
              <button onClick={() => movePhase(idx, 1)} disabled={idx === phases.length - 1} className="text-on-surface-variant/40 hover:text-on-surface disabled:opacity-20 transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>keyboard_arrow_down</span>
              </button>
            </div>

            {/* Phase name */}
            {renamingIdx === idx ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={confirmRename}
                onKeyDown={(e) => { if (e.key === "Enter") confirmRename(); if (e.key === "Escape") setRenamingIdx(null); }}
                className="bg-surface-container-lowest border border-primary-container/30 rounded-lg px-3 py-1 text-on-surface text-sm font-semibold uppercase tracking-widest focus:outline-none flex-1"
              />
            ) : (
              <button onClick={() => startRename(idx)} className="flex items-center gap-1.5 group flex-1 text-left">
                <span className={labelClass + " mb-0"}>{phase.name}</span>
                <span className="material-symbols-outlined text-on-surface-variant/30 group-hover:text-primary-container transition-colors" style={{ fontSize: 12 }}>edit</span>
              </button>
            )}

            {/* Delete */}
            <button onClick={() => removePhase(idx)} className="text-on-surface-variant/30 hover:text-red-400 transition-colors ml-auto">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          </div>

          <textarea
            className={`${inputClass} min-h-[80px] resize-y`}
            value={phase.notes}
            onChange={(e) => updatePhase(idx, e.target.value)}
            placeholder={`Notes for ${phase.name.toLowerCase()}...`}
          />
        </div>
      ))}

      <button
        onClick={addPhase}
        className="w-full h-10 rounded-xl border border-dashed border-outline-variant/20 text-on-surface-variant text-xs font-semibold uppercase tracking-widest hover:border-primary-container/40 hover:text-primary-container transition-colors flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
        Add Phase
      </button>
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

/* ── Scoring Editor ── */

interface ScoringEditorProps {
  scoringRules: string;
  onScoringRulesChange: (v: string) => void;
  metrics: KeyMetric[];
  inputClass: string;
  labelClass: string;
}

function ScoringEditor({ scoringRules, onScoringRulesChange, metrics, inputClass, labelClass }: ScoringEditorProps) {
  const [simValues, setSimValues] = useState<Record<string, number>>({});

  const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0);
  const weightValid = totalWeight === 100;

  const simulatedScore = metrics.length > 0 && weightValid
    ? Math.round(metrics.reduce((sum, m) => {
        const val = simValues[m.name] ?? 0;
        return sum + (val * m.weight) / 100;
      }, 0))
    : null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#00e639";
    if (score >= 60) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="space-y-6">
      {/* Scoring Rules Text */}
      <div>
        <label className={labelClass}>Scoring Formula Description</label>
        <p className="text-on-surface-variant text-xs mb-2 leading-relaxed">
          Describe how the overall Route Mastery Score is calculated from individual metrics. The AI uses this to explain scores to athletes.
        </p>
        <textarea
          className={`${inputClass} min-h-[120px] resize-y`}
          value={scoringRules}
          onChange={(e) => onScoringRulesChange(e.target.value)}
          placeholder="Describe the scoring formula..."
        />
      </div>

      {/* Weight Distribution Table */}
      <div className="bg-surface-container rounded-xl p-5 border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.4em] flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 16 }}>pie_chart</span>
            Current Weight Distribution
          </h4>
          <span className={`text-xs font-black px-3 py-1 rounded-full ${weightValid ? "bg-primary-container/15 text-primary-container" : "bg-red-500/15 text-red-400"}`}>
            {totalWeight}% {!weightValid && "⚠"}
          </span>
        </div>

        {metrics.length === 0 ? (
          <div className="text-center py-6">
            <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: 32 }}>analytics</span>
            <p className="text-on-surface-variant text-xs mt-2">No metrics defined yet. Add metrics in the Metrics tab.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-on-surface-variant text-[9px] uppercase tracking-[0.3em] border-b border-white/5">
                  <th className="text-left py-2 pr-4 font-semibold">Metric</th>
                  <th className="text-right py-2 px-3 font-semibold">Weight</th>
                  <th className="text-right py-2 px-3 font-semibold">If Score = 90</th>
                  <th className="text-right py-2 pl-3 font-semibold">Contribution</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => {
                  const contribution = (90 * m.weight) / 100;
                  return (
                    <tr key={m.name} className="border-b border-white/5 last:border-0">
                      <td className="py-2.5 pr-4 text-on-surface font-medium">{m.name || "Unnamed"}</td>
                      <td className="py-2.5 px-3 text-right text-on-surface">{m.weight}%</td>
                      <td className="py-2.5 px-3 text-right text-on-surface-variant">90</td>
                      <td className="py-2.5 pl-3 text-right font-bold text-primary-container">{contribution.toFixed(1)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t border-white/10">
                  <td className="py-2.5 pr-4 text-on-surface font-black uppercase text-[10px] tracking-widest">Total</td>
                  <td className={`py-2.5 px-3 text-right font-black ${weightValid ? "text-primary-container" : "text-red-400"}`}>{totalWeight}%</td>
                  <td className="py-2.5 px-3 text-right text-on-surface-variant">—</td>
                  <td className="py-2.5 pl-3 text-right font-black text-on-surface">{weightValid ? "90.0" : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Global Scoring Rules */}
      <div className="bg-surface-container rounded-xl p-5 border border-white/5 space-y-4">
        <h4 className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.4em] flex items-center gap-2">
          <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 16 }}>tune</span>
          Global Scoring Rules (Optional)
        </h4>
        <p className="text-on-surface-variant text-xs leading-relaxed">
          Define bonus/penalty rules and confidence thresholds. These are included in the scoring formula description above.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 rounded-xl bg-surface-container-high border border-white/5">
            <label className={labelClass}>Bonus Rules</label>
            <p className="text-on-surface-variant text-[10px] mb-2">e.g. "+5 if all phases ≥ 80"</p>
            <textarea
              className={`${inputClass} min-h-[60px] resize-y`}
              placeholder="Describe any bonus point rules..."
              value=""
              readOnly
            />
          </div>
          <div className="p-3 rounded-xl bg-surface-container-high border border-white/5">
            <label className={labelClass}>Confidence Thresholds</label>
            <p className="text-on-surface-variant text-[10px] mb-2">e.g. "Below 0.6 = low confidence warning"</p>
            <textarea
              className={`${inputClass} min-h-[60px] resize-y`}
              placeholder="Describe confidence thresholds..."
              value=""
              readOnly
            />
          </div>
        </div>
      </div>

      {/* Scoring Preview Simulator */}
      {metrics.length > 0 && weightValid && (
        <div className="bg-surface-container rounded-xl p-5 border border-white/5 space-y-4">
          <h4 className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.4em] flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 16 }}>calculate</span>
            Scoring Preview Simulator
          </h4>
          <p className="text-on-surface-variant text-xs leading-relaxed">
            Enter sample scores (0–100) for each metric to see the calculated Route Mastery Score.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {metrics.map((m) => (
              <div key={m.name} className="p-3 rounded-xl bg-surface-container-high border border-white/5">
                <label className="text-on-surface-variant text-[9px] font-medium uppercase tracking-widest mb-1 block truncate">{m.name || "Unnamed"}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={`${inputClass} text-center font-bold`}
                    value={simValues[m.name] ?? ""}
                    onChange={(e) => setSimValues((prev) => ({ ...prev, [m.name]: Number(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                  <span className="text-on-surface-variant text-[9px] shrink-0">× {m.weight}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Result */}
          <div className="flex items-center gap-5 pt-2">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center font-black text-2xl shrink-0"
              style={{
                background: simulatedScore !== null
                  ? `linear-gradient(135deg, ${getScoreColor(simulatedScore)}, ${getScoreColor(simulatedScore)}88)`
                  : "#21262b",
                color: "#0b0f12",
              }}
            >
              {simulatedScore ?? "—"}
            </div>
            <div>
              <div className="text-on-surface font-black uppercase tracking-tighter text-lg">Simulated Score</div>
              <p className="text-on-surface-variant text-xs">
                Based on weighted average of {metrics.length} metrics
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
