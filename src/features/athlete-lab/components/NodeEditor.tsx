import { useState, useEffect, useCallback, useRef } from "react";
import type { TrainingNode, KeyMetric, CommonError, PhaseNote, Badge, EliteVideo, NodeStatus, CameraAngle, VideoType, MechanicsSection, SegmentationMethod, ConfidenceHandling, ScoreBands, ReferenceCalibration, ReferenceFallback, PerformanceMode } from "../types";
import { KeyMetricsEditor } from "./KeyMetricsEditor";
import { updateNode, setNodeStatus } from "@/services/athleteLab";
import { SectionTooltip } from "./SectionTooltip";
import { TestingPanel } from "./TestingPanel";
import { HelpDrawer } from "./HelpDrawer";
import { ConfirmModal } from "./ConfirmModal";
import { CameraEditor, checkCameraCompleteness } from "./CameraEditor";
import { CheckpointsEditor, checkCheckpointCompleteness, migrateCheckpoints } from "./CheckpointsEditor";
import { LlmPromptEditor } from "./LlmPromptEditor";
import { BadgesEditor, migrateBadges } from "./BadgesEditor";
import { toast } from "sonner";
import { NodeReadinessBar } from "./NodeReadinessBar";
import { generateTabMarkdown } from "../utils/nodeExport";

type CopyState = "idle" | "success" | "error";

