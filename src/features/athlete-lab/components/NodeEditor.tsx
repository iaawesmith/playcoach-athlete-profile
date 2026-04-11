import { useState, useEffect, useCallback, useRef } from "react";
import type { TrainingNode, KeyMetric, CommonError, PhaseNote, Badge, EliteVideo, NodeStatus, CameraAngle, VideoType, MechanicsSection } from "../types";
import { updateNode, setNodeStatus } from "@/services/athleteLab";
import { SectionTooltip } from "./SectionTooltip";
import { TestingPanel } from "./TestingPanel";
import { HelpDrawer } from "./HelpDrawer";
import { toast } from "sonner";

interface NodeEditorProps {
  node: TrainingNode;
  onUpdated: (node: TrainingNode) => void;
  onIconChange?: (nodeId: string, iconUrl: string | null) => void;
}

type TabKey = "basics" | "videos" | "overview" | "mechanics" | "metrics" | "scoring" | "errors" | "phases" | "reference" | "camera" | "checkpoints" | "prompt" | "badges" | "test";

const TABS: { key: TabKey; label: string; icon: string; subtitle: string }[] = [
  { key: "basics", label: "Basics", icon: "edit", subtitle: "Set the core identity and visual representation of this training node." },
  { key: "videos", label: "Videos", icon: "video_library", subtitle: "Add high-quality elite reference videos for AI benchmark comparison. Minimum 3–5 videos suggested." },
  { key: "overview", label: "Overview", icon: "description", subtitle: "Provide high-level context about the skill and its importance in game situations." },
  { key: "phases", label: "Phases", icon: "timeline", subtitle: "Define the natural phases of this skill. Minimum 4–5 phases suggested for granular analysis." },
  { key: "mechanics", label: "Mechanics", icon: "engineering", subtitle: "Define detailed coaching cues for each phase of the skill. Minimum 4–5 phases suggested for robust analysis." },
  { key: "metrics", label: "Metrics", icon: "analytics", subtitle: "Define the measurable components the AI will evaluate. Minimum 4–6 metrics suggested for balanced scoring." },
  { key: "scoring", label: "Scoring", icon: "scoreboard", subtitle: "Configure how metrics combine into the final 0-100 mastery score." },
  { key: "errors", label: "Errors", icon: "error_outline", subtitle: "Document common mistakes and their corrections. Minimum 4–5 errors suggested." },
  { key: "reference", label: "Reference", icon: "straighten", subtitle: "Specify reference objects and calibration instructions for accurate AI measurements." },
  { key: "camera", label: "Camera", icon: "videocam", subtitle: "Provide guidelines for optimal video recording setup and camera positioning." },
  { key: "checkpoints", label: "Checkpoints", icon: "flag", subtitle: "Define key moments the AI should analyze closely. Minimum 6–8 checkpoints suggested." },
  { key: "prompt", label: "LLM Prompt", icon: "smart_toy", subtitle: "Customize the tone, structure, and persona of the AI coach feedback." },
  { key: "badges", label: "Badges", icon: "military_tech", subtitle: "Create achievement badges to motivate athletes and reward milestones. Minimum 4–6 badges suggested." },
  { key: "test", label: "Run Analysis", icon: "science", subtitle: "Test the node configuration with sample videos and review AI output." },
];


/* Critical tabs that auto-draft when changed on a live node */
const CRITICAL_TABS: TabKey[] = ["metrics", "phases", "scoring", "prompt"];

/* ── Shared style constants ── */
const INPUT_CLASS = "w-full border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface text-sm placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-container/70 focus:ring-2 focus:ring-primary-container/30 focus:shadow-[0_0_8px_rgba(0,230,57,0.15)] transition-all bg-[#0E1319]";
const LABEL_CLASS = "text-on-surface-variant text-[10px] font-medium uppercase tracking-widest";
const CARD_CLASS = "p-5 rounded-xl border border-outline-variant/20 space-y-3 bg-[#1A2029]";

/* ── Completeness check ── */
interface BlockingItem { label: string; detail: string }

function checkCompleteness(node: TrainingNode): BlockingItem[] {
  const issues: BlockingItem[] = [];

  // At least 1 video with start/end timestamps
  const videosWithTimestamps = node.elite_videos.filter(
    (v) => v.url && v.url.trim().length > 0
  );
  if (videosWithTimestamps.length === 0) {
    issues.push({ label: "Videos", detail: "At least 1 reference video is required" });
  }

  // At least 4 metrics and weights sum to 100
  if (node.key_metrics.length < 4) {
    issues.push({ label: "Metrics", detail: `At least 4 metrics required (currently ${node.key_metrics.length})` });
  }
  const totalWeight = node.key_metrics.reduce((s, m) => s + m.weight, 0);
  if (totalWeight !== 100) {
    issues.push({ label: "Metrics", detail: `Metric weights must add up to 100% (currently ${totalWeight}%)` });
  }

  // At least 1 phase
  if (node.phase_breakdown.length === 0) {
    issues.push({ label: "Phases", detail: "At least 1 phase with notes is required" });
  }

  // LLM prompt not empty
  if (!node.llm_prompt_template || node.llm_prompt_template.trim().length === 0) {
    issues.push({ label: "LLM Prompt", detail: "Prompt template cannot be empty" });
  }

  // Position (solution class) must be set
  if (!node.position || node.position.trim().length === 0) {
    issues.push({ label: "Training Status", detail: "A position / solution class must be set" });
  }

  // Clip duration must be set and valid
  if (!node.clip_duration_min || node.clip_duration_min < 1) {
    issues.push({ label: "Clip Duration", detail: "Minimum clip duration must be at least 1 second" });
  }
  if (!node.clip_duration_max || node.clip_duration_max < 1) {
    issues.push({ label: "Clip Duration", detail: "Maximum clip duration is required" });
  }
  if (node.clip_duration_min && node.clip_duration_max && node.clip_duration_min >= node.clip_duration_max) {
    issues.push({ label: "Clip Duration", detail: "Minimum must be less than maximum" });
  }

  // Every mechanics section must be linked to a valid phase
  try {
    const mechanicsSections: MechanicsSection[] = node.pro_mechanics ? JSON.parse(node.pro_mechanics) : [];
    if (Array.isArray(mechanicsSections)) {
      const phaseIds = new Set((node.phase_breakdown || []).map(p => p.id).filter(Boolean));
      for (const sec of mechanicsSections) {
        if (!sec.phase_id || !phaseIds.has(sec.phase_id)) {
          issues.push({ label: "Mechanics", detail: "All mechanics sections must be linked to a valid phase" });
          break;
        }
      }
    }
  } catch { /* old format, ignore */ }

  return issues;
}

