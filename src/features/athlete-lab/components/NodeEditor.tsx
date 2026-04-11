import { useState, useEffect, useCallback, useRef } from "react";
import type { TrainingNode, KeyMetric, CommonError, PhaseNote, Badge, EliteVideo, NodeStatus, CameraAngle, VideoType, MechanicsSection, SegmentationMethod } from "../types";
import { updateNode, setNodeStatus } from "@/services/athleteLab";
import { SectionTooltip } from "./SectionTooltip";
import { TestingPanel } from "./TestingPanel";
import { HelpDrawer } from "./HelpDrawer";
import { ConfirmModal } from "./ConfirmModal";
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
  { key: "phases", label: "Phases", icon: "timeline", subtitle: "Define and sequence the movement phases for this skill. Each phase controls how video frames are segmented during analysis — set proportion weights to ensure metrics are evaluated in the right moment of the movement." },
  { key: "mechanics", label: "Mechanics", icon: "engineering", subtitle: "Define coaching cues for each phase of this skill. Phases are defined in the Phases tab — sections here link automatically to keep names and structure in sync." },
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

  // Phase proportion weights must sum to 100 (only when using proportional segmentation)
  const segMethod = node.segmentation_method ?? "proportional";
  if (segMethod === "proportional" && node.phase_breakdown.length > 0) {
    const totalWeight = node.phase_breakdown.reduce((s, p) => s + (p.weight ?? 0), 0);
    if (totalWeight !== 100) {
      issues.push({ label: "Phases", detail: `Phase proportions must sum to 100% (currently ${totalWeight}%)` });
    }
  }

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
  const [confirmModal, setConfirmModal] = useState<{ title: string; body: string; confirmLabel: string; onConfirm: () => void } | null>(null);
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
        segmentation_method: draft.segmentation_method,
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
            <textarea className={`${INPUT_CLASS} min-h-[200px] resize-y`} value={draft.overview} onChange={(e) => update("overview", e.target.value)} placeholder="e.g. The slant route is a quick inside-breaking route used to exploit zone coverage gaps..." />
          </div>
        )}

        {tab === "mechanics" && (
          <div className="space-y-4">
            <div className="flex items-center gap-1.5">
              <label className={LABEL_CLASS}>Phase Mechanics</label>
              <SectionTooltip tip="Describe the coaching cues and technique for each phase of this skill. Each section must be linked to a phase defined in the Phases tab — this ensures the AI feedback engine receives the correct coaching context for each movement phase. Write in direct coaching language aimed at athletes aged 14-22." />
            </div>
            <MechanicsEditor value={draft.pro_mechanics} onChange={(v) => update("pro_mechanics", v)} phases={draft.phase_breakdown} onConfirmDelete={(opts) => setConfirmModal(opts)} />
          </div>
        )}

        {tab === "metrics" && (
          <KeyMetricsEditor metrics={draft.key_metrics} onChange={(m) => updateWithCriticalTrack("key_metrics", m)} onConfirmDelete={(opts) => setConfirmModal(opts)} />
        )}

        {tab === "scoring" && (
          <ScoringEditor
            scoringRules={draft.scoring_rules}
            onScoringRulesChange={(v) => updateWithCriticalTrack("scoring_rules", v)}
            metrics={draft.key_metrics}
          />
        )}

        {tab === "errors" && (
          <CommonErrorsEditor errors={draft.common_errors} onChange={(e) => update("common_errors", e)} onConfirmDelete={(opts) => setConfirmModal(opts)} />
        )}

        {tab === "phases" && (
          <PhasesEditor
            phases={draft.phase_breakdown}
            onChange={(p) => updateWithCriticalTrack("phase_breakdown", p)}
            segmentationMethod={draft.segmentation_method ?? "proportional"}
            onSegmentationMethodChange={(m) => update("segmentation_method", m)}
            onConfirmDelete={(opts) => setConfirmModal(opts)}
          />
        )}

        {tab === "reference" && (
          <ReferenceEditor value={draft.reference_object} onChange={(v) => update("reference_object", v)} />
        )}

        {tab === "camera" && (
          <CameraEditor value={draft.camera_guidelines} onChange={(v) => update("camera_guidelines", v)} />
        )}

        {tab === "checkpoints" && (
          <CheckpointsEditor checkpoints={draft.form_checkpoints} onChange={(c) => update("form_checkpoints", c)} onConfirmDelete={(opts) => setConfirmModal(opts)} />
        )}

        {tab === "prompt" && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <label className={LABEL_CLASS}>Prompt Template</label>
            </div>
            <textarea className={`${INPUT_CLASS} min-h-[300px] resize-y font-mono text-xs`} value={draft.llm_prompt_template} onChange={(e) => updateWithCriticalTrack("llm_prompt_template", e.target.value)} placeholder="e.g. You are an elite football skills coach analyzing a {{position}} athlete performing a {{skill_name}}..." />
          </div>
        )}

        {tab === "badges" && (
          <BadgesEditor badges={draft.badges} onChange={(b) => update("badges", b)} onConfirmDelete={(opts) => setConfirmModal(opts)} />
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
        <ConfirmModal
          open={!!confirmModal}
          title={confirmModal?.title ?? ""}
          body={confirmModal?.body ?? ""}
          confirmLabel={confirmModal?.confirmLabel ?? "Delete"}
          onConfirm={() => { confirmModal?.onConfirm(); setConfirmModal(null); }}
          onCancel={() => setConfirmModal(null)}
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

type ConfirmDeleteFn = (opts: { title: string; body: string; confirmLabel: string; onConfirm: () => void }) => void;

function KeyMetricsEditor({ metrics, onChange, onConfirmDelete }: { metrics: KeyMetric[]; onChange: (m: KeyMetric[]) => void; onConfirmDelete: ConfirmDeleteFn }) {
  const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<KeyMetric>({ name: "", description: "", eliteTarget: "", unit: "", weight: 0 });
  const [editDraft, setEditDraft] = useState<KeyMetric>({ name: "", description: "", eliteTarget: "", unit: "", weight: 0 });

  const startEdit = (i: number) => {
    setEditIdx(i);
    setEditDraft({ ...metrics[i] });
    setAdding(false);
  };

  const saveEdit = (i: number) => {
    const n = [...metrics];
    n[i] = editDraft;
    onChange(n);
    setEditIdx(null);
  };

  const handleAdd = () => {
    onChange([...metrics, draft]);
    setDraft({ name: "", description: "", eliteTarget: "", unit: "", weight: 0 });
    setAdding(false);
  };

  const renderFields = (m: KeyMetric, setM: (v: KeyMetric) => void) => (
    <div className="space-y-3 pt-3">
      <div className="grid grid-cols-2 gap-3">
        <div><div className={`${LABEL_CLASS} mb-2`}>Name</div><input className={INPUT_CLASS} value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} placeholder="e.g. Separation Distance" /></div>
        <div><div className={`${LABEL_CLASS} mb-2`}>Unit</div><input className={INPUT_CLASS} value={m.unit} onChange={(e) => setM({ ...m, unit: e.target.value })} placeholder="e.g. yards" /></div>
      </div>
      <div><div className={`${LABEL_CLASS} mb-2`}>Description</div><textarea className={`${INPUT_CLASS} min-h-[60px] resize-y`} value={m.description} onChange={(e) => setM({ ...m, description: e.target.value })} placeholder="e.g. Distance between receiver and nearest defender at catch point" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><div className={`${LABEL_CLASS} mb-2`}>Elite Target</div><input className={INPUT_CLASS} value={m.eliteTarget} onChange={(e) => setM({ ...m, eliteTarget: e.target.value })} placeholder="e.g. 3.5+" /></div>
        <div><div className={`${LABEL_CLASS} mb-2`}>Weight (%)</div><input type="number" className={INPUT_CLASS} value={m.weight} onChange={(e) => setM({ ...m, weight: Number(e.target.value) })} placeholder="e.g. 25" /></div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className={`text-xs font-semibold ${totalWeight === 100 ? "text-primary-container" : "text-orange-400"}`}>
        Total Weight: {totalWeight}% {totalWeight !== 100 && "(should be 100%)"}
      </div>
      <div className="space-y-2">
        {metrics.map((m, i) => (
          <div key={i} className={CARD_CLASS}>
            {editIdx === i ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-on-surface text-xs font-bold">Metric {i + 1}</span>
                </div>
                {renderFields(editDraft, setEditDraft)}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => saveEdit(i)} className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">Save</button>
                  <button onClick={() => setEditIdx(null)} className="px-4 py-2 rounded-lg text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors" style={{ backgroundColor: '#1A2029' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 group">
                <span className="text-on-surface-variant/30 text-[10px] font-mono font-semibold w-4 text-center shrink-0">{i + 1}</span>
                <p className="text-on-surface text-sm font-semibold truncate flex-1 min-w-0">{m.name || "Untitled Metric"}</p>
                <span className="text-on-surface-variant/40 text-[10px] font-medium shrink-0">{m.unit}</span>
                <span className="text-on-surface-variant/40 text-[10px] font-medium shrink-0">{m.eliteTarget}</span>
                <span className="text-on-surface-variant/40 text-[10px] font-medium shrink-0">{m.weight}%</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => startEdit(i)} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary-container transition-colors" style={{ backgroundColor: '#111720' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                  </button>
                  <button onClick={() => onConfirmDelete({ title: "Delete Metric?", body: `Deleting Metric ${i + 1}${m.name ? ` (${m.name})` : ""} will remove it from the scoring pipeline. This cannot be undone.`, confirmLabel: "Delete Metric", onConfirm: () => { onChange(metrics.filter((_, j) => j !== i)); setEditIdx(null); } })} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-red-400 transition-colors" style={{ backgroundColor: '#111720' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <div className={CARD_CLASS + " border-primary-container/20"}>
          <p className="text-on-surface text-xs font-bold uppercase tracking-widest">Add Metric</p>
          {renderFields(draft, setDraft)}
          <div className="flex gap-2 pt-2">
            <button onClick={handleAdd} className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">Add</button>
            <button onClick={() => { setAdding(false); setDraft({ name: "", description: "", eliteTarget: "", unit: "", weight: 0 }); }} className="px-4 py-2 rounded-lg text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors" style={{ backgroundColor: '#1A2029' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setAdding(true); setEditIdx(null); }} className="w-full py-3 rounded-xl border border-dashed border-outline-variant/20 text-primary-container text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:border-primary-container/40 transition-all" style={{ backgroundColor: '#131920' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span> Add Metric
        </button>
      )}
    </div>
  );
}

function CommonErrorsEditor({ errors, onChange, onConfirmDelete }: { errors: CommonError[]; onChange: (e: CommonError[]) => void; onConfirmDelete: ConfirmDeleteFn }) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<CommonError>({ error: "", correction: "" });
  const [editDraft, setEditDraft] = useState<CommonError>({ error: "", correction: "" });

  const startEdit = (i: number) => {
    setEditIdx(i);
    setEditDraft({ ...errors[i] });
    setAdding(false);
  };

  const saveEdit = (i: number) => {
    const n = [...errors];
    n[i] = editDraft;
    onChange(n);
    setEditIdx(null);
  };

  const handleAdd = () => {
    onChange([...errors, draft]);
    setDraft({ error: "", correction: "" });
    setAdding(false);
  };

  const renderFields = (err: CommonError, setErr: (v: CommonError) => void) => (
    <div className="space-y-3 pt-3">
      <div>
        <div className={`${LABEL_CLASS} mb-2`}>Error Description</div>
        <input className={INPUT_CLASS} value={err.error} onChange={(e) => setErr({ ...err, error: e.target.value })} placeholder="e.g. Rounding the break instead of planting and cutting" />
      </div>
      <div>
        <div className={`${LABEL_CLASS} mb-2`}>Correction</div>
        <textarea className={`${INPUT_CLASS} min-h-[60px] resize-y`} value={err.correction} onChange={(e) => setErr({ ...err, correction: e.target.value })} placeholder="e.g. Plant hard on the inside foot at 45 degrees, then accelerate through the break" />
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {errors.map((err, i) => (
          <div key={i} className={CARD_CLASS}>
            {editIdx === i ? (
              <div className="space-y-3">
                <span className="text-on-surface text-xs font-bold">Error {i + 1}</span>
                {renderFields(editDraft, setEditDraft)}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => saveEdit(i)} className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">Save</button>
                  <button onClick={() => setEditIdx(null)} className="px-4 py-2 rounded-lg text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors" style={{ backgroundColor: '#1A2029' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 group">
                <span className="text-on-surface-variant/30 text-[10px] font-mono font-semibold w-4 text-center shrink-0">{i + 1}</span>
                <p className="text-on-surface text-sm font-semibold truncate flex-1 min-w-0">{err.error || "Untitled Error"}</p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => startEdit(i)} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary-container transition-colors" style={{ backgroundColor: '#111720' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                  </button>
                  <button onClick={() => onConfirmDelete({ title: "Delete Error?", body: `Deleting Error ${i + 1}${err.error ? ` (${err.error})` : ""} will remove it from the error library. This cannot be undone.`, confirmLabel: "Delete Error", onConfirm: () => { onChange(errors.filter((_, j) => j !== i)); setEditIdx(null); } })} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-red-400 transition-colors" style={{ backgroundColor: '#111720' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <div className={CARD_CLASS + " border-primary-container/20"}>
          <p className="text-on-surface text-xs font-bold uppercase tracking-widest">Add Error</p>
          {renderFields(draft, setDraft)}
          <div className="flex gap-2 pt-2">
            <button onClick={handleAdd} className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">Add</button>
            <button onClick={() => { setAdding(false); setDraft({ error: "", correction: "" }); }} className="px-4 py-2 rounded-lg text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors" style={{ backgroundColor: '#1A2029' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setAdding(true); setEditIdx(null); }} className="w-full py-3 rounded-xl border border-dashed border-outline-variant/20 text-primary-container text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:border-primary-container/40 transition-all" style={{ backgroundColor: '#131920' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span> Add Error
        </button>
      )}
    </div>
  );
}

function PhasesEditor({ phases, onChange, segmentationMethod, onSegmentationMethodChange, onConfirmDelete }: {
  phases: PhaseNote[];
  onChange: (p: PhaseNote[]) => void;
  segmentationMethod: SegmentationMethod;
  onSegmentationMethodChange: (m: SegmentationMethod) => void;
  onConfirmDelete: ConfirmDeleteFn;
}) {
  useEffect(() => {
    const needsIds = phases.some(p => !p.id);
    if (needsIds) {
      const updated = phases.map(p => p.id ? p : { ...p, id: crypto.randomUUID() });
      onChange(updated);
    }
  }, []); // only on mount

  const ensureId = (p: PhaseNote): PhaseNote => p.id ? p : { ...p, id: crypto.randomUUID() };

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<PhaseNote>({ id: crypto.randomUUID(), phase: "", notes: "", weight: 0 });
  const [editDraft, setEditDraft] = useState<PhaseNote>({ id: "", phase: "", notes: "", weight: 0 });

  const handleDragStart = (idx: number) => { setDragIdx(idx); };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const next = [...phases];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    onChange(next);
    setDragIdx(idx);
  };
  const handleDragEnd = () => { setDragIdx(null); };

  const startEdit = (i: number) => {
    setEditIdx(i);
    setEditDraft({ ...phases[i] });
    setAdding(false);
  };

  const saveEdit = (i: number) => {
    const n = [...phases];
    n[i] = ensureId(editDraft);
    onChange(n);
    setEditIdx(null);
  };

  const handleAdd = () => {
    onChange([...phases, ensureId(addDraft)]);
    setAddDraft({ id: crypto.randomUUID(), phase: "", notes: "", weight: 0 });
    setAdding(false);
  };

  const totalWeight = phases.reduce((s, p) => s + (p.weight ?? 0), 0);
  const remaining = 100 - totalWeight;
  const isProportional = segmentationMethod === "proportional";

  const renderFields = (p: PhaseNote, setP: (v: PhaseNote) => void) => (
    <div className="space-y-3 pt-3">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <div className="flex items-center gap-1 mb-2">
            <label className={LABEL_CLASS}>Phase Name</label>
            <SectionTooltip tip="The name of this movement phase. Must be unique within this node. This name is used across Mechanics, Metrics, and the analysis pipeline — keep it short and descriptive." />
          </div>
          <input className={INPUT_CLASS} value={p.phase} onChange={(e) => setP({ ...p, phase: e.target.value })} placeholder="e.g. Release" />
        </div>
        {isProportional && (
          <div className="w-24">
            <div className="flex items-center gap-1 mb-2">
              <label className={LABEL_CLASS}>% of Clip</label>
              <SectionTooltip tip="The percentage of the video clip this phase occupies. All phases must sum to 100%." />
            </div>
            <div className="relative">
              <input type="number" min={1} max={99} step={1} className={`${INPUT_CLASS} !pr-7 !text-right w-full`} value={p.weight != null && p.weight > 0 ? p.weight : ""} onChange={(e) => { const raw = e.target.value; const val = raw === "" ? 0 : Math.min(99, Math.max(0, Math.round(Number(raw)))); setP({ ...p, weight: val }); }} placeholder="—" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-xs">%</span>
            </div>
          </div>
        )}
      </div>
      <div>
        <div className="flex items-center gap-1 mb-2">
          <label className={LABEL_CLASS}>Phase Description</label>
          <SectionTooltip tip="A brief coaching description of what happens in this phase. Used as context by the AI feedback engine." />
        </div>
        <textarea className={`${INPUT_CLASS} min-h-[60px] resize-y`} value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} placeholder="e.g. Athlete pushes off the line with initial burst..." />
      </div>
      <div>
        <div className="flex items-center gap-1 mb-2">
          <label className={LABEL_CLASS}>Frame Buffer</label>
          <SectionTooltip tip="Number of frames to include on either side of this phase boundary. Default of 3 works for most skills." />
        </div>
        <div className="relative w-[100px]">
          <input type="number" min={0} max={15} step={1} className={`${INPUT_CLASS} !pr-14 !text-right w-full`} value={p.frame_buffer ?? 3} onChange={(e) => { const val = Math.min(15, Math.max(0, Math.round(Number(e.target.value)))); setP({ ...p, frame_buffer: val }); }} />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[10px]">frames</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Segmentation method selector */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <label className={LABEL_CLASS}>Segmentation Method</label>
          <SectionTooltip tip="Proportional: divides clip frames by the percentage weights you set per phase. Checkpoint-triggered: phase boundaries are set by specific body position events defined in the Checkpoints tab." />
        </div>
        <div className="flex rounded-xl overflow-hidden border border-outline-variant/20" style={{ backgroundColor: '#0E1319' }}>
          <button onClick={() => onSegmentationMethodChange("proportional")} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-[0.15em] transition-all ${isProportional ? "bg-primary-container/15 text-primary-container border-r border-primary-container/30" : "text-on-surface-variant hover:text-on-surface border-r border-outline-variant/20"}`}>Proportional</button>
          <button onClick={() => onSegmentationMethodChange("checkpoint")} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-[0.15em] transition-all ${!isProportional ? "bg-primary-container/15 text-primary-container" : "text-on-surface-variant hover:text-on-surface"}`}>Checkpoint-triggered</button>
        </div>
        {!isProportional && (
          <p className="text-on-surface-variant/50 text-xs leading-snug">Phase boundaries will be determined by Checkpoints. Proportion weights are ignored.</p>
        )}
      </div>

      {/* Section label */}
      <div className="flex items-center gap-1.5">
        <label className={LABEL_CLASS}>Skill Phases</label>
        <SectionTooltip tip="Define the sequential movement phases for this skill. Each phase is used to segment video frames during analysis. Minimum 4 phases recommended. Order matters — phases are processed top to bottom." />
      </div>

      {/* Phase cards */}
      <div className="space-y-2">
        {phases.map((p, i) => (
          <div
            key={p.id || i}
            className={`${CARD_CLASS} ${dragIdx === i ? "opacity-50" : ""}`}
            draggable={editIdx !== i}
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDragEnd={handleDragEnd}
          >
            {editIdx === i ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="cursor-grab active:cursor-grabbing text-on-surface-variant/30"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>drag_indicator</span></span>
                  <span className="text-on-surface-variant/30 text-[10px] font-mono font-semibold w-4 text-center">{i + 1}</span>
                  <span className="text-on-surface text-xs font-bold flex-1">Phase {i + 1}</span>
                </div>
                {renderFields(editDraft, setEditDraft)}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => saveEdit(i)} className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">Save</button>
                  <button onClick={() => setEditIdx(null)} className="px-4 py-2 rounded-lg text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors" style={{ backgroundColor: '#1A2029' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <span className="cursor-grab active:cursor-grabbing text-on-surface-variant/30 hover:text-on-surface-variant/60 transition-colors shrink-0">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>drag_indicator</span>
                </span>
                <span className="text-on-surface-variant/30 text-[10px] font-mono font-semibold w-4 text-center shrink-0">{i + 1}</span>
                <p className="text-on-surface text-sm font-semibold truncate flex-1 min-w-0">{p.phase || "Untitled Phase"}</p>
                {isProportional && <span className="text-on-surface-variant/40 text-[10px] font-medium shrink-0">{p.weight ?? 0}%</span>}
                <span className="text-on-surface-variant/40 text-[10px] font-medium shrink-0">{p.frame_buffer ?? 3} frames</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => startEdit(i)} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary-container transition-colors" style={{ backgroundColor: '#111720' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                  </button>
                  <button onClick={() => { const phaseName = p.phase || `Phase ${i + 1}`; onConfirmDelete({ title: "Delete Phase?", body: `Deleting ${phaseName} will remove it from the pipeline and unlink any Mechanics sections connected to it. This cannot be undone.`, confirmLabel: "Delete Phase", onConfirm: () => { onChange(phases.filter((_, j) => j !== i)); setEditIdx(null); } }); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-red-400 transition-colors" style={{ backgroundColor: '#111720' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <div className={CARD_CLASS + " border-primary-container/20"}>
          <p className="text-on-surface text-xs font-bold uppercase tracking-widest">Add Phase</p>
          {renderFields(addDraft, setAddDraft)}
          <div className="flex gap-2 pt-2">
            <button onClick={handleAdd} className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">Add</button>
            <button onClick={() => { setAdding(false); setAddDraft({ id: crypto.randomUUID(), phase: "", notes: "", weight: 0 }); }} className="px-4 py-2 rounded-lg text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors" style={{ backgroundColor: '#1A2029' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setAdding(true); setEditIdx(null); }} className="w-full py-3 rounded-xl border border-dashed border-outline-variant/20 text-primary-container text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:border-primary-container/40 transition-all" style={{ backgroundColor: '#131920' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span> Add Phase
        </button>
      )}

      {/* Proportion total indicator */}
      {isProportional && phases.length > 0 && (
        <div className="pt-2">
          {totalWeight === 100 ? (
            <p className="text-primary-container text-xs font-semibold" style={{ textShadow: '0 0 8px rgba(0,230,57,0.4)' }}>Total: 100% ✓</p>
          ) : totalWeight > 100 ? (
            <p className="text-amber-400 text-xs font-semibold">Total: {totalWeight}% — over by {totalWeight - 100}%</p>
          ) : (
            <p className="text-on-surface-variant/60 text-xs font-semibold">Total: {totalWeight}% — {remaining}% remaining</p>
          )}
        </div>
      )}
    </div>
  );
}

function CheckpointsEditor({ checkpoints, onChange, onConfirmDelete }: { checkpoints: string[]; onChange: (c: string[]) => void; onConfirmDelete: ConfirmDeleteFn }) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editDraft, setEditDraft] = useState("");

  const startEdit = (i: number) => {
    setEditIdx(i);
    setEditDraft(checkpoints[i]);
    setAdding(false);
  };

  const saveEdit = (i: number) => {
    const n = [...checkpoints];
    n[i] = editDraft;
    onChange(n);
    setEditIdx(null);
  };

  const handleAdd = () => {
    onChange([...checkpoints, draft]);
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {checkpoints.map((c, i) => (
          <div key={i} className={CARD_CLASS}>
            {editIdx === i ? (
              <div className="space-y-3">
                <span className="text-on-surface text-xs font-bold">Checkpoint {i + 1}</span>
                <div className="pt-3">
                  <div className={`${LABEL_CLASS} mb-2`}>Checkpoint Description</div>
                  <input className={`${INPUT_CLASS} flex-1`} value={editDraft} onChange={(e) => setEditDraft(e.target.value)} placeholder="e.g. Hips fully rotated at the break point" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => saveEdit(i)} className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">Save</button>
                  <button onClick={() => setEditIdx(null)} className="px-4 py-2 rounded-lg text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors" style={{ backgroundColor: '#1A2029' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 group">
                <span className="text-on-surface-variant/30 text-[10px] font-mono font-semibold w-4 text-center shrink-0">{i + 1}</span>
                <p className="text-on-surface text-sm font-semibold truncate flex-1 min-w-0">{c || "Untitled Checkpoint"}</p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => startEdit(i)} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary-container transition-colors" style={{ backgroundColor: '#111720' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                  </button>
                  <button onClick={() => onConfirmDelete({ title: "Delete Checkpoint?", body: `Deleting Checkpoint ${i + 1} will remove it from the analysis checklist. This cannot be undone.`, confirmLabel: "Delete Checkpoint", onConfirm: () => { onChange(checkpoints.filter((_, j) => j !== i)); setEditIdx(null); } })} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-red-400 transition-colors" style={{ backgroundColor: '#111720' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <div className={CARD_CLASS + " border-primary-container/20"}>
          <p className="text-on-surface text-xs font-bold uppercase tracking-widest">Add Checkpoint</p>
          <div className="pt-3">
            <div className={`${LABEL_CLASS} mb-2`}>Checkpoint Description</div>
            <input className={`${INPUT_CLASS} flex-1`} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. Hips fully rotated at the break point" />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleAdd} className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">Add</button>
            <button onClick={() => { setAdding(false); setDraft(""); }} className="px-4 py-2 rounded-lg text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors" style={{ backgroundColor: '#1A2029' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setAdding(true); setEditIdx(null); }} className="w-full py-3 rounded-xl border border-dashed border-outline-variant/20 text-primary-container text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:border-primary-container/40 transition-all" style={{ backgroundColor: '#131920' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span> Add Checkpoint
        </button>
      )}
    </div>
  );
}

function BadgesEditor({ badges, onChange, onConfirmDelete }: { badges: Badge[]; onChange: (b: Badge[]) => void; onConfirmDelete: ConfirmDeleteFn }) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Badge>({ name: "", condition: "" });
  const [editDraft, setEditDraft] = useState<Badge>({ name: "", condition: "" });

  const startEdit = (i: number) => {
    setEditIdx(i);
    setEditDraft({ ...badges[i] });
    setAdding(false);
  };

  const saveEdit = (i: number) => {
    const n = [...badges];
    n[i] = editDraft;
    onChange(n);
    setEditIdx(null);
  };

  const handleAdd = () => {
    onChange([...badges, draft]);
    setDraft({ name: "", condition: "" });
    setAdding(false);
  };

  const renderFields = (b: Badge, setB: (v: Badge) => void) => (
    <div className="space-y-3 pt-3">
      <div>
        <div className={`${LABEL_CLASS} mb-2`}>Badge Name</div>
        <input className={INPUT_CLASS} value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} placeholder="e.g. Route Technician" />
      </div>
      <div>
        <div className={`${LABEL_CLASS} mb-2`}>Unlock Condition</div>
        <input className={INPUT_CLASS} value={b.condition} onChange={(e) => setB({ ...b, condition: e.target.value })} placeholder="e.g. Score 85+ on 3 consecutive attempts" />
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {badges.map((b, i) => (
          <div key={i} className={CARD_CLASS}>
            {editIdx === i ? (
              <div className="space-y-3">
                <span className="text-on-surface text-xs font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 16 }}>military_tech</span>
                  Badge {i + 1}
                </span>
                {renderFields(editDraft, setEditDraft)}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => saveEdit(i)} className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">Save</button>
                  <button onClick={() => setEditIdx(null)} className="px-4 py-2 rounded-lg text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors" style={{ backgroundColor: '#1A2029' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 group">
                <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 16 }}>military_tech</span>
                <p className="text-on-surface text-sm font-semibold truncate flex-1 min-w-0">{b.name || "Untitled Badge"}</p>
                <span className="text-on-surface-variant/40 text-[10px] font-medium truncate max-w-[200px] shrink-0">{b.condition || "No condition"}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => startEdit(i)} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary-container transition-colors" style={{ backgroundColor: '#111720' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                  </button>
                  <button onClick={() => onConfirmDelete({ title: "Delete Badge?", body: `Deleting ${b.name || `Badge ${i + 1}`} will remove it from the badge library. This cannot be undone.`, confirmLabel: "Delete Badge", onConfirm: () => { onChange(badges.filter((_, j) => j !== i)); setEditIdx(null); } })} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-red-400 transition-colors" style={{ backgroundColor: '#111720' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <div className={CARD_CLASS + " border-primary-container/20"}>
          <p className="text-on-surface text-xs font-bold uppercase tracking-widest">Add Badge</p>
          {renderFields(draft, setDraft)}
          <div className="flex gap-2 pt-2">
            <button onClick={handleAdd} className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">Add</button>
            <button onClick={() => { setAdding(false); setDraft({ name: "", condition: "" }); }} className="px-4 py-2 rounded-lg text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors" style={{ backgroundColor: '#1A2029' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setAdding(true); setEditIdx(null); }} className="w-full py-3 rounded-xl border border-dashed border-outline-variant/20 text-primary-container text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:border-primary-container/40 transition-all" style={{ backgroundColor: '#131920' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span> Add Badge
        </button>
      )}
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

function MechanicsEditor({ value, onChange, phases, onConfirmDelete }: StructuredEditorProps & { phases: PhaseNote[]; onConfirmDelete: ConfirmDeleteFn }) {
  // Parse sections from JSON or migrate from legacy text format
  const parseSections = useCallback((): MechanicsSection[] => {
    if (!value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed) && parsed.every((s: any) => typeof s === "object" && "id" in s)) {
        return parsed as MechanicsSection[];
      }
    } catch { /* not JSON, migrate from legacy */ }
    // Legacy migration: parse old "SectionName: content" format into unlinked sections
    const lines = value.split("\n");
    const detected: MechanicsSection[] = [];
    let current: MechanicsSection | null = null;
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.*)/);
      if (match && match[1].length < 60) {
        if (current) detected.push(current);
        current = { id: crypto.randomUUID(), phase_id: null, content: match[2].trim() };
      } else if (current) {
        current.content = current.content ? current.content + "\n" + line : line;
      }
    }
    if (current) detected.push(current);
    return detected.length > 0 ? detected : [{ id: crypto.randomUUID(), phase_id: null, content: value }];
  }, [value]);

  const [sections, setSections] = useState<MechanicsSection[]>(parseSections);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSections(parseSections());
  }, [parseSections]);

  const serialize = (list: MechanicsSection[]) => {
    onChange(JSON.stringify(list));
  };

  const updateSection = (idx: number, content: string) => {
    const next = sections.map((s, i) => (i === idx ? { ...s, content } : s));
    setSections(next);
    serialize(next);
  };

  const linkSection = (idx: number, phaseId: string) => {
    const next = sections.map((s, i) => (i === idx ? { ...s, phase_id: phaseId } : s));
    setSections(next);
    serialize(next);
  };

  const addSection = () => {
    const next = [...sections, { id: crypto.randomUUID(), phase_id: null, content: "" }];
    setSections(next);
    serialize(next);
  };

  const removeSection = (idx: number) => {
    const next = sections.filter((_, i) => i !== idx);
    setSections(next);
    serialize(next);
  };




  // Build set of phase IDs already linked
  const linkedPhaseIds = new Set(sections.map(s => s.phase_id).filter(Boolean));
  const phaseIdSet = new Set(phases.map(p => p.id).filter(Boolean));

  const getPhaseNameById = (phaseId: string | null): string | null => {
    if (!phaseId) return null;
    const phase = phases.find(p => p.id === phaseId);
    return phase ? phase.phase : null;
  };

  return (
    <div className="space-y-4">
      {sections.map((sec, idx) => {
        const phaseName = getPhaseNameById(sec.phase_id);
        const isOrphan = sec.phase_id && !phaseIdSet.has(sec.phase_id);
        const isUnlinked = !sec.phase_id;
        const isCollapsed = collapsed.has(sec.id);

        const toggleCollapse = () => {
          setCollapsed(prev => {
            const next = new Set(prev);
            if (next.has(sec.id)) next.delete(sec.id);
            else next.add(sec.id);
            return next;
          });
        };

        return (
          <div key={sec.id} className={CARD_CLASS}>
            {/* Section header row: [chevron] [chain] [PHASE NAME] --- [× delete] */}
            <div className="flex items-center gap-2">
              <button onClick={toggleCollapse} className="text-on-surface-variant/50 hover:text-on-surface transition-colors shrink-0">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  {isCollapsed ? "chevron_right" : "expand_more"}
                </span>
              </button>

              {/* Linked phase name or dropdown */}
              <div className="flex-1 min-w-0">
                {isOrphan ? (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-400" style={{ fontSize: 14 }}>link_off</span>
                    <span className={LABEL_CLASS + " mb-0 text-amber-400"}>Phase Deleted</span>
                  </div>
                ) : phaseName ? (
                  <div className="flex items-center gap-2 select-none">
                    <span className="material-symbols-outlined text-primary-container/60" style={{ fontSize: 14 }}>link</span>
                    <span className="text-primary-container/70 text-[10px] font-semibold uppercase tracking-widest">{phaseName}</span>
                    <span className="material-symbols-outlined text-on-surface-variant/20" style={{ fontSize: 11 }}>lock</span>
                  </div>
                ) : (
                  <select
                    className={`${INPUT_CLASS} !py-1.5 !text-xs max-w-[240px]`}
                    value=""
                    onChange={(e) => linkSection(idx, e.target.value)}
                  >
                    <option value="" disabled>Select a phase…</option>
                    {phases.filter(p => p.id && p.phase.trim()).map(p => {
                      const alreadyLinked = linkedPhaseIds.has(p.id!);
                      return (
                        <option key={p.id} value={p.id!} disabled={alreadyLinked}>
                          {p.phase}{alreadyLinked ? " (already linked)" : ""}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              <button onClick={() => { const linkedPhase = phases.find(p => p.id === sec.phase_id); const secName = linkedPhase?.phase || `Section ${idx + 1}`; onConfirmDelete({ title: "Delete Mechanics Section?", body: `Deleting ${secName} will remove all coaching cues in this section. This cannot be undone.`, confirmLabel: "Delete Section", onConfirm: () => { removeSection(idx); } }); }} className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/10 text-red-400/70 hover:bg-red-500/20 hover:text-red-400 transition-all shrink-0" title="Delete section">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>

            {/* Collapsible content */}
            {!isCollapsed && (
              <>
                {/* Warning banners */}
                {isOrphan && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <span className="material-symbols-outlined text-amber-400 mt-0.5" style={{ fontSize: 16 }}>warning</span>
                    <p className="text-amber-300 text-xs leading-snug">Linked phase was deleted. Please relink this section to an existing phase or delete it.</p>
                  </div>
                )}
                {isUnlinked && !isOrphan && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <span className="material-symbols-outlined text-amber-400 mt-0.5" style={{ fontSize: 16 }}>warning</span>
                    <p className="text-amber-300 text-xs leading-snug">This section is not linked to a phase. Link it before going Live.</p>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-1 mb-2">
                    <label className={LABEL_CLASS + " mb-0"}>Coaching Cues</label>
                    <SectionTooltip tip="Write the coaching instruction for this phase in direct, athlete-facing language. This content is passed to the AI feedback engine as context — the more specific and technical your cues, the more precise the feedback athletes receive. Aim for 3-5 sentences covering what to do, how to do it, and what goes wrong when it is done incorrectly." />
                  </div>
                  <textarea
                    className={`${INPUT_CLASS} min-h-[80px] resize-y`}
                    value={sec.content}
                    onChange={(e) => updateSection(idx, e.target.value)}
                    placeholder={phaseName ? `Coaching cues for ${phaseName.toLowerCase()}...` : "Coaching cues..."}
                  />
                </div>
              </>
            )}
          </div>
        );
      })}

      <button
        onClick={addSection}
        className="w-full h-10 rounded-xl border border-dashed border-outline-variant/20 text-on-surface-variant text-xs font-semibold uppercase tracking-widest hover:border-primary-container/40 hover:text-primary-container transition-colors flex items-center justify-center gap-2"
        style={{ backgroundColor: '#131920' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
        Add Section
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

  const placeholders: Record<string, string> = {
    "Reference Object": "e.g. Standard regulation football (11 inches)",
    "Calibration Instructions": "e.g. Measure the football's length in pixels to establish a distance scale",
    "Scale Notes": "e.g. Outdoor fields with yard lines provide additional calibration reference",
  };

  return (
    <div className="space-y-4">
      {sections.map((s) => (
         <div key={s} className={CARD_CLASS}>
          <div className="flex items-center gap-2 mb-2">
            <label className={LABEL_CLASS}>{s}</label>
            <SectionTooltip tip={descriptions[s]} />
          </div>
          <textarea
            className={`${INPUT_CLASS} min-h-[70px] resize-y`}
            value={fields[s] || ""}
            onChange={(e) => handleChange(s, e.target.value)}
            placeholder={placeholders[s]}
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

  const placeholders: Record<string, string> = {
    "Primary Camera Angle": "e.g. Sideline, 10 yards back, camera at waist height",
    "Secondary Camera Angle": "e.g. End zone elevated, 15 feet high behind the line of scrimmage",
    "Lighting & Environment": "e.g. Outdoor daylight preferred, avoid filming into the sun",
  };

  return (
    <div className="space-y-4">
      {sections.map((s) => (
         <div key={s} className={CARD_CLASS}>
          <div className="flex items-center gap-2 mb-2">
            <label className={LABEL_CLASS}>{s}</label>
            <SectionTooltip tip={descriptions[s]} />
          </div>
          <textarea
            className={`${INPUT_CLASS} min-h-[70px] resize-y`}
            value={fields[s] || ""}
            onChange={(e) => handleChange(s, e.target.value)}
            placeholder={placeholders[s]}
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
          placeholder="e.g. Route Mastery Score = weighted average of all metrics. Scores ≥ 80 indicate elite execution..."
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
            <label className={`${LABEL_CLASS} block mb-2`}>Bonus Rules</label>
            <textarea
              className={`${INPUT_CLASS} min-h-[60px] resize-y`}
              placeholder='e.g. +5 if all phases ≥ 80'
              value=""
              readOnly
            />
          </div>
          <div className="p-4 rounded-xl border border-outline-variant/15" style={{ backgroundColor: '#0E1319' }}>
            <label className={`${LABEL_CLASS} block mb-2`}>Confidence Thresholds</label>
            <textarea
              className={`${INPUT_CLASS} min-h-[60px] resize-y`}
              placeholder='e.g. Below 0.6 = low confidence warning'
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
                <label className={`${LABEL_CLASS} mb-2 block truncate`}>{m.name || "Unnamed"}</label>
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