function TabCopyButton({ onClick, title }: { onClick: () => Promise<void>; title: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleClick = async () => {
    try {
      await onClick();
      setState("success");
    } catch {
      setState("error");
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState("idle"), 2000);
  };

  const icon = state === "success" ? "check_circle" : state === "error" ? "error" : "content_copy";
  const color = state === "success" ? "#22c55e" : state === "error" ? "#ef4444" : undefined;

  return (
    <button
      onClick={handleClick}
      title={state === "error" ? "Copy failed — check clipboard permissions" : title}
      className="w-6 h-6 rounded-full flex items-center justify-center text-on-surface-variant/60 hover:text-on-surface-variant hover:bg-surface-container-high transition-all active:scale-95 shrink-0 mt-0.5"
    >
      <span className="material-symbols-outlined" style={{ fontSize: 14, color, transition: "color 0.2s" }}>{icon}</span>
    </button>
  );
}

interface NodeEditorProps {
  node: TrainingNode;
  onUpdated: (node: TrainingNode) => void;
  onIconChange?: (nodeId: string, iconUrl: string | null) => void;
}

type TabKey = "basics" | "videos" | "overview" | "mechanics" | "metrics" | "scoring" | "errors" | "phases" | "reference" | "camera" | "checkpoints" | "prompt" | "badges" | "training_status" | "test";

const TABS: { key: TabKey; label: string; icon: string; subtitle: string }[] = [
  { key: "basics", label: "Basics", icon: "edit", subtitle: "Set the identity, icon, and upload constraints for this node. Status controls whether athlete uploads trigger automatic analysis." },
  { key: "videos", label: "Videos", icon: "video_library", subtitle: "Add elite reference videos with clip timestamps, camera angle, and type. One video must be flagged as the Reference shown to athletes alongside their results." },
  { key: "overview", label: "Overview", icon: "description", subtitle: "Write a short athlete-facing description of this skill and why it matters. Shown at the top of the training feed before athletes film." },
  { key: "phases", label: "Phases", icon: "timeline", subtitle: "Define and sequence the movement phases for this skill. Each phase controls how video frames are segmented during analysis — set proportion weights to ensure metrics are evaluated in the right moment of the movement." },
  { key: "mechanics", label: "Mechanics", icon: "engineering", subtitle: "Define coaching cues for each phase of this skill. Phases are defined in the Phases tab — sections here link automatically to keep names and structure in sync." },
  { key: "metrics", label: "Metrics", icon: "analytics", subtitle: "Define what rtmlib measures in each phase and how scores are calculated. Each metric maps body keypoints to a calculation type — the direct instruction set for the analysis pipeline." },
  { key: "scoring", label: "Scoring", icon: "scoreboard", subtitle: "Configure how the Mastery Score is calculated, how low-confidence keypoints are handled, and how scores are communicated to athletes." },
  { key: "errors", label: "Errors", icon: "error_outline", subtitle: "Define common mistakes, set severity levels, and configure auto-detection conditions so the pipeline can automatically confirm errors from metric output." },
  { key: "reference", label: "Reference", icon: "straighten", subtitle: "Define reference objects for each camera angle so the pipeline can convert pixel distances to real-world yards. Required for all Distance and Velocity metrics." },
  { key: "camera", label: "Camera", icon: "videocam", subtitle: "Set filming requirements and guidelines that ensure athlete videos produce reliable keypoint detection. These settings directly affect analysis accuracy." },
  { key: "checkpoints", label: "Checkpoints", icon: "flag", subtitle: "Define frame-level body position events that trigger phase boundaries. Used when Segmentation Method in the Phases tab is set to Checkpoint-triggered." },
  { key: "prompt", label: "LLM Prompt", icon: "smart_toy", subtitle: "Write the coaching feedback template Claude uses to generate athlete results. Use the variable registry below to inject real analysis data into your prompt." },
  { key: "badges", label: "Badges", icon: "military_tech", subtitle: "Define achievements athletes earn by hitting performance milestones. Badges appear on athlete profiles and provide motivation to improve." },
  { key: "training_status", label: "Training Status", icon: "memory", subtitle: "Configure the rtmlib pose estimation engine settings for this node. These parameters are passed directly to Cloud Run and determine which model runs and how." },
  { key: "test", label: "Run Analysis", icon: "science", subtitle: "Test the node configuration with sample videos and review AI output." },
];


/* Critical tabs that auto-draft when changed on a live node */
const CRITICAL_TABS: TabKey[] = ["metrics", "phases", "scoring", "prompt", "training_status"];

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

  // Keypoint mapping completeness for each metric
  for (const m of node.key_metrics) {
    const km = m.keypoint_mapping;
    if (!km || !km.calculation_type) {
      issues.push({ label: "Metrics", detail: `${m.name || "Untitled"}: missing keypoint mapping` });
    } else {
      if (km.keypoint_indices.length === 0) {
        issues.push({ label: "Metrics", detail: `${m.name || "Untitled"}: no keypoints selected` });
      } else {
        // Validate count for calc type
        const count = km.keypoint_indices.length;
        if (km.calculation_type === "angle" && count !== 3) {
          issues.push({ label: "Metrics", detail: `${m.name}: Angle requires exactly 3 keypoints (${count} selected)` });
        } else if ((km.calculation_type === "distance" || km.calculation_type === "frame_delta") && count !== 2) {
          issues.push({ label: "Metrics", detail: `${m.name}: ${km.calculation_type} requires exactly 2 keypoints (${count} selected)` });
        } else if ((km.calculation_type === "velocity" || km.calculation_type === "acceleration") && (count < 1 || count > 2)) {
          issues.push({ label: "Metrics", detail: `${m.name}: ${km.calculation_type} requires 1-2 keypoints (${count} selected)` });
        }
      }
      if (!km.phase_id) {
        issues.push({ label: "Metrics", detail: `${m.name || "Untitled"}: no phase assigned` });
      }
      // Temporal window check
      const tw = m.temporal_window ?? 1;
      if (km.calculation_type === "velocity" && tw < 3) {
        issues.push({ label: "Metrics", detail: `${m.name}: temporal window too low for velocity (${tw}, need ≥3)` });
      } else if (km.calculation_type === "acceleration" && tw < 5) {
        issues.push({ label: "Metrics", detail: `${m.name}: temporal window too low for acceleration (${tw}, need ≥5)` });
      } else if (km.calculation_type === "frame_delta" && tw < 10) {
        issues.push({ label: "Metrics", detail: `${m.name}: temporal window too low for frame delta (${tw}, need ≥10)` });
      }
    }
  }

  // At least 1 phase
  if (node.phase_breakdown.length === 0) {
    issues.push({ label: "Phases", detail: "At least 1 phase with notes is required" });
  }

  // LLM prompt not empty
  if (!node.llm_prompt_template || node.llm_prompt_template.trim().length === 0) {
    issues.push({ label: "LLM Prompt", detail: "Prompt template cannot be empty" });
  }

  // Solution class must be configured
  if (!node.solution_class || node.solution_class.trim().length === 0) {
    issues.push({ label: "Training Status", detail: "Solution class not configured" });
  } else {
    // Check solution class supports all keypoint indices
    const sc = node.solution_class;
    for (const m of node.key_metrics) {
      const indices = m.keypoint_mapping?.keypoint_indices ?? [];
      if (sc === "body" && indices.some(i => i >= 17)) {
        const needsFeet = indices.some(i => i >= 17 && i <= 22);
        const needsHands = indices.some(i => i >= 91);
        if (needsHands) {
          issues.push({ label: "Training Status", detail: `${m.name || "Untitled"} uses hand keypoints requiring Wholebody` });
        } else if (needsFeet) {
          issues.push({ label: "Training Status", detail: `${m.name || "Untitled"} uses feet keypoints requiring Body with Feet or higher` });
        }
      }
      if (sc === "body_with_feet" && indices.some(i => i >= 91)) {
        issues.push({ label: "Training Status", detail: `${m.name || "Untitled"} uses hand keypoints requiring Wholebody` });
      }
    }
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

  // Reference calibration checks (skip for wholebody3d)
  if (node.solution_class !== "wholebody3d") {
    const calibrations = node.reference_calibrations ?? [];
    const hasAtLeastOne = calibrations.some(c => c.pixels_per_yard != null && c.pixels_per_yard > 0);
    if (!hasAtLeastOne) {
      issues.push({ label: "Reference", detail: "At least one camera angle must be calibrated (pixels_per_yard set)" });
    }
  }

  // Camera completeness
  const cameraIssues = checkCameraCompleteness(node);
  issues.push(...cameraIssues);

  // Checkpoint completeness
  const checkpointIssues = checkCheckpointCompleteness(node.segmentation_method ?? "proportional", migrateCheckpoints(node.form_checkpoints));
  issues.push(...checkpointIssues);

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
  const [helpTabKey, setHelpTabKey] = useState<TabKey>("basics");
  const [statusModal, setStatusModal] = useState<"go-live" | "go-draft" | "blocking" | null>(null);
  const [blockingItems, setBlockingItems] = useState<BlockingItem[]>([]);
  const [toggling, setToggling] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ title: string; body: string; confirmLabel: string; onConfirm: () => void } | null>(null);
  const criticalChanged = useRef(false);

  useEffect(() => {
    // Normalize metrics on load: ensure keypoint_mapping fields have defaults
    const normalizedNode = {
      ...node,
      form_checkpoints: migrateCheckpoints(node.form_checkpoints),
      badges: migrateBadges(node.badges as any),
      key_metrics: (node.key_metrics ?? []).map((m) => ({
        tolerance: null,
        temporal_window: 1,
        depends_on_metric_id: null,
        ...m,
        keypoint_mapping: m.keypoint_mapping
          ? {
              body_groups: ["body"],
              keypoint_indices: [],
              calculation_type: null,
              bilateral: "auto" as const,
              confidence_threshold: 0.70,
              phase_id: null,
              ...m.keypoint_mapping,
            }
          : null,
      })),
    };
    setDraft(normalizedNode);
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
        llm_tone: draft.llm_tone,
        llm_max_words: draft.llm_max_words,
        llm_system_instructions: draft.llm_system_instructions,
        badges: draft.badges,
        elite_videos: draft.elite_videos,
        knowledge_base: draft.knowledge_base,
        clip_duration_min: draft.clip_duration_min,
        clip_duration_max: draft.clip_duration_max,
        segmentation_method: draft.segmentation_method,
        confidence_handling: draft.confidence_handling,
        min_metrics_threshold: draft.min_metrics_threshold,
        score_bands: draft.score_bands,
        scoring_renormalize_on_skip: draft.scoring_renormalize_on_skip,
        solution_class: draft.solution_class,
        reference_calibrations: draft.reference_calibrations,
        reference_filming_instructions: draft.reference_filming_instructions,
        reference_fallback_behavior: draft.reference_fallback_behavior,
        performance_mode: draft.performance_mode,
        det_frequency: draft.det_frequency,
        det_frequency_solo: draft.det_frequency_solo,
        det_frequency_defender: draft.det_frequency_defender,
        det_frequency_multiple: draft.det_frequency_multiple,
        tracking_enabled: draft.tracking_enabled,
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

      {/* ── Readiness Bar ── */}
      <NodeReadinessBar node={draft} onTabChange={setTab} onSetLive={handleStatusToggle} />

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
              {tab === "metrics" && (
                <a
                  href="https://github.com/iaawesmith/playcoach-athlete-profile/blob/main/src/constants/keypointLibrary.json"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View the full 133-keypoint COCO-WholeBody reference used by the analysis pipeline."
                  className="text-on-surface-variant/60 text-[11px] font-medium hover:text-on-surface-variant transition-colors shrink-0 mt-1"
                >
                  133 Keypoints ↗
                </a>
              )}
              {tab !== "test" && (
                <TabCopyButton
                  onClick={async () => {
                    const md = generateTabMarkdown(draft, tab as unknown as Parameters<typeof generateTabMarkdown>[1]);
                    await navigator.clipboard.writeText(md);
                  }}
                  title={`Copy ${activeTab?.label} tab for AI`}
                />
              )}
              <button
                onClick={() => { setHelpTabKey(tab); setHelpOpen(true); }}
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
            <MechanicsEditor value={draft.pro_mechanics} onChange={(v) => update("pro_mechanics", v)} phases={draft.phase_breakdown} metrics={draft.key_metrics} onConfirmDelete={(opts) => setConfirmModal(opts)} />
          </div>
        )}

        {tab === "metrics" && (
          <KeyMetricsEditor metrics={draft.key_metrics} onChange={(m) => updateWithCriticalTrack("key_metrics", m)} onConfirmDelete={(opts) => setConfirmModal(opts)} phases={draft.phase_breakdown} />
        )}

        {tab === "scoring" && (
          <ScoringEditor
            scoringRules={draft.scoring_rules}
            onScoringRulesChange={(v) => updateWithCriticalTrack("scoring_rules", v)}
            metrics={draft.key_metrics}
            confidenceHandling={draft.confidence_handling ?? "skip"}
            onConfidenceHandlingChange={(v) => updateWithCriticalTrack("confidence_handling", v)}
            minMetricsThreshold={draft.min_metrics_threshold ?? 50}
            onMinMetricsThresholdChange={(v) => updateWithCriticalTrack("min_metrics_threshold", v)}
            scoreBands={draft.score_bands ?? { elite: "Elite", varsity: "Varsity Ready", developing: "Developing", needs_work: "Needs Work" }}
            onScoreBandsChange={(v) => updateWithCriticalTrack("score_bands", v)}
            renormalizeOnSkip={draft.scoring_renormalize_on_skip ?? true}
            onRenormalizeOnSkipChange={(v) => updateWithCriticalTrack("scoring_renormalize_on_skip", v)}
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
          <ReferenceCalibrationEditor
            solutionClass={draft.solution_class ?? ""}
            calibrations={draft.reference_calibrations ?? []}
            onCalibrationsChange={(c) => update("reference_calibrations", c)}
            filmingInstructions={draft.reference_filming_instructions ?? ""}
            onFilmingInstructionsChange={(v) => update("reference_filming_instructions", v)}
            fallbackBehavior={(draft.reference_fallback_behavior ?? "pixel_warning") as ReferenceFallback}
            onFallbackBehaviorChange={(v) => update("reference_fallback_behavior", v)}
            eliteVideos={draft.elite_videos ?? []}
          />
        )}

        {tab === "camera" && (
          <CameraEditor node={draft} value={draft.camera_guidelines} onChange={(v) => update("camera_guidelines", v)} />
        )}

        {tab === "checkpoints" && (
          <CheckpointsEditor checkpoints={draft.form_checkpoints} onChange={(c) => update("form_checkpoints", c)} onConfirmDelete={(opts) => setConfirmModal(opts)} phases={draft.phase_breakdown} segmentationMethod={draft.segmentation_method ?? "proportional"} keyMetrics={draft.key_metrics} />
        )}

        {tab === "prompt" && (
          <LlmPromptEditor
            promptTemplate={draft.llm_prompt_template}
            onPromptChange={(v) => updateWithCriticalTrack("llm_prompt_template", v)}
            tone={draft.llm_tone ?? "direct"}
            onToneChange={(v) => updateWithCriticalTrack("llm_tone" as keyof TrainingNode, v as never)}
            maxWords={draft.llm_max_words ?? 150}
            onMaxWordsChange={(v) => updateWithCriticalTrack("llm_max_words" as keyof TrainingNode, v as never)}
            systemInstructions={draft.llm_system_instructions ?? ""}
            onSystemInstructionsChange={(v) => updateWithCriticalTrack("llm_system_instructions" as keyof TrainingNode, v as never)}
          />
        )}

        {tab === "badges" && (
          <BadgesEditor badges={draft.badges} keyMetrics={draft.key_metrics} onChange={(b) => update("badges", b)} onConfirmDelete={(opts) => setConfirmModal(opts)} />
        )}

        {tab === "training_status" && (
          <TrainingStatusEditor
            node={draft}
            onSolutionClassChange={(v) => { updateWithCriticalTrack("solution_class", v); if (v === "wholebody3d") update("tracking_enabled", false); }}
            onPerformanceModeChange={(v) => updateWithCriticalTrack("performance_mode", v)}
            onDetFrequencyChange={(v) => updateWithCriticalTrack("det_frequency", v)}
            onDetFrequencySoloChange={(v) => updateWithCriticalTrack("det_frequency_solo", v)}
            onDetFrequencyDefenderChange={(v) => updateWithCriticalTrack("det_frequency_defender", v)}
            onDetFrequencyMultipleChange={(v) => updateWithCriticalTrack("det_frequency_multiple", v)}
            onTrackingEnabledChange={(v) => updateWithCriticalTrack("tracking_enabled", v)}
            onNavigateTab={(t) => setTab(t)}
          />
        )}

        {tab === "test" && (
          <TestingPanel node={draft} />
        )}

        </div>

        <HelpDrawer
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          tabKey={helpTabKey}
          tabLabel={TABS.find((t) => t.key === helpTabKey)?.label ?? helpTabKey}
          tabs={TABS.filter((t) => t.key !== "test")}
          onTabChange={(key) => setHelpTabKey(key as TabKey)}
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
            <SectionTooltip tip="Educational — shown to athletes in the training feed before they film. Teaches the skill and what to look for. Analysis — shown to athletes alongside their results as context. Not processed by rtmlib — for visual reference only. Both — shown in both the training feed and results screen." />
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
              <SectionTooltip tip="Marks this as the elite benchmark video shown to athletes next to their results. One per node. Not processed by rtmlib — for athlete motivation and comparison only." />
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
      {/* Section label + count indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <label className={LABEL_CLASS}>Reference Videos</label>
          <SectionTooltip tip="Add YouTube clips used for athlete education and pipeline calibration. Set start and end timestamps on any video used for analysis. Only one video can serve as the Reference — the elite example shown alongside athlete results." />
        </div>
        <span className={`text-[10px] font-semibold uppercase tracking-widest ${videos.length >= 3 ? "text-emerald-400" : videos.length === 2 ? "text-amber-400" : "text-red-400"}`}>
          {videos.length} of 3+ recommended
        </span>
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

      {/* Camera Angle Coverage */}
      {(() => {
        const configuredAngles = new Set(videos.map(v => v.camera_angle).filter(Boolean));
        const angles = [
          { key: "sideline", label: "Sideline" },
          { key: "endzone", label: "Endzone" },
          { key: "behind_qb", label: "Behind QB" },
        ] as const;
        return (
          <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: '#131920' }}>
            <span className={LABEL_CLASS}>Camera Coverage</span>
            <div className="space-y-1">
              {angles.map(a => (
                <div key={a.key} className="flex items-center gap-2 text-xs">
                  <span className={configuredAngles.has(a.key) ? "text-emerald-400" : "text-red-400"}>
                    {configuredAngles.has(a.key) ? "✅" : "❌"}
                  </span>
                  <span className="text-on-surface-variant">{a.label}</span>
                </div>
              ))}
            </div>
            <p className="text-on-surface-variant/50 text-[10px]">
              Each camera angle needs its own Reference calibration for Distance and Velocity metrics.
            </p>
          </div>
        );
      })()}

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