/* ── Status Toggle Modal ── */
function StatusModal({ mode, blockingItems, onConfirm, onCancel, toggling }: {
  mode: "go-live" | "go-draft" | "blocking";
  blockingItems?: BlockingItem[];
  onConfirm: () => void;
  onCancel: () => void;
  toggling: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md mx-4 rounded-xl border border-outline-variant/20 p-6 space-y-4" style={{ backgroundColor: '#1A2029' }}>
        {mode === "blocking" && (
          <>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400" style={{ fontSize: 22 }}>warning</span>
              <h2 className="text-on-surface font-black uppercase tracking-tighter text-lg">Complete These Before Going Live</h2>
            </div>
            <div className="space-y-2">
              {blockingItems?.map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <div>
                    <span className="text-on-surface font-semibold">{item.label}</span>
                    <span className="text-on-surface-variant"> — {item.detail}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={onCancel} className="h-10 px-6 rounded-full border border-outline-variant/20 text-on-surface font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all" style={{ backgroundColor: '#111720' }}>
                Got It
              </button>
            </div>
          </>
        )}
        {mode === "go-live" && (
          <>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 22 }}>rocket_launch</span>
              <h2 className="text-on-surface font-black uppercase tracking-tighter text-lg">Go Live</h2>
            </div>
            <p className="text-on-surface-variant text-sm">This node will trigger automatic analysis on athlete uploads. Go live?</p>
            <div className="flex justify-end gap-2">
              <button onClick={onCancel} className="h-10 px-5 rounded-full border border-outline-variant/20 text-on-surface-variant font-bold uppercase tracking-[0.15em] text-xs active:scale-95 transition-all" style={{ backgroundColor: '#111720' }}>
                Cancel
              </button>
              <button onClick={onConfirm} disabled={toggling} className="h-10 px-6 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all disabled:opacity-40">
                {toggling ? "Activating..." : "Go Live"}
              </button>
            </div>
          </>
        )}
        {mode === "go-draft" && (
          <>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 22 }}>pause_circle</span>
              <h2 className="text-on-surface font-black uppercase tracking-tighter text-lg">Set to Draft</h2>
            </div>
            <p className="text-on-surface-variant text-sm">Setting this node to Draft will pause automatic analysis for new uploads. Existing results are not affected. Continue?</p>
            <div className="flex justify-end gap-2">
              <button onClick={onCancel} className="h-10 px-5 rounded-full border border-outline-variant/20 text-on-surface-variant font-bold uppercase tracking-[0.15em] text-xs active:scale-95 transition-all" style={{ backgroundColor: '#111720' }}>
                Cancel
              </button>
              <button onClick={onConfirm} disabled={toggling} className="h-10 px-6 rounded-full border border-outline-variant/20 text-on-surface font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all" style={{ backgroundColor: '#2a2f38' }}>
                {toggling ? "Updating..." : "Set to Draft"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function NodeEditor({ node, onUpdated, onIconChange }: NodeEditorProps) {
  const [tab, setTab] = useState<TabKey>("basics");
  const [draft, setDraft] = useState<TrainingNode>(node);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [statusModal, setStatusModal] = useState<"go-live" | "go-draft" | "blocking" | null>(null);
  const [blockingItems, setBlockingItems] = useState<BlockingItem[]>([]);
  const [toggling, setToggling] = useState(false);
  const criticalChanged = useRef(false);

  useEffect(() => {
    setDraft(node);
    setDirty(false);
    criticalChanged.current = false;
  }, [node.id]);

  const update = useCallback(<K extends keyof TrainingNode>(key: K, value: TrainingNode[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }, []);

  /* Track critical field changes */
  const updateWithCriticalTrack = useCallback(<K extends keyof TrainingNode>(key: K, value: TrainingNode[K]) => {
    update(key, value);
    if (node.status === "live") {
      criticalChanged.current = true;
    }
  }, [update, node.status]);

  const save = async () => {
    setSaving(true);
    try {
      const shouldAutoDraft = node.status === "live" && criticalChanged.current;
      const isLiveSave = node.status === "live" && !shouldAutoDraft;
      const updates: Partial<TrainingNode> = {
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
        knowledge_base: draft.knowledge_base,
        clip_duration_min: draft.clip_duration_min,
        clip_duration_max: draft.clip_duration_max,
      };
      if (shouldAutoDraft) {
        updates.status = "draft";
      }
      if (isLiveSave) {
        updates.node_version = (draft.node_version ?? 1) + 1;
      }
      const updated = await updateNode(draft.id, updates);
      onUpdated(updated);
      setDirty(false);
      criticalChanged.current = false;
      if (shouldAutoDraft) {
        toast("Node set to Draft — pipeline config was changed. Review and re-activate when ready.");
      }
    } catch {
      // error handling
    } finally {
      setSaving(false);
    }
  };

  const handleStatusToggle = () => {
    const currentStatus: NodeStatus = draft.status ?? "draft";
    if (currentStatus === "draft") {
      const issues = checkCompleteness(draft);
      if (issues.length > 0) {
        setBlockingItems(issues);
        setStatusModal("blocking");
      } else {
        setStatusModal("go-live");
      }
    } else {
      setStatusModal("go-draft");
    }
  };

  const confirmStatusChange = async () => {
    setToggling(true);
    try {
      const newStatus: NodeStatus = draft.status === "live" ? "draft" : "live";
      const updates: Partial<TrainingNode> = { status: newStatus };
      // On first go-live, ensure version is at least 1
      if (newStatus === "live" && (!draft.node_version || draft.node_version < 1)) {
        updates.node_version = 1;
      }
      const updated = await updateNode(draft.id, updates);
      onUpdated(updated);
      setDraft((d) => ({ ...d, ...updates }));
      setStatusModal(null);
    } catch {
      // error
    } finally {
      setToggling(false);
    }
  };

  const currentStatus: NodeStatus = draft.status ?? "draft";
  const isLive = currentStatus === "live";

  return (
    <div className="flex-1 h-full overflow-y-auto" style={{ backgroundColor: '#111720' }}>
      {/* ── Node title bar ── */}
      <div className="sticky top-0 z-10 backdrop-blur-xl px-6 py-4 flex items-center justify-between border-b border-outline-variant/20" style={{ backgroundColor: 'rgba(26,32,41,0.92)' }}>
        <div className="flex items-center gap-3">
          {draft.icon_url ? (
            <img src={draft.icon_url} alt="" className="w-6 h-6 rounded object-cover" />
          ) : (
            <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 24 }}>neurology</span>
          )}
          <h1 className="text-on-surface font-black uppercase tracking-tighter text-xl">{draft.name || "New Node"}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleStatusToggle}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] border cursor-pointer hover:brightness-110 active:scale-95 transition-all ${
              isLive
                ? "border-primary-container/30 bg-primary-container/10 text-primary-container"
                : "border-outline-variant/30 bg-surface-container text-on-surface-variant"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isLive ? "bg-primary-container" : "bg-on-surface-variant/50"}`} />
            {isLive ? "Live" : "Draft"}
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>expand_more</span>
          </button>
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
      </div>

      {statusModal && (
        <StatusModal
          mode={statusModal}
          blockingItems={blockingItems}
          onConfirm={confirmStatusChange}
          onCancel={() => setStatusModal(null)}
          toggling={toggling}
        />
      )}

      {/* ── Tab row ── */}
      <div className="px-6 pt-3 pb-2 flex gap-1 overflow-x-auto scrollbar-thin shrink-0 border-b border-outline-variant/10" style={{ backgroundColor: '#131920' }}>
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

      {/* ── Content ── */}
      <div className="space-y-0">
        {/* Green banner header */}
        {(() => {
          const activeTab = TABS.find((t) => t.key === tab);
          return (
            <div className="px-6 py-4 bg-primary-container/10 border-b border-primary-container/20 flex items-start gap-3">
              <span className="material-symbols-outlined text-primary-container mt-0.5" style={{ fontSize: 20 }}>
                {activeTab?.icon}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-on-surface font-extrabold uppercase text-sm tracking-wide leading-tight">
                  {activeTab?.label}
                </h3>
                <p className="text-on-surface-variant text-xs leading-snug mt-1">
                  {activeTab?.subtitle}
                </p>
              </div>
              <button
                onClick={() => setHelpOpen(true)}
                title="Open admin guidance for this tab"
                className="w-6 h-6 rounded-full bg-primary-container flex items-center justify-center text-primary-foreground hover:brightness-110 transition-all active:scale-95 shrink-0 mt-0.5"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 0, 'wght' 700" }}>help</span>
              </button>
            </div>
          );
        })()}

        {/* Tab content area */}
        <div className="px-6 py-6 space-y-6">

        {tab === "basics" && (
          <div className="space-y-4">
             <div>
              <div className="flex items-center gap-1.5 mb-2">
                <label className={LABEL_CLASS}>Route / Skill Name</label>
                <SectionTooltip tip="The name athletes see in their training feed and results. Keep it specific — 'Slant Route' not 'Route Running.'" />
              </div>
              <input className={INPUT_CLASS} value={draft.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Slant Route" />
            </div>

            <div className="border-t border-white/[0.11] my-6" />

            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <label className={LABEL_CLASS}>Icon / Visual Diagram</label>
                <SectionTooltip tip="Displayed next to this node everywhere it appears in the athlete app. Use a clear diagram that shows the route or movement pattern at a glance." />
              </div>
              <div className="flex items-center gap-3">
                {draft.icon_url ? (
                  <div className="relative group">
                    <img src={draft.icon_url} alt="Node icon" className="w-14 h-14 rounded-xl object-cover border border-outline-variant/20" style={{ backgroundColor: '#0E1319' }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
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
                  <div className="w-14 h-14 rounded-xl border border-outline-variant/20 flex items-center justify-center" style={{ backgroundColor: '#0E1319' }}>
                    <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: 24 }}>image</span>
                  </div>
                )}
                <label className="h-11 px-5 rounded-xl border border-outline-variant/20 text-on-surface-variant text-xs font-semibold uppercase tracking-widest flex items-center gap-2 cursor-pointer hover:bg-surface-container-highest transition-colors" style={{ backgroundColor: '#1A2029' }}>
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

            <div className="border-t border-white/[0.11] my-6" />

            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <label className={LABEL_CLASS}>Clip Duration</label>
                <SectionTooltip tip="The acceptable video length for uploads against this node. Videos shorter than the minimum or longer than the maximum are automatically rejected before analysis runs — saving compute and catching accidental full-session uploads." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`${LABEL_CLASS} block mb-1`}>Minimum</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className={INPUT_CLASS + " pr-12"}
                      value={draft.clip_duration_min ?? 5}
                      onChange={(e) => update("clip_duration_min", Math.max(1, Math.round(Number(e.target.value))))}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-xs">sec</span>
                  </div>
                </div>
                <div>
                  <label className={`${LABEL_CLASS} block mb-1`}>Maximum</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={300}
                      step={1}
                      className={INPUT_CLASS + " pr-12"}
                      value={draft.clip_duration_max ?? 30}
                      onChange={(e) => update("clip_duration_max", Math.min(300, Math.max(1, Math.round(Number(e.target.value)))))}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-xs">sec</span>
                  </div>
                </div>
              </div>
              {draft.clip_duration_min != null && draft.clip_duration_max != null && draft.clip_duration_min >= draft.clip_duration_max && (
                <p className="text-red-400 text-xs font-medium">Minimum must be less than maximum</p>
              )}
              
            </div>

            {/* Version indicator */}
            <div className="pt-8 mt-2 border-t border-white/[0.27]" />
            <div className="pt-5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-on-surface-variant/40 text-[10px] font-medium uppercase tracking-widest">Node Version</span>
                <span className="text-on-surface-variant/60 text-[10px] font-semibold">v{draft.node_version ?? 1}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-on-surface-variant/40 text-[10px] font-medium uppercase tracking-widest">Last Saved</span>
                <span className="text-on-surface-variant/60 text-[10px] font-semibold">
                  {draft.updated_at ? new Date(draft.updated_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"}
                </span>
              </div>
            </div>
          </div>
        )}

        {tab === "videos" && (
          <EliteVideosEditor videos={draft.elite_videos} onChange={(v) => update("elite_videos", v)} />
        )}

        {tab === "overview" && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <label className={LABEL_CLASS}>Skill Overview</label>
              <SectionTooltip tip="A short description of what this skill is and why it matters in game situations. Shown to athletes at the top of their training feed before they film. Keep it under 3 sentences — clear, direct, and written for a 14-22 year old athlete." />
            </div>
            <textarea className={`${INPUT_CLASS} min-h-[200px] resize-y`} value={draft.overview} onChange={(e) => update("overview", e.target.value)} placeholder="Describe the purpose of this skill..." />
          </div>
        )}

        {tab === "mechanics" && (
          <div className="space-y-4">
            <div className="flex items-center gap-1.5">
              <label className={LABEL_CLASS}>Phase Mechanics</label>
              <SectionTooltip tip="Describe the coaching cues and technique for each phase of this skill. Each section must be linked to a phase defined in the Phases tab — this ensures the AI feedback engine receives the correct coaching context for each movement phase. Write in direct coaching language aimed at athletes aged 14-22." />
            </div>
            <MechanicsEditor value={draft.pro_mechanics} onChange={(v) => update("pro_mechanics", v)} phases={draft.phase_breakdown} />
          </div>
        )}

        {tab === "metrics" && (
          <KeyMetricsEditor metrics={draft.key_metrics} onChange={(m) => updateWithCriticalTrack("key_metrics", m)} />
        )}

        {tab === "scoring" && (
          <ScoringEditor
            scoringRules={draft.scoring_rules}
            onScoringRulesChange={(v) => updateWithCriticalTrack("scoring_rules", v)}
            metrics={draft.key_metrics}
          />
        )}

        {tab === "errors" && (
          <CommonErrorsEditor errors={draft.common_errors} onChange={(e) => update("common_errors", e)} />
        )}

        {tab === "phases" && (
          <PhasesEditor phases={draft.phase_breakdown} onChange={(p) => updateWithCriticalTrack("phase_breakdown", p)} />
        )}

        {tab === "reference" && (
          <ReferenceEditor value={draft.reference_object} onChange={(v) => update("reference_object", v)} />
        )}

        {tab === "camera" && (
          <CameraEditor value={draft.camera_guidelines} onChange={(v) => update("camera_guidelines", v)} />
        )}

        {tab === "checkpoints" && (
          <CheckpointsEditor checkpoints={draft.form_checkpoints} onChange={(c) => update("form_checkpoints", c)} />
        )}

        {tab === "prompt" && (
          <textarea className={`${INPUT_CLASS} min-h-[300px] resize-y font-mono text-xs`} value={draft.llm_prompt_template} onChange={(e) => updateWithCriticalTrack("llm_prompt_template", e.target.value)} placeholder="Custom LLM prompt template..." />
        )}

        {tab === "badges" && (
          <BadgesEditor badges={draft.badges} onChange={(b) => update("badges", b)} />
        )}

        {tab === "test" && (
          <TestingPanel node={draft} />
        )}

        </div>

        <HelpDrawer
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          tabKey={tab}
          tabLabel={TABS.find((t) => t.key === tab)?.label ?? tab}
          knowledgeBase={draft.knowledge_base ?? {}}
          onKnowledgeBaseChange={(kb) => { update("knowledge_base", kb); }}
        />
      </div>
    </div>
  );
}

/* ── Sub-editors ── */

function EliteVideosEditor({ videos, onChange }: { videos: EliteVideo[]; onChange: (v: EliteVideo[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newStartSec, setNewStartSec] = useState<string>("");
  const [newEndSec, setNewEndSec] = useState<string>("");
  const [newCameraAngle, setNewCameraAngle] = useState<CameraAngle | "">("");
  const [newVideoType, setNewVideoType] = useState<VideoType>("both");
  const [newIsReference, setNewIsReference] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editStartSec, setEditStartSec] = useState<string>("");
  const [editEndSec, setEditEndSec] = useState<string>("");
  const [editCameraAngle, setEditCameraAngle] = useState<CameraAngle | "">("");
  const [editVideoType, setEditVideoType] = useState<VideoType>("both");
  const [editIsReference, setEditIsReference] = useState(false);

  const ANGLE_OPTIONS: { value: CameraAngle; label: string }[] = [
    { value: "sideline", label: "Sideline" },
    { value: "endzone", label: "Endzone" },
    { value: "behind_qb", label: "Behind QB" },
  ];

  const TYPE_OPTIONS: { value: VideoType; label: string }[] = [
    { value: "educational", label: "Educational" },
    { value: "analysis", label: "Analysis" },
    { value: "both", label: "Both" },
  ];

  const angleLabelMap: Record<CameraAngle, string> = { sideline: "Sideline", endzone: "Endzone", behind_qb: "Behind QB" };
  const typeLabelMap: Record<VideoType, string> = { educational: "Educational", analysis: "Analysis", both: "Both" };

  const clearReferenceExcept = (exceptIdx: number, vids: EliteVideo[]): EliteVideo[] => {
    return vids.map((v, i) => i === exceptIdx ? v : { ...v, is_reference: false });
  };

  const handleAdd = () => {
    if (!newUrl.trim()) return;
    if (!newCameraAngle) return;
    let updated: EliteVideo[] = [...videos, {
      url: newUrl.trim(),
      label: newLabel.trim() || newUrl.trim(),
      start_seconds: newStartSec ? parseInt(newStartSec) : null,
      end_seconds: newEndSec ? parseInt(newEndSec) : null,
      camera_angle: newCameraAngle || null,
      video_type: newVideoType,
      is_reference: newIsReference,
    }];
    if (newIsReference) {
      updated = clearReferenceExcept(updated.length - 1, updated);
      const hadRef = videos.some(v => v.is_reference);
      if (hadRef) toast("Reference video updated");
    }
    onChange(updated);
    setNewUrl(""); setNewLabel(""); setNewStartSec(""); setNewEndSec("");
    setNewCameraAngle(""); setNewVideoType("both"); setNewIsReference(false);
    setAdding(false);
  };

  const handleEditSave = (i: number) => {
    if (!editUrl.trim()) return;
    if (!editCameraAngle) return;
    const n = [...videos];
    n[i] = {
      url: editUrl.trim(),
      label: editLabel.trim() || editUrl.trim(),
      start_seconds: editStartSec ? parseInt(editStartSec) : null,
      end_seconds: editEndSec ? parseInt(editEndSec) : null,
      camera_angle: editCameraAngle || null,
      video_type: editVideoType,
      is_reference: editIsReference,
    };
    let updated = n;
    if (editIsReference) {
      updated = clearReferenceExcept(i, updated);
      const hadOtherRef = videos.some((v, j) => j !== i && v.is_reference);
      if (hadOtherRef) toast("Reference video updated");
    }
    onChange(updated);
    setEditIdx(null);
  };

  const startEdit = (i: number) => {
    setEditIdx(i);
    setEditUrl(videos[i].url);
    setEditLabel(videos[i].label);
    setEditStartSec(videos[i].start_seconds != null ? String(videos[i].start_seconds) : "");
    setEditEndSec(videos[i].end_seconds != null ? String(videos[i].end_seconds) : "");
    setEditCameraAngle(videos[i].camera_angle || "");
    setEditVideoType(videos[i].video_type || "both");
    setEditIsReference(videos[i].is_reference || false);
  };

  const clipDuration = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return null;
    const s = parseInt(startStr), e = parseInt(endStr);
    if (isNaN(s) || isNaN(e)) return null;
    if (e <= s) return { valid: false, text: "Invalid range" };
    return { valid: true, text: `Clip: ${e - s} sec` };
  };

  const renderFormFields = (
    startSec: string, setStartSec: (v: string) => void,
    endSec: string, setEndSec: (v: string) => void,
    cameraAngle: CameraAngle | "", setCameraAngle: (v: CameraAngle | "") => void,
    videoType: VideoType, setVideoType: (v: VideoType) => void,
    isReference: boolean, setIsReference: (v: boolean) => void,
    showAngleError: boolean,
  ) => {
    const clip = clipDuration(startSec, endSec);
    return (
      <>
        {/* Clip Window */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <label className={LABEL_CLASS}>Clip Window</label>
            <SectionTooltip tip="The exact start and end timestamps of the relevant movement within the video. The analysis pipeline extracts only this window — set it tight around the specific route or skill being demonstrated to avoid processing dead time." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`${LABEL_CLASS} block mb-1`}>Start</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step={1}
                  className={INPUT_CLASS + " pr-12"}
                  value={startSec}
                  onChange={(e) => setStartSec(e.target.value)}
                  placeholder="0"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-xs">sec</span>
              </div>
            </div>
            <div>
              <label className={`${LABEL_CLASS} block mb-1`}>End</label>
              <div className="relative">
                <input
                  type="number"
                  step={1}
                  className={INPUT_CLASS + " pr-12"}
                  value={endSec}
                  onChange={(e) => setEndSec(e.target.value)}
                  placeholder="0"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-xs">sec</span>
              </div>
            </div>
          </div>
          {clip && (
            <p className={`text-xs mt-1.5 ${clip.valid ? "text-on-surface-variant/50" : "text-amber-400"}`}>
              {clip.text}
            </p>
          )}
        </div>

        {/* Camera Angle */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <label className={LABEL_CLASS}>Camera Angle</label>
            <SectionTooltip tip="The angle this video was filmed from. Must match the Reference tab calibration for this angle — used by the pipeline to convert pixel measurements to real-world distances. Choose the closest match if the angle is not exact." />
          </div>
          <div className="relative">
            <select
              className={INPUT_CLASS + " appearance-none cursor-pointer"}
              value={cameraAngle}
              onChange={(e) => setCameraAngle(e.target.value as CameraAngle | "")}
            >
              <option value="">Select angle</option>
              {ANGLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 pointer-events-none">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>expand_more</span>
            </span>
          </div>
          {showAngleError && !cameraAngle && (
            <p className="text-red-400 text-xs font-medium mt-1">Camera angle is required</p>
          )}
        </div>

        {/* Video Type */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <label className={LABEL_CLASS}>Video Type</label>
            <SectionTooltip tip="Educational — shown to athletes as a learning example but not used in analysis calibration. Analysis — used by the pipeline as a reference for metric calibration. Both — serves both purposes." />
          </div>
          <div className="flex gap-1">
            {TYPE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setVideoType(o.value)}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-[0.15em] transition-all ${
                  videoType === o.value
                    ? "bg-primary-container/15 text-primary-container border border-primary-container/30"
                    : "text-on-surface-variant border border-outline-variant/20 hover:bg-surface-container-highest"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reference Toggle */}
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="flex items-center gap-1.5">
              <label className={LABEL_CLASS}>Reference Video</label>
              <SectionTooltip tip="The single video shown to athletes alongside their results as the elite performance benchmark. Only one video per node can be the Reference. Toggling this on will automatically remove it from any other video currently flagged as Reference." />
            </div>
            <p className="text-on-surface-variant/50 text-[10px] mt-0.5">Shown to athletes as the elite example alongside their results. One per node.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsReference(!isReference)}
            className={`relative w-11 h-6 rounded-full transition-colors ${isReference ? "bg-primary-container" : "bg-outline-variant/30"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-lg transition-transform ${isReference ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
      </>
    );
  };

  const [addAngleError, setAddAngleError] = useState(false);
  const [editAngleError, setEditAngleError] = useState(false);

  const handleAddWithValidation = () => {
    if (!newCameraAngle) {
      setAddAngleError(true);
      return;
    }
    setAddAngleError(false);
    handleAdd();
  };

  const handleEditSaveWithValidation = (i: number) => {
    if (!editCameraAngle) {
      setEditAngleError(true);
      return;
    }
    setEditAngleError(false);
    handleEditSave(i);
  };

  return (
    <div className="space-y-4">
      {/* Section label */}
      <div className="flex items-center gap-1.5">
        <label className={LABEL_CLASS}>Reference Videos</label>
        <SectionTooltip tip="Add YouTube clips used for athlete education and pipeline calibration. Set start and end timestamps on any video used for analysis. Only one video can serve as the Reference — the elite example shown alongside athlete results." />
      </div>

      {videos.length === 0 && !adding && (
        <div className={CARD_CLASS + " text-center"}>
          <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: 40 }}>video_library</span>
          <p className="text-on-surface-variant text-sm">No reference videos added yet</p>
          <p className="text-on-surface-variant/60 text-xs">Add elite examples for the AI to compare athlete footage against</p>
        </div>
      )}

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {videos.map((v, i) => (
          <div key={i} className={CARD_CLASS + " group"}>
            {editIdx === i ? (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <label className={LABEL_CLASS}>Descriptive Label</label>
                    <SectionTooltip tip="The name shown to athletes and admins when this video appears in the training feed. Be specific — include the player name and what the clip demonstrates." />
                  </div>
                  <input className={INPUT_CLASS} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder='e.g. "Davante Adams - Slant Release Technique"' />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <label className={LABEL_CLASS}>Video URL</label>
                    <SectionTooltip tip="Paste a full YouTube URL. The video must be publicly accessible or unlisted. Private videos cannot be loaded." />
                  </div>
                  <input className={INPUT_CLASS} value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
                </div>
                {renderFormFields(editStartSec, setEditStartSec, editEndSec, setEditEndSec, editCameraAngle, setEditCameraAngle, editVideoType, setEditVideoType, editIsReference, setEditIsReference, editAngleError)}
                <div className="flex gap-2">
                  <button onClick={() => handleEditSaveWithValidation(i)} className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">Save</button>
                  <button onClick={() => { setEditIdx(null); setEditAngleError(false); }} className="px-4 py-2 rounded-lg text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors" style={{ backgroundColor: '#1A2029' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary-container mt-0.5" style={{ fontSize: 20 }}>play_circle</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-on-surface text-sm font-semibold truncate flex-1 min-w-0">{v.label || "Untitled Video"}</p>
                  </div>
                  <p className="text-on-surface-variant/60 text-xs truncate mt-0.5">{v.url}</p>
                  <div className="flex items-center gap-2 mt-2.5">
                    {v.camera_angle && (
                      <span className="text-on-surface-variant/40 text-[10px] font-medium">{angleLabelMap[v.camera_angle]}</span>
                    )}
                    {v.camera_angle && v.video_type && (
                      <span className="text-on-surface-variant/20">·</span>
                    )}
                    {v.video_type && (
                      <span className="text-on-surface-variant/40 text-[10px] font-medium">{typeLabelMap[v.video_type]}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {v.is_reference && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-primary-container/15 text-primary-container border border-primary-container/30">Reference</span>
                  )}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(i)} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary-container transition-colors" style={{ backgroundColor: '#111720' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                    </button>
                    <button onClick={() => onChange(videos.filter((_, j) => j !== i))} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-red-400 transition-colors" style={{ backgroundColor: '#111720' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <div className={CARD_CLASS + " border-primary-container/20"}>
          <p className="text-on-surface text-xs font-bold uppercase tracking-widest">Add Reference Video</p>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <label className={LABEL_CLASS}>Descriptive Label</label>
              <SectionTooltip tip="The name shown to athletes and admins when this video appears in the training feed. Be specific — include the player name and what the clip demonstrates." />
            </div>
            <input className={INPUT_CLASS} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder='e.g. "Tyreek Hill - Slant Route Breakdown"' />
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <label className={LABEL_CLASS}>Video URL</label>
              <SectionTooltip tip="Paste a full YouTube URL. The video must be publicly accessible or unlisted. Private videos cannot be loaded." />
            </div>
            <input className={INPUT_CLASS} value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
          </div>
          {renderFormFields(newStartSec, setNewStartSec, newEndSec, setNewEndSec, newCameraAngle, setNewCameraAngle, newVideoType, setNewVideoType, newIsReference, setNewIsReference, addAngleError)}
          <div className="flex gap-2">
            <button onClick={handleAddWithValidation} className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">Add</button>
            <button onClick={() => { setAdding(false); setNewUrl(""); setNewLabel(""); setNewStartSec(""); setNewEndSec(""); setNewCameraAngle(""); setNewVideoType("both"); setNewIsReference(false); setAddAngleError(false); }} className="px-4 py-2 rounded-lg text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors" style={{ backgroundColor: '#1A2029' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full py-3 rounded-xl border border-dashed border-outline-variant/20 text-primary-container text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:border-primary-container/40 transition-all" style={{ backgroundColor: '#131920' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span> Add Video
        </button>
      )}
    </div>
  );
}

function KeyMetricsEditor({ metrics, onChange }: { metrics: KeyMetric[]; onChange: (m: KeyMetric[]) => void }) {
  const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0);

  return (
    <div className="space-y-4">
      <div className={`text-xs font-semibold ${totalWeight === 100 ? "text-primary-container" : "text-orange-400"}`}>
        Total Weight: {totalWeight}% {totalWeight !== 100 && "(should be 100%)"}
      </div>
      {metrics.map((m, i) => (
        <div key={i} className={CARD_CLASS}>
          <div className="flex items-center justify-between">
            <span className="text-on-surface text-xs font-bold">Metric {i + 1}</span>
            <button onClick={() => { if (window.confirm(`Delete Metric ${i + 1}?`)) onChange(metrics.filter((_, j) => j !== i)); }} className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/10 text-red-400/70 hover:bg-red-500/20 hover:text-red-400 transition-all" title="Delete metric">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
           <div className="grid grid-cols-2 gap-3">
            <div><div className={`${LABEL_CLASS} mb-1`}>Name</div><input className={INPUT_CLASS} value={m.name} onChange={(e) => { const n = [...metrics]; n[i] = { ...m, name: e.target.value }; onChange(n); }} /></div>
            <div><div className={`${LABEL_CLASS} mb-1`}>Unit</div><input className={INPUT_CLASS} value={m.unit} onChange={(e) => { const n = [...metrics]; n[i] = { ...m, unit: e.target.value }; onChange(n); }} /></div>
          </div>
          <div><div className={`${LABEL_CLASS} mb-1`}>Description</div><textarea className={`${INPUT_CLASS} min-h-[60px] resize-y`} value={m.description} onChange={(e) => { const n = [...metrics]; n[i] = { ...m, description: e.target.value }; onChange(n); }} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><div className={`${LABEL_CLASS} mb-1`}>Elite Target</div><input className={INPUT_CLASS} value={m.eliteTarget} onChange={(e) => { const n = [...metrics]; n[i] = { ...m, eliteTarget: e.target.value }; onChange(n); }} /></div>
            <div><div className={`${LABEL_CLASS} mb-1`}>Weight (%)</div><input type="number" className={INPUT_CLASS} value={m.weight} onChange={(e) => { const n = [...metrics]; n[i] = { ...m, weight: Number(e.target.value) }; onChange(n); }} /></div>
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
  return (
    <div className="space-y-3">
      {errors.map((err, i) => (
        <div key={i} className={CARD_CLASS}>
          <div className="flex items-center justify-between">
            <span className="text-on-surface text-xs font-bold">Error {i + 1}</span>
            <button onClick={() => { if (window.confirm(`Delete Error ${i + 1}?`)) onChange(errors.filter((_, j) => j !== i)); }} className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/10 text-red-400/70 hover:bg-red-500/20 hover:text-red-400 transition-all" title="Delete error">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
          <input className={INPUT_CLASS} value={err.error} onChange={(e) => { const n = [...errors]; n[i] = { ...err, error: e.target.value }; onChange(n); }} placeholder="Common error..." />
          <textarea className={`${INPUT_CLASS} min-h-[60px] resize-y`} value={err.correction} onChange={(e) => { const n = [...errors]; n[i] = { ...err, correction: e.target.value }; onChange(n); }} placeholder="How to fix it..." />
        </div>
      ))}
      <button onClick={() => onChange([...errors, { error: "", correction: "" }])} className="text-primary-container text-xs font-semibold uppercase tracking-widest flex items-center gap-1 hover:opacity-80">
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Add Error
      </button>
    </div>
  );
}

function PhasesEditor({ phases, onChange }: { phases: PhaseNote[]; onChange: (p: PhaseNote[]) => void }) {
  return (
    <div className="space-y-3">
      {phases.map((p, i) => (
        <div key={i} className={CARD_CLASS}>
          <div className="flex items-center justify-between">
            <input className={`${INPUT_CLASS} w-48`} value={p.phase} onChange={(e) => { const n = [...phases]; n[i] = { ...p, phase: e.target.value }; onChange(n); }} placeholder="Phase name" />
            <button onClick={() => { if (window.confirm(`Delete Phase ${i + 1}?`)) onChange(phases.filter((_, j) => j !== i)); }} className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/10 text-red-400/70 hover:bg-red-500/20 hover:text-red-400 transition-all" title="Delete phase">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
          <textarea className={`${INPUT_CLASS} min-h-[60px] resize-y`} value={p.notes} onChange={(e) => { const n = [...phases]; n[i] = { ...p, notes: e.target.value }; onChange(n); }} placeholder="Phase notes..." />
        </div>
      ))}
      <button onClick={() => onChange([...phases, { phase: "", notes: "" }])} className="text-primary-container text-xs font-semibold uppercase tracking-widest flex items-center gap-1 hover:opacity-80">
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Add Phase
      </button>
    </div>
  );
}

function CheckpointsEditor({ checkpoints, onChange }: { checkpoints: string[]; onChange: (c: string[]) => void }) {
  return (
    <div className="space-y-2">
      {checkpoints.map((c, i) => (
        <div key={i} className="flex gap-2 items-center">
          <span className="text-on-surface-variant text-xs font-mono w-6">{i + 1}.</span>
          <input className={`${INPUT_CLASS} flex-1`} value={c} onChange={(e) => { const n = [...checkpoints]; n[i] = e.target.value; onChange(n); }} placeholder="Checkpoint..." />
          <button onClick={() => { if (window.confirm(`Delete Checkpoint ${i + 1}?`)) onChange(checkpoints.filter((_, j) => j !== i)); }} className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/10 text-red-400/70 hover:bg-red-500/20 hover:text-red-400 transition-all shrink-0" title="Delete checkpoint">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
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
  return (
    <div className="space-y-3">
      {badges.map((b, i) => (
        <div key={i} className={CARD_CLASS}>
          <div className="flex items-center justify-between">
            <span className="text-on-surface text-xs font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 16 }}>military_tech</span>
              Badge {i + 1}
            </span>
            <button onClick={() => { if (window.confirm(`Delete Badge ${i + 1}?`)) onChange(badges.filter((_, j) => j !== i)); }} className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/10 text-red-400/70 hover:bg-red-500/20 hover:text-red-400 transition-all" title="Delete badge">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
          <input className={INPUT_CLASS} value={b.name} onChange={(e) => { const n = [...badges]; n[i] = { ...b, name: e.target.value }; onChange(n); }} placeholder="Badge name" />
          <input className={INPUT_CLASS} value={b.condition} onChange={(e) => { const n = [...badges]; n[i] = { ...b, condition: e.target.value }; onChange(n); }} placeholder="Unlock condition" />
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

function MechanicsEditor({ value, onChange }: StructuredEditorProps) {
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
      {phases.map((phase, idx) => (
        <div key={idx} className={CARD_CLASS}>
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <button onClick={() => movePhase(idx, -1)} disabled={idx === 0} className="text-on-surface-variant/40 hover:text-on-surface disabled:opacity-20 transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>keyboard_arrow_up</span>
              </button>
              <button onClick={() => movePhase(idx, 1)} disabled={idx === phases.length - 1} className="text-on-surface-variant/40 hover:text-on-surface disabled:opacity-20 transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>keyboard_arrow_down</span>
              </button>
            </div>

            {renamingIdx === idx ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={confirmRename}
                onKeyDown={(e) => { if (e.key === "Enter") confirmRename(); if (e.key === "Escape") setRenamingIdx(null); }}
                className={`${INPUT_CLASS} flex-1 !py-1`}
              />
            ) : (
              <button onClick={() => startRename(idx)} className="flex items-center gap-1.5 group flex-1 text-left">
                <span className={LABEL_CLASS + " mb-0"}>{phase.name}</span>
                <span className="material-symbols-outlined text-on-surface-variant/30 group-hover:text-primary-container transition-colors" style={{ fontSize: 12 }}>edit</span>
              </button>
            )}

            <button onClick={() => { if (window.confirm(`Delete ${phases[idx]?.name || 'this phase'}?`)) removePhase(idx); }} className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/10 text-red-400/70 hover:bg-red-500/20 hover:text-red-400 transition-all ml-auto" title="Delete phase">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>

          <textarea
            className={`${INPUT_CLASS} min-h-[80px] resize-y`}
            value={phase.notes}
            onChange={(e) => updatePhase(idx, e.target.value)}
            placeholder={`Notes for ${phase.name.toLowerCase()}...`}
          />
        </div>
      ))}

      <button
        onClick={addPhase}
        className="w-full h-10 rounded-xl border border-dashed border-outline-variant/20 text-on-surface-variant text-xs font-semibold uppercase tracking-widest hover:border-primary-container/40 hover:text-primary-container transition-colors flex items-center justify-center gap-2"
        style={{ backgroundColor: '#131920' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
        Add Phase
      </button>
    </div>
  );
}

function ReferenceEditor({ value, onChange }: StructuredEditorProps) {
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
      {sections.map((s) => (
         <div key={s} className={CARD_CLASS}>
          <div className="flex items-center gap-2 mb-1">
            <label className={LABEL_CLASS}>{s}</label>
            <SectionTooltip tip={descriptions[s]} />
          </div>
          <textarea
            className={`${INPUT_CLASS} min-h-[70px] resize-y`}
            value={fields[s] || ""}
            onChange={(e) => handleChange(s, e.target.value)}
            placeholder={descriptions[s]}
          />
        </div>
      ))}
    </div>
  );
}

function CameraEditor({ value, onChange }: StructuredEditorProps) {
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
      {sections.map((s) => (
         <div key={s} className={CARD_CLASS}>
          <div className="flex items-center gap-2 mb-1">
            <label className={LABEL_CLASS}>{s}</label>
            <SectionTooltip tip={descriptions[s]} />
          </div>
          <textarea
            className={`${INPUT_CLASS} min-h-[70px] resize-y`}
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
}

function ScoringEditor({ scoringRules, onScoringRulesChange, metrics }: ScoringEditorProps) {
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
      <div>
        <label className={`${LABEL_CLASS} block mb-2`}>Scoring Formula Description</label>
        <p className="text-on-surface-variant text-xs mb-2 leading-relaxed">
          Describe how the overall Route Mastery Score is calculated from individual metrics. The AI uses this to explain scores to athletes.
        </p>
        <textarea
          className={`${INPUT_CLASS} min-h-[120px] resize-y`}
          value={scoringRules}
          onChange={(e) => onScoringRulesChange(e.target.value)}
          placeholder="Describe the scoring formula..."
        />
      </div>

      {/* Weight Distribution Table */}
      <div className={CARD_CLASS}>
        <div className="flex items-center justify-between mb-4">
          <h4 className={`${LABEL_CLASS} flex items-center gap-2`}>
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
                <tr className="text-on-surface-variant text-[9px] uppercase tracking-[0.3em] border-b border-outline-variant/15">
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
                    <tr key={m.name} className="border-b border-outline-variant/10 last:border-0">
                      <td className="py-2.5 pr-4 text-on-surface font-medium">{m.name || "Unnamed"}</td>
                      <td className="py-2.5 px-3 text-right text-on-surface">{m.weight}%</td>
                      <td className="py-2.5 px-3 text-right text-on-surface-variant">90</td>
                      <td className="py-2.5 pl-3 text-right font-bold text-primary-container">{contribution.toFixed(1)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t border-outline-variant/20">
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
      <div className={CARD_CLASS + " space-y-4"}>
        <h4 className={`${LABEL_CLASS} flex items-center gap-2`}>
          <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 16 }}>tune</span>
          Global Scoring Rules (Optional)
        </h4>
        <p className="text-on-surface-variant text-xs leading-relaxed">
          Define bonus/penalty rules and confidence thresholds. These are included in the scoring formula description above.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-outline-variant/15" style={{ backgroundColor: '#0E1319' }}>
            <label className={`${LABEL_CLASS} block mb-1`}>Bonus Rules</label>
            <p className="text-on-surface-variant text-[10px] mb-2">e.g. "+5 if all phases ≥ 80"</p>
            <textarea
              className={`${INPUT_CLASS} min-h-[60px] resize-y`}
              placeholder="Describe any bonus point rules..."
              value=""
              readOnly
            />
          </div>
          <div className="p-4 rounded-xl border border-outline-variant/15" style={{ backgroundColor: '#0E1319' }}>
            <label className={`${LABEL_CLASS} block mb-1`}>Confidence Thresholds</label>
            <p className="text-on-surface-variant text-[10px] mb-2">e.g. "Below 0.6 = low confidence warning"</p>
            <textarea
              className={`${INPUT_CLASS} min-h-[60px] resize-y`}
              placeholder="Describe confidence thresholds..."
              value=""
              readOnly
            />
          </div>
        </div>
      </div>

      {/* Scoring Preview Simulator */}
      {metrics.length > 0 && weightValid && (
        <div className={CARD_CLASS + " space-y-4"}>
          <h4 className={`${LABEL_CLASS} flex items-center gap-2`}>
            <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 16 }}>calculate</span>
            Scoring Preview Simulator
          </h4>
          <p className="text-on-surface-variant text-xs leading-relaxed">
            Enter sample scores (0–100) for each metric to see the calculated Route Mastery Score.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {metrics.map((m) => (
              <div key={m.name} className="p-3 rounded-xl border border-outline-variant/15" style={{ backgroundColor: '#0E1319' }}>
                <label className={`${LABEL_CLASS} mb-1 block truncate`}>{m.name || "Unnamed"}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={`${INPUT_CLASS} text-center font-bold`}
                    value={simValues[m.name] ?? ""}
                    onChange={(e) => setSimValues((prev) => ({ ...prev, [m.name]: Number(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                  <span className="text-on-surface-variant text-[9px] shrink-0">× {m.weight}%</span>
                </div>
              </div>
            ))}
          </div>

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