/* KeyMetricsEditor moved to ./KeyMetricsEditor.tsx */

function CommonErrorsEditor({ errors, onChange, onConfirmDelete }: { errors: CommonError[]; onChange: (e: CommonError[]) => void; onConfirmDelete: ConfirmDeleteFn }) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<CommonError>({ error: "", correction: "", severity: "common", auto_detection_condition: "", auto_detectable: false });
  const [editDraft, setEditDraft] = useState<CommonError>({ error: "", correction: "", severity: "common", auto_detection_condition: "", auto_detectable: false });

  const startEdit = (i: number) => {
    setEditIdx(i);
    setEditDraft({ severity: "common", auto_detection_condition: "", auto_detectable: false, ...errors[i] });
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
    setDraft({ error: "", correction: "", severity: "common", auto_detection_condition: "", auto_detectable: false });
    setAdding(false);
  };

  const SEVERITY_OPTIONS: { value: string; label: string; activeClass: string }[] = [
    { value: "minor", label: "MINOR", activeClass: "bg-on-surface-variant/20 text-on-surface-variant border-on-surface-variant/40" },
    { value: "common", label: "COMMON", activeClass: "bg-amber-500/15 text-amber-400 border-amber-500/40" },
    { value: "critical", label: "CRITICAL", activeClass: "bg-red-500/15 text-red-400 border-red-500/40" },
  ];

  const severityPill = (sev: string | undefined) => {
    const s = sev || "common";
    const opt = SEVERITY_OPTIONS.find(o => o.value === s);
    if (!opt) return null;
    return <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${opt.activeClass}`}>{opt.label}</span>;
  };

  const renderFields = (err: CommonError, setErr: (v: CommonError) => void) => (
    <div className="space-y-3 pt-3">
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className={LABEL_CLASS}>Error Name</span>
          <SectionTooltip tip="A short, descriptive name for this common error. Used as a label in athlete feedback and auto-detection rules." />
        </div>
        <input className={INPUT_CLASS} value={err.error} onChange={(e) => setErr({ ...err, error: e.target.value })} placeholder="e.g. Rounding the break instead of planting and cutting" />
      </div>

      {/* Severity */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className={LABEL_CLASS}>Severity</span>
          <SectionTooltip tip="How prominently this error appears in athlete feedback. Critical errors are always highlighted first regardless of other results. Common errors appear in standard feedback flow. Minor errors are mentioned only when the athlete's score is high enough that small details matter." />
        </div>
        <div className="flex gap-2">
          {SEVERITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setErr({ ...err, severity: opt.value as CommonError["severity"] })}
              className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] border transition-all active:scale-95 ${(err.severity || "common") === opt.value ? opt.activeClass : "border-outline-variant/20 text-on-surface-variant/50 hover:border-outline-variant/40"}`}
              style={(err.severity || "common") !== opt.value ? { backgroundColor: '#0E1319' } : undefined}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className={LABEL_CLASS}>Correction</span>
          <SectionTooltip tip="The coaching correction shown to the athlete when this error is detected. Be specific and actionable." />
        </div>
        <textarea className={`${INPUT_CLASS} min-h-[60px] resize-y`} value={err.correction} onChange={(e) => setErr({ ...err, correction: e.target.value })} placeholder="e.g. Plant hard on the inside foot at 45 degrees, then accelerate through the break" />
      </div>

      {/* Auto-Detection Condition */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className={LABEL_CLASS}>Auto-Detection Condition</span>
            <SectionTooltip tip="Optional. A metric-based rule that lets the pipeline automatically detect and confirm this error from analysis output. Format: [Metric Name] [operator] [value]. Example: 'Break Angle > 52' — fires when Break Angle measurement exceeds 52 degrees. When fired, this error is passed to Claude as a confirmed observation, not a possibility." />
          </div>
          <div className="flex items-center gap-2">
            <span className={`${LABEL_CLASS} flex items-center gap-1`}>
              Auto-Detectable
              <SectionTooltip tip="When ON, the pipeline evaluates the condition above against metric results for every analysis. Confirmed detections are passed to Claude as facts. When OFF, this error exists as LLM context only — Claude may mention it as a possibility based on low metric scores but cannot confirm it automatically." />
            </span>
            <button
              type="button"
              onClick={() => setErr({ ...err, auto_detectable: !err.auto_detectable })}
              className={`relative w-10 h-5 rounded-full transition-colors ${err.auto_detectable ? "bg-primary-container" : "bg-outline-variant/30"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${err.auto_detectable ? "translate-x-5 bg-[#00460a]" : "translate-x-0.5 bg-on-surface-variant/60"}`} />
            </button>
          </div>
        </div>
        <input
          className={INPUT_CLASS}
          value={err.auto_detection_condition || ""}
          onChange={(e) => {
            const val = e.target.value;
            setErr({ ...err, auto_detection_condition: val, auto_detectable: val.trim().length > 0 ? true : false });
          }}
          placeholder="e.g. Break Angle > 52"
        />
        <p className="text-on-surface-variant/50 text-[10px] mt-1.5 leading-relaxed">
          Format: [Metric Name] [{">"} {"<"} = ≥ ≤] [value] — Leave blank if this error cannot be auto-detected from metric output.
        </p>
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
                {severityPill(err.severity)}
                {err.auto_detectable && (
                  <span className="text-primary-container/60 text-[9px] font-semibold uppercase tracking-widest flex items-center gap-0.5 shrink-0">
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>bolt</span>
                    auto
                  </span>
                )}
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
            <button onClick={() => { setAdding(false); setDraft({ error: "", correction: "", severity: "common", auto_detection_condition: "", auto_detectable: false }); }} className="px-4 py-2 rounded-lg text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors" style={{ backgroundColor: '#1A2029' }}>Cancel</button>
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

/* BadgesEditor moved to BadgesEditor.tsx */

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

function MechanicsEditor({ value, onChange, phases, metrics, onConfirmDelete }: StructuredEditorProps & { phases: PhaseNote[]; metrics: KeyMetric[]; onConfirmDelete: ConfirmDeleteFn }) {
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

                {/* Auto-generated metric summary */}
                {(() => {
                  const phaseMetrics = metrics.filter(m => m.keypoint_mapping?.phase_id === sec.phase_id && sec.phase_id);
                  if (phaseMetrics.length === 0) return null;
                  const totalWeight = phaseMetrics.reduce((s, m) => s + m.weight, 0);
                  let names: string;
                  if (phaseMetrics.length === 1) {
                    names = phaseMetrics[0].name;
                  } else if (phaseMetrics.length === 2) {
                    names = `${phaseMetrics[0].name} and ${phaseMetrics[1].name}`;
                  } else {
                    names = phaseMetrics.slice(0, -1).map(m => m.name).join(", ") + ", and " + phaseMetrics[phaseMetrics.length - 1].name;
                  }
                  const verb = phaseMetrics.length === 1 ? "is" : "are";
                  return (
                    <div className="mt-2 px-3 py-2 rounded-lg border border-outline-variant/10" style={{ backgroundColor: '#0d1218' }}>
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-on-surface-variant/40 mb-1">Auto: Metrics measured in this phase</p>
                      <p className="text-on-surface-variant/70 text-xs leading-relaxed">{names} {verb} measured in this phase — {totalWeight}% of your total score.</p>
                    </div>
                  );
                })()}
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

/* ── Solution class helpers ── */
const SOLUTION_CLASSES = [
  { value: "body", title: "Body", desc: "Standard 17-keypoint body detection. Fastest model, lowest memory.", coverage: "Keypoints 0-16: Head, Shoulders, Arms, Hips, Knees, Ankles", useWhen: "No foot or hand keypoints used in any metric" },
  { value: "body_with_feet", title: "Body with Feet", desc: "26-keypoint model adding heel and toe detection. Required for heel plant metrics.", coverage: "Keypoints 0-22: Body + Big Toe, Small Toe, Heel (both feet)", useWhen: "Any metric uses keypoints 17-22 (heel plant, toe push-off)" },
  { value: "wholebody", title: "Wholebody", desc: "Full 133-keypoint 2D model. Required for hand and face keypoints.", coverage: "Keypoints 0-132: Full body + hands + face (2D pixel coordinates)", useWhen: "Any metric uses hand keypoints 91-132 (catch efficiency, hand position)" },
  { value: "wholebody3d", title: "Wholebody 3D", desc: "Full 133-keypoint 3D model. Returns coordinates in meters — no Reference tab calibration needed.", coverage: "Keypoints 0-132: Full body + hands + face (3D coordinates in meters)", useWhen: "Maximum accuracy required. Note: tracking must be OFF for 3D models." },
] as const;

const SOLUTION_CLASS_MAP: Record<string, string> = {
  body: "Body",
  body_with_feet: "BodyWithFeet",
  wholebody: "Wholebody",
  wholebody3d: "Wholebody3D",
};

function getSolutionClassWarnings(solutionClass: string, metrics: KeyMetric[], trackingEnabled: boolean): string[] {
  const warnings: string[] = [];
  for (const m of metrics) {
    const indices = m.keypoint_mapping?.keypoint_indices ?? [];
    if (solutionClass === "body") {
      if (indices.some(i => i >= 17 && i <= 22)) warnings.push(`⚠ ${m.name || "Untitled"} uses feet keypoints (indices 17-22) — requires Body with Feet or higher.`);
      if (indices.some(i => i >= 91)) warnings.push(`⚠ ${m.name || "Untitled"} uses hand keypoints (indices 91-132) — requires Wholebody.`);
    }
    if (solutionClass === "body_with_feet" && indices.some(i => i >= 91)) {
      warnings.push(`⚠ ${m.name || "Untitled"} uses hand keypoints (indices 91-132) — requires Wholebody.`);
    }
  }
  if (solutionClass === "wholebody3d" && trackingEnabled) {
    warnings.push("⚠ Wholebody 3D requires Tracking = OFF. 3D coordinate tracking with IoU is unreliable.");
  }
  return warnings;
}

function TrainingStatusEditor({ node, onSolutionClassChange, onPerformanceModeChange, onDetFrequencyChange, onDetFrequencySoloChange, onDetFrequencyDefenderChange, onDetFrequencyMultipleChange, onTrackingEnabledChange, onNavigateTab }: {
  node: TrainingNode;
  onSolutionClassChange: (v: string) => void;
  onPerformanceModeChange: (v: PerformanceMode) => void;
  onDetFrequencyChange: (v: number) => void;
  onDetFrequencySoloChange: (v: number) => void;
  onDetFrequencyDefenderChange: (v: number) => void;
  onDetFrequencyMultipleChange: (v: number) => void;
  onTrackingEnabledChange: (v: boolean) => void;
  onNavigateTab: (t: TabKey) => void;
}) {
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const sc = node.solution_class ?? "";
  const pm = node.performance_mode ?? "balanced";
  const df = node.det_frequency ?? 7;
  const dfSolo = node.det_frequency_solo ?? 2;
  const dfDefender = node.det_frequency_defender ?? 1;
  const dfMultiple = node.det_frequency_multiple ?? 1;
  const te = node.tracking_enabled ?? true;
  const scWarnings = getSolutionClassWarnings(sc, node.key_metrics, te);

  /* ── Readiness checks ── */
  const readiness: { label: string; ok: boolean; detail: string; tab: TabKey }[] = [];
  readiness.push({ label: "Solution class configured", ok: !!sc, detail: sc ? `Set to ${SOLUTION_CLASSES.find(s => s.value === sc)?.title ?? sc}` : "Not set", tab: "training_status" });
  const scConflicts = sc ? getSolutionClassWarnings(sc, node.key_metrics, false) : [];
  readiness.push({ label: "Solution class supports all keypoints", ok: !!sc && scConflicts.length === 0, detail: scConflicts.length > 0 ? `${scConflicts.length} conflict(s)` : "All metrics compatible", tab: "training_status" });

  const allMapped = node.key_metrics.length > 0 && node.key_metrics.every(m => m.keypoint_mapping?.calculation_type);
  readiness.push({ label: "All metrics have keypoint mapping", ok: allMapped, detail: allMapped ? `${node.key_metrics.length} metrics mapped` : "Some metrics missing mapping", tab: "metrics" });
  const totalWeight = node.key_metrics.reduce((s, m) => s + m.weight, 0);
  readiness.push({ label: "Metric weights sum to 100%", ok: totalWeight === 100, detail: `Currently ${totalWeight}%`, tab: "metrics" });
  const allPhased = node.key_metrics.length > 0 && node.key_metrics.every(m => m.keypoint_mapping?.phase_id);
  readiness.push({ label: "All metrics have phase assigned", ok: allPhased, detail: allPhased ? "All assigned" : "Some missing phase", tab: "metrics" });

  readiness.push({ label: "At least 4 phases defined", ok: node.phase_breakdown.length >= 4, detail: `${node.phase_breakdown.length} phases`, tab: "phases" });
  const segMethod = node.segmentation_method ?? "proportional";
  const phaseWeightSum = node.phase_breakdown.reduce((s, p) => s + (p.weight ?? 0), 0);
  readiness.push({ label: "Phase weights sum to 100%", ok: segMethod !== "proportional" || phaseWeightSum === 100, detail: segMethod === "proportional" ? `${phaseWeightSum}%` : "N/A (checkpoint)", tab: "phases" });

  const hasVideos = node.elite_videos.some(v => v.url?.trim());
  readiness.push({ label: "At least 1 video configured", ok: hasVideos, detail: hasVideos ? `${node.elite_videos.filter(v => v.url?.trim()).length} videos` : "No videos", tab: "videos" });
  const hasRef = node.elite_videos.some(v => v.is_reference);
  readiness.push({ label: "Reference video flagged", ok: hasRef, detail: hasRef ? "Set" : "Not set", tab: "videos" });
  const allTimestamped = node.elite_videos.filter(v => v.url?.trim()).every(v => v.start_seconds != null && v.end_seconds != null);
  readiness.push({ label: "All videos have timestamps", ok: !hasVideos || allTimestamped, detail: allTimestamped ? "All set" : "Some missing", tab: "videos" });

  if (sc !== "wholebody3d") {
    const cals = node.reference_calibrations ?? [];
    const hasAtLeastOne = cals.some(c => c.pixels_per_yard != null && c.pixels_per_yard > 0);
    readiness.push({ label: "At least 1 camera angle calibrated", ok: hasAtLeastOne, detail: hasAtLeastOne ? "Calibrated" : "No angles calibrated", tab: "reference" });
  }

  readiness.push({ label: "Prompt template not empty", ok: !!(node.llm_prompt_template?.trim()), detail: node.llm_prompt_template?.trim() ? `${node.llm_prompt_template.trim().length} chars` : "Empty", tab: "prompt" });

  const passCount = readiness.filter(r => r.ok).length;
  const failCount = readiness.length - passCount;
  const allPass = failCount === 0;

  const scClassName = SOLUTION_CLASS_MAP[sc] ?? "Body";
  const pipelineCode = `from rtmlib import PoseTracker, ${scClassName}

# Solo analysis (1 person in frame)
pose_tracker = PoseTracker(
    ${scClassName},
    det_frequency=${dfSolo},  # solo
    tracking=${te ? "True" : "False"},
    mode='${pm}',
    backend='onnxruntime',
    device='cuda'
)

# With defender (2 people in frame)
pose_tracker = PoseTracker(
    ${scClassName},
    det_frequency=${dfDefender},  # with_defender
    tracking=${te ? "True" : "False"},
    mode='${pm}',
    backend='onnxruntime',
    device='cuda'
)

# Multiple people in frame
pose_tracker = PoseTracker(
    ${scClassName},
    det_frequency=${dfMultiple},  # multiple
    tracking=${te ? "True" : "False"},
    mode='${pm}',
    backend='onnxruntime',
    device='cuda'
)`;

  return (
    <div className="space-y-8">
      {/* SECTION 1 — SOLUTION CLASS */}
      <div>
        <div className="text-on-surface font-black uppercase tracking-tighter text-lg mb-1">Model Configuration</div>
        <div className="border-t border-outline-variant/10 pt-5 space-y-4">
          <div className="flex items-center gap-1.5 mb-2">
            <label className={LABEL_CLASS}>Solution Class</label>
            <SectionTooltip tip="Determines which rtmlib model tier is instantiated on Cloud Run. Must support ALL keypoint indices used in this node's metrics. Selecting a tier that doesn't support your keypoints returns empty arrays — metrics fail silently with no error." />
          </div>
          <div className="space-y-3">
            {SOLUTION_CLASSES.map(opt => (
              <label key={opt.value} className={`block p-5 rounded-xl border cursor-pointer transition-all ${sc === opt.value ? 'border-primary-container/50' : 'border-outline-variant/20 hover:border-outline-variant/40'}`} style={{ backgroundColor: sc === opt.value ? 'rgba(0,230,57,0.04)' : '#1A2029' }}>
                <div className="flex items-start gap-3">
                  <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${sc === opt.value ? 'border-primary-container' : 'border-outline-variant/50'}`}>
                    {sc === opt.value && <div className="w-2 h-2 rounded-full bg-primary-container" />}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="text-on-surface font-black uppercase tracking-tighter text-base">{opt.title}</div>
                    <p className="text-on-surface-variant text-sm leading-relaxed">{opt.desc}</p>
                    <div className="text-on-surface-variant/70 text-xs"><span className="font-semibold text-on-surface-variant">Coverage:</span> {opt.coverage}</div>
                    <div className="text-on-surface-variant/70 text-xs"><span className="font-semibold text-on-surface-variant">Use when:</span> {opt.useWhen}</div>
                  </div>
                </div>
                <input type="radio" className="sr-only" checked={sc === opt.value} onChange={() => onSolutionClassChange(opt.value)} />
              </label>
            ))}
          </div>
          {scWarnings.length > 0 && (
            <div className="space-y-2 mt-3">
              {scWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-amber-400 text-sm p-3 rounded-xl border border-amber-400/20" style={{ backgroundColor: 'rgba(245,158,11,0.05)' }}>
                  <span className="mt-0.5">{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2 — PERFORMANCE MODE */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <label className={LABEL_CLASS}>Performance Mode</label>
          <SectionTooltip tip="Controls which ONNX model weights are loaded. Passed directly to rtmlib PoseTracker as the mode parameter. Affects inference speed and keypoint accuracy." />
        </div>
        <div className="space-y-3">
          {([
            { value: "performance" as const, label: "PERFORMANCE", desc: "Largest, most accurate model. Recommended for high-weight metrics requiring maximum keypoint precision. Slower inference — adds 2-4 seconds to analysis time.", isDefault: false },
            { value: "balanced" as const, label: "BALANCED", desc: "Default rtmlib setting. Best speed/accuracy tradeoff for most nodes. Recommended for all standard route running nodes.", isDefault: true },
            { value: "lightweight" as const, label: "LIGHTWEIGHT", desc: "Fastest inference. Reduced accuracy — use only for simple metrics or when analysis time is critical.", isDefault: false },
          ]).map(opt => (
            <label key={opt.value} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${pm === opt.value ? 'border-primary-container/40' : 'border-outline-variant/20'}`} style={{ backgroundColor: pm === opt.value ? 'rgba(0,230,57,0.04)' : '#1A2029' }}>
              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${pm === opt.value ? 'border-primary-container' : 'border-outline-variant/50'}`}>
                {pm === opt.value && <div className="w-2 h-2 rounded-full bg-primary-container" />}
              </div>
              <div>
                <div className="text-on-surface text-xs font-black uppercase tracking-[0.15em]">{opt.label}{opt.isDefault && <span className="ml-2 text-on-surface-variant font-normal normal-case tracking-normal">(recommended)</span>}</div>
                <p className="text-on-surface-variant text-xs mt-1 leading-relaxed">{opt.desc}</p>
              </div>
              <input type="radio" className="sr-only" checked={pm === opt.value} onChange={() => onPerformanceModeChange(opt.value)} />
            </label>
          ))}
        </div>
      </div>

      {/* SECTION 3 — DETECTION SETTINGS */}
      <div>
        <div className="text-on-surface font-black uppercase tracking-tighter text-lg mb-1">Detection Settings</div>
        <div className="border-t border-outline-variant/10 pt-5 space-y-6">
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <label className={LABEL_CLASS}>Detection Frequency</label>
              <SectionTooltip tip="How often rtmlib runs full person detection vs tracking between detections. Lower number = more accurate but slower. The appropriate value depends on how many people are in the athlete's video — more people require more frequent detection to maintain accurate person tracking. These three values are selected automatically by the Edge Function based on the athlete's pre-upload input about people in video." />
            </div>
            <div className="space-y-4">
              {([
                { label: "Solo (1 person)", value: dfSolo, onChange: onDetFrequencySoloChange, helper: "Recommended 2 — captures fast break movements reliably", defaultVal: 2 },
                { label: "With Defender (2 people)", value: dfDefender, onChange: onDetFrequencyDefenderChange, helper: "Recommended 1 — frequent detection prevents person ID swap during close coverage", defaultVal: 1 },
                { label: "Multiple People", value: dfMultiple, onChange: onDetFrequencyMultipleChange, helper: "Recommended 1 — required for reliable tracking in crowded frame", defaultVal: 1 },
              ] as const).map(scenario => (
                <div key={scenario.label} className="flex items-start gap-4">
                  <div className="w-48 shrink-0 pt-2.5">
                    <span className="text-on-surface text-xs font-bold">{scenario.label}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <input type="number" min={1} max={30} step={1} className={`${INPUT_CLASS} w-20 text-center`} value={scenario.value} onChange={(e) => scenario.onChange(Math.max(1, Math.min(30, parseInt(e.target.value) || scenario.defaultVal)))} />
                      <span className="text-on-surface-variant/50 text-xs">frames</span>
                    </div>
                    <p className="text-on-surface-variant/50 text-[10px] mt-1">{scenario.helper}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 px-3 py-2 rounded-lg border border-outline-variant/10" style={{ backgroundColor: '#0d1218' }}>
              <p className="text-on-surface-variant/40 text-[10px]">Fallback: <span className="text-on-surface-variant/60 font-semibold">{df}</span> frames — used when no context is available (e.g. direct webhook without pre-upload context)</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <label className={LABEL_CLASS}>Tracking</label>
                <SectionTooltip tip="IoU-based person tracking between detection frames. Must be OFF for Wholebody 3D nodes — 3D coordinate tracking with IoU is unreliable and produces incorrect results. Automatically set to OFF when Wholebody 3D solution class is selected." />
              </div>
              <button
                type="button"
                disabled={sc === "wholebody3d"}
                onClick={() => onTrackingEnabledChange(!te)}
                className={`relative w-12 h-6 rounded-full transition-all ${te ? 'bg-primary-container' : 'bg-outline-variant/40'} ${sc === "wholebody3d" ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full shadow transition-transform ${te ? 'translate-x-6' : 'translate-x-0.5'}`} style={{ backgroundColor: '#f7f9fe' }} />
              </button>
            </div>
            {sc === "wholebody3d" && (
              <p className="text-on-surface-variant/60 text-[10px] mt-1.5">Tracking is automatically disabled for Wholebody 3D nodes.</p>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4 — NODE READINESS */}
      <div>
        <div className="text-on-surface font-black uppercase tracking-tighter text-lg mb-1">Node Readiness</div>
        <div className="border-t border-outline-variant/10 pt-5 space-y-4">
          {allPass ? (
            <div className="rounded-xl border border-primary-container/30 p-4 flex items-center gap-3" style={{ backgroundColor: 'rgba(0,230,57,0.06)' }}>
              <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 20 }}>check_circle</span>
              <span className="text-on-surface text-sm font-bold">NODE READY — all requirements met. You can set this node to Live.</span>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-400/30 p-4 flex items-center gap-3" style={{ backgroundColor: 'rgba(245,158,11,0.05)' }}>
              <span className="material-symbols-outlined text-amber-400" style={{ fontSize: 20 }}>warning</span>
              <span className="text-on-surface text-sm font-bold">{failCount} item{failCount !== 1 ? 's' : ''} need{failCount === 1 ? 's' : ''} attention before this node can go Live.</span>
            </div>
          )}
          <div className="space-y-1">
            {readiness.map((item, i) => (
              <button key={i} type="button" onClick={() => onNavigateTab(item.tab)} className="w-full flex items-start gap-2.5 p-3 rounded-xl text-left transition-all hover:bg-surface-container-high/50">
                <span className={`text-sm mt-0.5 ${item.ok ? 'text-primary-container' : 'text-red-400'}`}>{item.ok ? '✓' : '✗'}</span>
                <div className="flex-1">
                  <span className="text-on-surface text-sm">{item.label}</span>
                  <span className="text-on-surface-variant text-xs ml-2">— {item.detail}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 5 — PIPELINE REFERENCE */}
      <div>
        <button type="button" onClick={() => setPipelineOpen(!pipelineOpen)} className="w-full flex items-center justify-between text-on-surface font-black uppercase tracking-tighter text-lg">
          <span>Pipeline Reference</span>
          <span className="material-symbols-outlined text-on-surface-variant transition-transform" style={{ fontSize: 20, transform: pipelineOpen ? 'rotate(180deg)' : 'rotate(0)' }}>expand_more</span>
        </button>
        {pipelineOpen && (
          <div className="border-t border-outline-variant/10 pt-4 mt-2 space-y-2">
            <label className={LABEL_CLASS}>Generated Pipeline Code</label>
            <p className="text-on-surface-variant/60 text-[10px]">Read-only. This is the exact rtmlib instantiation the Edge Function will use for this node.</p>
            <pre className="p-4 rounded-xl text-xs font-mono text-primary-container/90 overflow-x-auto whitespace-pre leading-relaxed" style={{ backgroundColor: '#0E1319', border: '1px solid rgba(68,72,76,0.2)' }}>
              {sc ? pipelineCode : "# Select a solution class above to see generated code"}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

const CAMERA_ANGLES_LIST: CameraAngle[] = ["sideline", "endzone", "behind_qb"];
const CAMERA_ANGLE_LABELS: Record<CameraAngle, string> = { sideline: "Sideline", endzone: "Endzone", behind_qb: "Behind QB" };

const REF_PRESETS: { label: string; sizeYards: number }[] = [
  { label: "5-Yard Line Spacing", sizeYards: 5 },
  { label: "Hash Mark Width", sizeYards: 1.83 },
  { label: "Standard Cone", sizeYards: 0.5 },
];

const DEFAULT_CALIBRATIONS: Record<CameraAngle, Partial<ReferenceCalibration>> = {
  sideline: {},
  behind_qb: {
    reference_object_name: "Custom",
    placement_instructions: "Position a cone or marker on the hash marks directly behind the line of scrimmage. Hash marks are visible from the behind QB angle and provide a consistent reference. Measure pixel distance between two consecutive hash marks.",
    filming_instructions: "Film from directly behind the quarterback position, 5-8 yards behind the line of scrimmage at head height. The full route should be visible from snap to catch. Two hash marks must be visible in the frame for distance calibration.",
  },
  endzone: {
    reference_object_name: "5-Yard Line Spacing",
    known_size_yards: 5,
    placement_instructions: "Film from the back of the endzone at field level. The 5-yard line markers are visible across the full width of the field from this angle and provide accurate horizontal scale calibration.",
    filming_instructions: "Stand at the back of the endzone, centered on the field. Film at waist height. The full route must be visible from line of scrimmage to the catch point. Both sideline hash marks should be visible to establish field scale.",
  },
};

function ReferenceCalibrationEditor({
  solutionClass,
  calibrations,
  onCalibrationsChange,
  filmingInstructions,
  onFilmingInstructionsChange,
  fallbackBehavior,
  onFallbackBehaviorChange,
}: {
  solutionClass: string;
  calibrations: ReferenceCalibration[];
  onCalibrationsChange: (c: ReferenceCalibration[]) => void;
  filmingInstructions: string;
  onFilmingInstructionsChange: (v: string) => void;
  fallbackBehavior: ReferenceFallback;
  onFallbackBehaviorChange: (v: ReferenceFallback) => void;
  eliteVideos: EliteVideo[];
}) {
  const [collapsed, setCollapsed] = useState<Set<CameraAngle>>(new Set(["behind_qb", "endzone"]));

  if (solutionClass === "wholebody3d") {
    return (
      <div className="rounded-xl border border-primary-container/30 p-5 flex items-start gap-3" style={{ backgroundColor: 'rgba(0,230,57,0.06)' }}>
        <span className="material-symbols-outlined text-primary-container mt-0.5" style={{ fontSize: 20 }}>check_circle</span>
        <p className="text-on-surface text-sm leading-relaxed">
          <span className="font-bold text-primary-container">Reference calibration not required</span> — this node uses Wholebody3d which returns 3D coordinates in meters. Distance and Velocity metrics do not require pixel-to-yard conversion.
        </p>
      </div>
    );
  }

  const getCalibration = (angle: CameraAngle): ReferenceCalibration => {
    const existing = calibrations.find(c => c.camera_angle === angle);
    if (existing) return existing;
    const defaults = DEFAULT_CALIBRATIONS[angle];
    return {
      camera_angle: angle,
      reference_object_name: defaults.reference_object_name ?? "",
      known_size_yards: defaults.known_size_yards ?? null,
      known_size_unit: defaults.known_size_yards ? "yards" : undefined,
      placement_instructions: defaults.placement_instructions ?? "",
      pixels_per_yard: null,
      filming_instructions: defaults.filming_instructions ?? "",
    };
  };

  const updateCalibration = (angle: CameraAngle, patch: Partial<ReferenceCalibration>) => {
    const existing = getCalibration(angle);
    const updated = { ...existing, ...patch };
    const next = calibrations.filter(c => c.camera_angle !== angle);
    next.push(updated);
    onCalibrationsChange(next);
  };

  const isCalibrated = (angle: CameraAngle): boolean => {
    const c = getCalibration(angle);
    return !!(c.pixels_per_yard && c.pixels_per_yard > 0);
  };

  const toggleCollapse = (angle: CameraAngle) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(angle)) next.delete(angle);
      else next.add(angle);
      return next;
    });
  };

  const calibratedCount = CAMERA_ANGLES_LIST.filter(a => isCalibrated(a)).length;

  const UNIT_OPTIONS = ["yards", "feet", "inches"] as const;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <span className="text-on-surface-variant text-xs">
          <span className="font-bold text-on-surface">{calibratedCount}</span> of 3 camera angles calibrated
        </span>
      </div>

      {CAMERA_ANGLES_LIST.map(angle => {
        const cal = getCalibration(angle);
        const calibrated = isCalibrated(angle);
        const isCollapsed = collapsed.has(angle);

        return (
          <CalibrationCard
            key={angle}
            angle={angle}
            label={CAMERA_ANGLE_LABELS[angle]}
            calibration={cal}
            calibrated={calibrated}
            unitOptions={UNIT_OPTIONS}
            onUpdate={(patch) => updateCalibration(angle, patch)}
            isCollapsed={isCollapsed}
            onToggleCollapse={() => toggleCollapse(angle)}
          />
        );
      })}

      {/* Global fallback */}
      <div className="pt-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-outline-variant/20" />
          <span className={`${LABEL_CLASS} shrink-0`}>Global Fallback</span>
          <div className="h-px flex-1 bg-outline-variant/20" />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-4">
          <label className={LABEL_CLASS}>If No Reference Detected</label>
          <SectionTooltip tip="What the pipeline does if it cannot find a reference object in the athlete's video. This applies to any angle that fails reference detection." />
        </div>
        <div className="space-y-3">
          {([
            { value: "pixel_warning" as const, label: "USE PIXEL UNITS WITH WARNING", desc: "Score Distance metrics using pixel values. Flag results as uncalibrated in athlete results.", isDefault: true },
            { value: "disable_distance" as const, label: "DISABLE DISTANCE METRICS", desc: "Skip all Distance and Velocity metrics. Only Angle and Frame Delta metrics are scored.", isDefault: false },
            { value: "estimate_field_lines" as const, label: "ESTIMATE USING FIELD LINES", desc: "Attempt to estimate scale from standard field line spacing. Less accurate — use only as last resort.", isDefault: false },
          ]).map(opt => (
            <label key={opt.value} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${fallbackBehavior === opt.value ? 'border-primary-container/40' : 'border-outline-variant/20'}`} style={{ backgroundColor: fallbackBehavior === opt.value ? 'rgba(0,230,57,0.04)' : '#1A2029' }}>
              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${fallbackBehavior === opt.value ? 'border-primary-container' : 'border-outline-variant/50'}`}>
                {fallbackBehavior === opt.value && <div className="w-2 h-2 rounded-full bg-primary-container" />}
              </div>
              <div>
                <div className="text-on-surface text-xs font-black uppercase tracking-[0.15em]">{opt.label}{opt.isDefault && <span className="ml-2 text-on-surface-variant font-normal normal-case tracking-normal">(default)</span>}</div>
                <p className="text-on-surface-variant text-xs mt-1 leading-relaxed">{opt.desc}</p>
              </div>
              <input type="radio" className="sr-only" checked={fallbackBehavior === opt.value} onChange={() => onFallbackBehaviorChange(opt.value)} />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function CalibrationCard({ angle, label, calibration, calibrated, unitOptions, onUpdate, isCollapsed, onToggleCollapse }: {
  angle: CameraAngle;
  label: string;
  calibration: ReferenceCalibration;
  calibrated: boolean;
  unitOptions: readonly string[];
  onUpdate: (patch: Partial<ReferenceCalibration>) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const [sizeUnit, setSizeUnit] = useState<string>(calibration.known_size_unit || "yards");
  const [displaySize, setDisplaySize] = useState<string>(calibration.known_size_yards?.toString() ?? "");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(() => {
    const match = REF_PRESETS.find(p => p.label === calibration.reference_object_name);
    return match ? match.label : calibration.reference_object_name ? "custom" : null;
  });

  useEffect(() => {
    setDisplaySize(calibration.known_size_yards?.toString() ?? "");
    setSizeUnit(calibration.known_size_unit || "yards");
    const match = REF_PRESETS.find(p => p.label === calibration.reference_object_name);
    setSelectedPreset(match ? match.label : calibration.reference_object_name ? "custom" : null);
  }, [angle]);

  const applyPreset = (preset: { label: string; sizeYards: number } | null) => {
    if (!preset) {
      setSelectedPreset("custom");
      onUpdate({ reference_object_name: "", known_size_yards: null });
      setDisplaySize("");
      return;
    }
    setSelectedPreset(preset.label);
    onUpdate({ reference_object_name: preset.label, known_size_yards: preset.sizeYards, known_size_unit: "yards" });
    setDisplaySize(preset.sizeYards.toString());
    setSizeUnit("yards");
  };

  const handleSizeChange = (raw: string, unit: string) => {
    setDisplaySize(raw);
    const num = parseFloat(raw);
    if (isNaN(num)) {
      onUpdate({ known_size_yards: null, known_size_unit: unit });
      return;
    }
    let yards = num;
    if (unit === "feet") yards = num / 3;
    if (unit === "inches") yards = num / 36;
    onUpdate({ known_size_yards: parseFloat(yards.toFixed(4)), known_size_unit: unit });
  };

  return (
    <div className={CARD_CLASS}>
      {/* Header row */}
      <div className="flex items-center gap-3 cursor-pointer select-none" onClick={onToggleCollapse}>
        <button className="text-on-surface-variant/50 hover:text-on-surface transition-colors shrink-0">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            {isCollapsed ? "chevron_right" : "expand_more"}
          </span>
        </button>
        <h3 className="text-on-surface font-black uppercase tracking-tighter text-lg flex-1">{label}</h3>
        <span className={`text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 ${calibrated ? 'text-primary-container' : 'text-on-surface-variant/50'}`}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{calibrated ? 'check_circle' : 'radio_button_unchecked'}</span>
          {calibrated ? 'Calibrated' : 'Not Calibrated'}
        </span>
      </div>

      {/* Collapsible content */}
      {!isCollapsed && (
        <div className="pt-3 space-y-4">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <label className={LABEL_CLASS}>Reference Object</label>
              <SectionTooltip tip="The physical object placed in frame that the pipeline uses to calculate the pixel-to-yard conversion ratio. Must be clearly visible in the video." />
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {REF_PRESETS.map(p => (
                <button key={p.label} type="button" onClick={() => applyPreset(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border transition-all active:scale-95 ${selectedPreset === p.label ? 'border-primary-container/50 text-primary-container' : 'border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/50'}`}
                  style={selectedPreset === p.label ? { backgroundColor: 'rgba(0,230,57,0.08)' } : { backgroundColor: '#0E1319' }}>
                  {p.label}
                </button>
              ))}
              <button type="button" onClick={() => applyPreset(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border transition-all active:scale-95 ${selectedPreset === 'custom' ? 'border-primary-container/50 text-primary-container' : 'border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/50'}`}
                style={selectedPreset === 'custom' ? { backgroundColor: 'rgba(0,230,57,0.08)' } : { backgroundColor: '#0E1319' }}>
                Custom
              </button>
            </div>
            {(selectedPreset === "custom" || (!selectedPreset && !REF_PRESETS.some(p => p.label === calibration.reference_object_name) && calibration.reference_object_name)) && (
              <input className={INPUT_CLASS} value={calibration.reference_object_name} onChange={(e) => onUpdate({ reference_object_name: e.target.value })} placeholder="Enter custom reference object name" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <label className={LABEL_CLASS}>Known Real-World Size</label>
              <SectionTooltip tip="The exact real-world measurement of the reference object. The pipeline divides the pixel measurement of this object by this value to get pixels-per-yard." />
            </div>
            <div className="flex gap-3">
              <input type="number" step="0.01" className={`${INPUT_CLASS} w-[30%]`} value={displaySize} onChange={(e) => handleSizeChange(e.target.value, sizeUnit)} placeholder="e.g. 5" />
              <select className={`${INPUT_CLASS} w-[25%]`} value={sizeUnit} onChange={(e) => { setSizeUnit(e.target.value); handleSizeChange(displaySize, e.target.value); }}>
                {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <label className={LABEL_CLASS}>Placement Instructions</label>
              <SectionTooltip tip="Instructions shown to athletes in the upload flow explaining where to place this reference object. Be specific — vague instructions produce inconsistent calibration." />
            </div>
            <textarea
              className={`${INPUT_CLASS} min-h-[80px] resize-y`}
              value={calibration.placement_instructions}
              onChange={(e) => onUpdate({ placement_instructions: e.target.value })}
              placeholder="e.g. Place a standard cone at the line of scrimmage, clearly visible in the bottom third of the frame."
            />
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <label className={LABEL_CLASS}>Pixels Per Yard</label>
              <SectionTooltip tip="Auto-calculated from test footage or set manually. This is the exact value the Edge Function uses to convert pixel distances to yards. Higher values = camera is closer to the field." />
            </div>
            <input type="number" step="1" className={INPUT_CLASS} value={calibration.pixels_per_yard ?? ""} onChange={(e) => onUpdate({ pixels_per_yard: e.target.value ? parseFloat(e.target.value) : null })} placeholder="e.g. 142" />
            <p className="text-on-surface-variant/60 text-[10px] mt-1.5">Measure from a test clip: count pixels across your reference object, divide by its known size in yards.</p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <label className={LABEL_CLASS}>Athlete Filming Instructions</label>
              <SectionTooltip tip="Shown to athletes in the upload flow before they film from this angle. Explain camera position, distance, and what must be visible in frame." />
            </div>
            <textarea
              className={`${INPUT_CLASS} min-h-[100px] resize-y`}
              value={calibration.filming_instructions ?? ""}
              onChange={(e) => onUpdate({ filming_instructions: e.target.value })}
              placeholder="e.g. Film from the sideline at least 10 yards away at waist height. The full route and reference object must be visible throughout the rep."
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* CameraEditor moved to CameraEditor.tsx */

/* ── Scoring Editor ── */

interface ScoringEditorProps {
  scoringRules: string;
  onScoringRulesChange: (v: string) => void;
  metrics: KeyMetric[];
  confidenceHandling: ConfidenceHandling;
  onConfidenceHandlingChange: (v: ConfidenceHandling) => void;
  minMetricsThreshold: number;
  onMinMetricsThresholdChange: (v: number) => void;
  scoreBands: ScoreBands;
  onScoreBandsChange: (v: ScoreBands) => void;
  renormalizeOnSkip: boolean;
  onRenormalizeOnSkipChange: (v: boolean) => void;
}

function ScoringEditor({ scoringRules, onScoringRulesChange, metrics, confidenceHandling, onConfidenceHandlingChange, minMetricsThreshold, onMinMetricsThresholdChange, scoreBands, onScoreBandsChange, renormalizeOnSkip, onRenormalizeOnSkipChange }: ScoringEditorProps) {
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

  const flaggedCount = Math.ceil(metrics.length * minMetricsThreshold / 100);

  const CONFIDENCE_OPTIONS: { value: ConfidenceHandling; label: string; recommended?: boolean; description: string }[] = [
    { value: "skip", label: "SKIP", recommended: true, description: "Exclude low-confidence metrics from the aggregate score and redistribute their weight proportionally across remaining metrics. Produces the most accurate score from available data." },
    { value: "penalize", label: "PENALIZE", description: "Score low-confidence metrics at 0. More punishing — use when filming conditions are controlled and low confidence indicates athlete error." },
    { value: "flag_only", label: "FLAG ONLY", description: "Score normally but mark the metric as low confidence in athlete results. Use for informational nodes where score accuracy is less critical." },
  ];

  const BAND_ROWS: { key: keyof ScoreBands; rangeLabel: string }[] = [
    { key: "elite", rangeLabel: "90 — 100" },
    { key: "varsity", rangeLabel: "75 — 89" },
    { key: "developing", rangeLabel: "60 — 74" },
    { key: "needs_work", rangeLabel: "Below 60" },
  ];

  return (
    <div className="space-y-6">
      {/* Scoring Formula Description */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <label className={LABEL_CLASS}>Scoring Formula Description</label>
          <SectionTooltip tip="Describe how the overall Route Mastery Score is calculated from individual metrics. The AI uses this to explain scores to athletes." />
        </div>
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
            <SectionTooltip tip="Shows how each metric's weight contributes to the overall Mastery Score. Weights are set in the Metrics tab and must total 100%." />
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

      {/* ── SECTION 1: Confidence Handling ── */}
      <div className="pt-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-outline-variant/20" />
          <span className={`${LABEL_CLASS} shrink-0`}>Confidence Handling</span>
          <div className="h-px flex-1 bg-outline-variant/20" />
        </div>
      </div>

      <div className={CARD_CLASS + " space-y-4"}>
        <div className="flex items-center gap-1.5">
          <h4 className={`${LABEL_CLASS} flex items-center gap-2`}>
            <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 16 }}>shield</span>
            Low Confidence Handling
          </h4>
          <SectionTooltip tip="What happens when a metric's keypoints fall below its confidence threshold during analysis. This is a node-level setting that applies to all metrics." />
        </div>

        <div className="space-y-3">
          {CONFIDENCE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${confidenceHandling === opt.value ? "border-primary-container/40 bg-primary-container/5" : "border-outline-variant/15 hover:border-outline-variant/30"}`}
              style={{ backgroundColor: confidenceHandling === opt.value ? undefined : '#0E1319' }}
            >
              <div className="mt-0.5 shrink-0">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${confidenceHandling === opt.value ? "border-primary-container" : "border-outline-variant/40"}`}
                >
                  {confidenceHandling === opt.value && (
                    <div className="w-2 h-2 rounded-full bg-primary-container" />
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-on-surface text-xs font-black uppercase tracking-[0.15em]">{opt.label}</span>
                  {opt.recommended && (
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-primary-container bg-primary-container/10 px-2 py-0.5 rounded-full">Recommended</span>
                  )}
                </div>
                <p className="text-on-surface-variant text-xs mt-1 leading-relaxed">{opt.description}</p>
              </div>
              <input
                type="radio"
                className="sr-only"
                name="confidence_handling"
                value={opt.value}
                checked={confidenceHandling === opt.value}
                onChange={() => onConfidenceHandlingChange(opt.value)}
              />
            </label>
          ))}
        </div>
      </div>

      {/* ── SECTION 2: Minimum Metrics Threshold ── */}
      <div className={CARD_CLASS + " space-y-4"}>
        <div className="flex items-center gap-1.5">
          <h4 className={`${LABEL_CLASS} flex items-center gap-2`}>
            <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 16 }}>block</span>
            Minimum Metrics Threshold
          </h4>
          <SectionTooltip tip="If more than this percentage of metrics are flagged as low confidence, the entire analysis is rejected and the athlete is asked to refilm. Prevents meaningless Mastery Scores from poor footage." />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-on-surface-variant text-xs whitespace-nowrap">Reject analysis if more than</span>
          <input
            type="number"
            min={0}
            max={100}
            className={`${INPUT_CLASS} w-20 text-center font-bold`}
            value={minMetricsThreshold}
            onChange={(e) => onMinMetricsThresholdChange(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
          />
          <span className="text-on-surface-variant text-xs whitespace-nowrap">% of metrics are low confidence</span>
        </div>

        {metrics.length > 0 && (
          <p className="text-on-surface-variant/70 text-xs leading-relaxed">
            With <span className="text-on-surface font-semibold">{metrics.length}</span> metrics configured, analysis is rejected if <span className="text-on-surface font-semibold">{flaggedCount}</span> or more metrics are flagged.
          </p>
        )}
      </div>

      {/* ── SECTION 2.5: Renormalize Weights on Skip ── */}
      <div className={CARD_CLASS + " space-y-4"}>
        <div className="flex items-center gap-1.5">
          <h4 className={`${LABEL_CLASS} flex items-center gap-2`}>
            <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 16 }}>tune</span>
            Renormalize Weights on Skip
          </h4>
          <SectionTooltip tip="When metrics are excluded from analysis (e.g. Catch Efficiency and YAC Burst when athlete reports no catch), this setting controls how the aggregate Mastery Score is calculated.\n\nON: Excluded metric weights are redistributed proportionally to remaining metrics. Score always totals out of 100.\n\nOFF: Aggregate score is capped at the total weight of included metrics. e.g. if 25% weight is excluded, maximum score is 75." />
        </div>

        <button
          type="button"
          onClick={() => onRenormalizeOnSkipChange(!renormalizeOnSkip)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${renormalizeOnSkip ? "bg-primary-container" : "bg-outline-variant/40"}`}
        >
          <span className={`pointer-events-none block h-5 w-5 rounded-full bg-surface shadow-lg ring-0 transition-transform ${renormalizeOnSkip ? "translate-x-5" : "translate-x-0"}`} />
        </button>

        {renormalizeOnSkip ? (
          <p className="text-on-surface-variant/70 text-xs leading-relaxed">
            Score always out of 100 — excluded metric weights redistributed proportionally
          </p>
        ) : (
          (() => {
            const catchWeight = metrics.filter(m => m.requires_catch).reduce((s, m) => s + m.weight, 0);
            const cappedAt = 100 - catchWeight;
            return (
              <p className="text-amber-400 text-xs leading-relaxed flex items-center gap-1.5">
                <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14 }}>warning</span>
                Score capped at {cappedAt}% when catch metrics excluded — athletes cannot achieve 100 on incomplete reps
              </p>
            );
          })()
        )}
      </div>

      {/* ── SECTION 3: Score Bands ── */}
      <div className="pt-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-outline-variant/20" />
          <span className={`${LABEL_CLASS} shrink-0`}>Score Bands</span>
          <div className="h-px flex-1 bg-outline-variant/20" />
        </div>
      </div>

      <div className={CARD_CLASS + " space-y-4"}>
        <div className="flex items-center gap-1.5">
          <h4 className={`${LABEL_CLASS} flex items-center gap-2`}>
            <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 16 }}>label</span>
            Score Band Labels
          </h4>
          <SectionTooltip tip="Labels shown to athletes alongside their Mastery Score. Also used by the AI feedback system to frame results." />
        </div>

        <div className="space-y-2">
          {BAND_ROWS.map((band) => (
            <div key={band.key} className="flex items-center gap-4 p-3 rounded-xl border border-outline-variant/15" style={{ backgroundColor: '#0E1319' }}>
              <span className="text-on-surface-variant text-xs font-semibold w-24 shrink-0 tabular-nums">{band.rangeLabel}</span>
              <input
                className={`${INPUT_CLASS} flex-1`}
                value={scoreBands[band.key]}
                onChange={(e) => onScoreBandsChange({ ...scoreBands, [band.key]: e.target.value })}
                placeholder="Label"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Scoring Preview Simulator */}
      {metrics.length > 0 && weightValid && (
        <div className={CARD_CLASS + " space-y-4"}>
          <h4 className={`${LABEL_CLASS} flex items-center gap-2`}>
            <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 16 }}>calculate</span>
            Scoring Preview Simulator
            <SectionTooltip tip="Enter sample scores (0–100) for each metric to preview the calculated Mastery Score and its band label." />
          </h4>

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
              <div className="text-on-surface font-black uppercase tracking-tighter text-lg flex items-center gap-1.5">Simulated Score <SectionTooltip tip="This simulated score uses the weighted average formula that the live pipeline applies. Adjust individual metric scores above to see how each one affects the final Mastery Score. The score band label updates automatically based on your configured Score Band Labels above." /></div>
              <p className="text-on-surface-variant text-xs">
                Based on weighted average of {metrics.length} metrics
                {simulatedScore !== null && (
                  <span className="ml-2 text-primary-container font-semibold">
                    — {simulatedScore >= 90 ? scoreBands.elite : simulatedScore >= 75 ? scoreBands.varsity : simulatedScore >= 60 ? scoreBands.developing : scoreBands.needs_work}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
