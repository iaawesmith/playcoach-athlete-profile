import { useState, useMemo, useCallback } from "react";
import type { Checkpoint, PhaseNote, PhaseTransitionRole } from "../types";
import { SectionTooltip } from "./SectionTooltip";
import keypointLibrary from "@/constants/keypointLibrary.json";

const INPUT_CLASS = "w-full border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface text-sm placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-container/70 focus:ring-2 focus:ring-primary-container/30 focus:shadow-[0_0_8px_rgba(0,230,57,0.15)] transition-all bg-[#0E1319]";
const LABEL_CLASS = "text-on-surface-variant text-[10px] font-medium uppercase tracking-widest";
const CARD_CLASS = "p-5 rounded-xl border border-outline-variant/20 space-y-3 bg-[#1A2029]";

type ConfirmDeleteFn = (opts: { title: string; body: string; confirmLabel: string; onConfirm: () => void }) => void;

const GROUP_NAMES: Record<string, string> = { body: "BODY", feet: "FEET", hands: "HANDS", face: "FACE" };
const ALL_GROUPS = ["body", "feet", "hands", "face"];

const TRANSITION_OPTIONS: { value: PhaseTransitionRole; label: string; desc: string }[] = [
  { value: "marks_start", label: "Marks Phase Start", desc: "This checkpoint firing marks the beginning of its assigned phase." },
  { value: "marks_end", label: "Marks Phase End", desc: "This checkpoint firing marks the end of its assigned phase." },
  { value: "informational", label: "Informational Only", desc: "Does not affect phase boundaries. Used for event detection and LLM context only." },
];

function newCheckpoint(order: number): Checkpoint {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    phase_id: null,
    phase_transition_role: "informational",
    trigger_condition: "",
    required_keypoint_indices: [],
    confidence_threshold: 0.75,
    priority: 1,
    sequence_order: order,
  };
}

/** Migrate legacy string[] checkpoints to Checkpoint[] */
export function migrateCheckpoints(raw: unknown): Checkpoint[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length === 0) return [];
  // If first element is a string, migrate
  if (typeof raw[0] === "string") {
    return (raw as string[]).map((s, i) => ({
      ...newCheckpoint(i),
      name: s,
    }));
  }
  // Already structured
  return raw as Checkpoint[];
}

interface CheckpointsEditorProps {
  checkpoints: Checkpoint[];
  onChange: (c: Checkpoint[]) => void;
  onConfirmDelete: ConfirmDeleteFn;
  phases: PhaseNote[];
  segmentationMethod: string;
}

export function CheckpointsEditor({ checkpoints, onChange, onConfirmDelete, phases, segmentationMethod }: CheckpointsEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, Checkpoint>>({});
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const isCheckpointMode = segmentationMethod === "checkpoint";

  const sorted = useMemo(() =>
    [...checkpoints].sort((a, b) => a.sequence_order - b.sequence_order),
    [checkpoints]
  );

  const addCheckpoint = () => {
    const cp = newCheckpoint(checkpoints.length);
    const next = [...checkpoints, cp];
    onChange(next);
    setExpandedId(cp.id);
    setEditDrafts(prev => ({ ...prev, [cp.id]: cp }));
  };

  const startEdit = (cp: Checkpoint) => {
    setExpandedId(cp.id);
    setEditDrafts(prev => ({ ...prev, [cp.id]: { ...cp } }));
  };

  const saveDraft = (id: string) => {
    const d = editDrafts[id];
    if (!d) return;
    const next = checkpoints.map(c => c.id === id ? d : c);
    onChange(next);
    setExpandedId(null);
  };

  const cancelEdit = (id: string) => {
    setExpandedId(null);
    // If it's a brand new unsaved checkpoint (name empty), remove it
    const original = checkpoints.find(c => c.id === id);
    if (original && !original.name.trim()) {
      onChange(checkpoints.filter(c => c.id !== id));
    }
  };

  const updateDraft = (id: string, partial: Partial<Checkpoint>) => {
    setEditDrafts(prev => ({ ...prev, [id]: { ...(prev[id] || checkpoints.find(c => c.id === id)!), ...partial } }));
  };

  const deleteCheckpoint = (cp: Checkpoint, idx: number) => {
    onConfirmDelete({
      title: "Delete Checkpoint?",
      body: `Deleting "${cp.name || `Checkpoint ${idx + 1}`}" will remove it permanently. This cannot be undone.`,
      confirmLabel: "Delete Checkpoint",
      onConfirm: () => {
        onChange(checkpoints.filter(c => c.id !== cp.id));
        if (expandedId === cp.id) setExpandedId(null);
      },
    });
  };

  /* Drag reorder */
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    const updated = reordered.map((cp, i) => ({ ...cp, sequence_order: i }));
    onChange(updated);
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  const phaseName = (phaseId: string | null) => {
    if (!phaseId) return null;
    return phases.find(p => p.id === phaseId)?.phase || null;
  };

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-outline-variant/10 bg-surface-container">
        <span className="material-symbols-outlined text-on-surface-variant/60 mt-0.5" style={{ fontSize: 16 }}>info</span>
        <p className="text-on-surface-variant text-xs leading-relaxed">
          Checkpoints are only evaluated when Segmentation Method = Checkpoint-triggered. If using Proportional segmentation, this tab is informational only.
        </p>
      </div>

      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={addCheckpoint}
          className="px-4 py-2 rounded-lg bg-primary-container/20 text-primary-container text-xs font-bold uppercase tracking-widest border border-primary-container/30 hover:bg-primary-container/30 active:scale-95 transition-all flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          Add Checkpoint
        </button>
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <span className="material-symbols-outlined text-on-surface-variant/20" style={{ fontSize: 48 }}>flag</span>
          <p className="text-on-surface font-bold text-sm uppercase tracking-wide">No checkpoints defined</p>
          <p className="text-on-surface-variant text-xs text-center max-w-sm leading-relaxed">
            Checkpoints are required when Segmentation Method is set to Checkpoint-triggered. If using Proportional segmentation, checkpoints are optional and used for event detection only.
          </p>
          <button
            onClick={addCheckpoint}
            className="mt-2 px-5 py-2.5 rounded-lg bg-primary-container/20 text-primary-container text-xs font-bold uppercase tracking-widest border border-primary-container/30 hover:bg-primary-container/30 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            Add Checkpoint
          </button>
        </div>
      )}

      {/* Checkpoint cards */}
      {sorted.map((cp, idx) => {
        const isExpanded = expandedId === cp.id;
        const draft = editDrafts[cp.id] || cp;
        const linkedPhase = phaseName(cp.phase_id);
        const phaseDeleted = cp.phase_id && !linkedPhase;

        return (
          <div
            key={cp.id}
            className={`${CARD_CLASS} ${dragIdx === idx ? "opacity-50" : ""} ${isExpanded ? "border-primary-container/20" : ""}`}
            draggable={!isExpanded}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
          >
            {!isExpanded ? (
              /* ── Collapsed ── */
              <div className="flex items-center gap-3 group">
                {/* Drag handle */}
                <span className="material-symbols-outlined text-on-surface-variant/20 cursor-grab shrink-0" style={{ fontSize: 16 }}>drag_indicator</span>
                <span className="text-on-surface-variant/30 text-[10px] font-mono font-semibold w-4 text-center shrink-0">{idx + 1}</span>
                <span className="text-on-surface text-sm font-semibold truncate flex-1 min-w-0">{cp.name || "Untitled Checkpoint"}</span>

                {/* Phase pill */}
                {linkedPhase && (
                  <span className="px-2 py-0.5 rounded-full bg-primary-container/10 text-primary-container text-[9px] font-bold uppercase tracking-widest border border-primary-container/20 shrink-0">
                    {linkedPhase}
                  </span>
                )}
                {phaseDeleted && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[9px] font-bold uppercase tracking-widest border border-amber-500/20 shrink-0">
                    Phase Deleted
                  </span>
                )}

                {/* Priority badge */}
                <span className="px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant text-[9px] font-bold shrink-0">
                  P{cp.priority}
                </span>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => startEdit(cp)} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary-container transition-colors" style={{ backgroundColor: '#111720' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                  </button>
                  <button onClick={() => deleteCheckpoint(cp, idx)} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-red-400 transition-colors" style={{ backgroundColor: '#111720' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                  </button>
                </div>
              </div>
            ) : (
              /* ── Expanded ── */
              <CheckpointEditForm
                draft={draft}
                onChange={(partial) => updateDraft(cp.id, partial)}
                onSave={() => saveDraft(cp.id)}
                onCancel={() => cancelEdit(cp.id)}
                phases={phases}
                idx={idx}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Edit Form ── */
function CheckpointEditForm({ draft, onChange, onSave, onCancel, phases, idx }: {
  draft: Checkpoint;
  onChange: (partial: Partial<Checkpoint>) => void;
  onSave: () => void;
  onCancel: () => void;
  phases: PhaseNote[];
  idx: number;
}) {
  const [activeGroupTab, setActiveGroupTab] = useState<string>("body");

  const keypoints = keypointLibrary.keypoints as Array<{
    index: number; name: string; group: string; sub_group: string; side: string; football_use: string | null;
  }>;
  const subGroupOrder = keypointLibrary.sub_group_order as Record<string, string[]>;
  const subGroupDisplayNames = keypointLibrary.sub_group_display_names as Record<string, string>;

  const tabKeypoints = useMemo(() =>
    keypoints.filter(kp => kp.group === activeGroupTab),
    [activeGroupTab, keypoints]
  );

  const groupedTabKeypoints = useMemo(() => {
    const order = subGroupOrder[activeGroupTab] || [];
    const groups: Record<string, typeof keypoints> = {};
    for (const kp of tabKeypoints) {
      if (!groups[kp.sub_group]) groups[kp.sub_group] = [];
      groups[kp.sub_group].push(kp);
    }
    return order.map(sg => ({ subGroup: sg, displayName: subGroupDisplayNames[sg] || sg, keypoints: groups[sg] || [] })).filter(g => g.keypoints.length > 0);
  }, [tabKeypoints, activeGroupTab, subGroupOrder, subGroupDisplayNames]);

  const toggleKeypoint = useCallback((idx: number) => {
    const cur = draft.required_keypoint_indices;
    const next = cur.includes(idx) ? cur.filter(x => x !== idx) : [...cur, idx];
    onChange({ required_keypoint_indices: next });
  }, [draft.required_keypoint_indices, onChange]);

  const removeKeypoint = useCallback((idx: number) => {
    onChange({ required_keypoint_indices: draft.required_keypoint_indices.filter(x => x !== idx) });
  }, [draft.required_keypoint_indices, onChange]);

  const linkedPhase = phases.find(p => p.id === draft.phase_id);
  const phaseDeleted = draft.phase_id && !linkedPhase;

  const confidenceColor = draft.confidence_threshold >= 0.70
    ? "text-primary-container"
    : draft.confidence_threshold >= 0.60
      ? "text-amber-400"
      : "text-red-400";

  return (
    <div className="space-y-4">
      <span className="text-on-surface text-xs font-bold uppercase tracking-widest">Checkpoint {idx + 1}</span>

      {/* Name */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <label className={LABEL_CLASS}>Checkpoint Name</label>
          <SectionTooltip tip="Short scannable name for this checkpoint. e.g. 'Plant Foot Strike', 'Head Snap Moment', 'Catch Extension'." />
        </div>
        <input className={INPUT_CLASS} value={draft.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="e.g. Plant Foot Strike" />
      </div>

      {/* Description */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <label className={LABEL_CLASS}>Description</label>
          <SectionTooltip tip="What this checkpoint is detecting and why it matters for the movement. Used as LLM context when this checkpoint fires." />
        </div>
        <textarea className={`${INPUT_CLASS} min-h-[70px] resize-y`} value={draft.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="e.g. The moment the plant foot heel contacts the ground at the break point. This marks the exact start of the cutting motion." />
      </div>

      {/* Phase */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <label className={LABEL_CLASS}>Phase</label>
          <SectionTooltip tip="Which phase this checkpoint is evaluated within. The pipeline only looks for this checkpoint's trigger condition within the assigned phase frame window." />
        </div>
        {phaseDeleted && (
          <div className="flex items-start gap-2 px-3 py-2 mb-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <span className="material-symbols-outlined text-amber-400 mt-0.5" style={{ fontSize: 16 }}>warning</span>
            <p className="text-amber-300 text-xs leading-snug">Linked phase was deleted — reassign this checkpoint.</p>
          </div>
        )}
        <select
          className={INPUT_CLASS + " max-w-xs"}
          value={draft.phase_id ?? ""}
          onChange={(e) => onChange({ phase_id: e.target.value || null })}
          disabled={phases.length === 0}
        >
          {phases.length === 0 ? (
            <option value="">Define phases in Phases tab first</option>
          ) : (
            <>
              <option value="">Select a phase…</option>
              {phases.filter(p => p.id && p.phase.trim()).map(p => (
                <option key={p.id} value={p.id!}>{p.phase}</option>
              ))}
            </>
          )}
        </select>
      </div>

      {/* Phase Transition Role */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <label className={LABEL_CLASS}>Phase Transition Role</label>
          <SectionTooltip tip="Only relevant when Segmentation Method = Checkpoint-triggered in Phases tab. Informational checkpoints fire and log the event but do not split phases." />
        </div>
        <div className="space-y-2">
          {TRANSITION_OPTIONS.map(opt => (
            <label key={opt.value} className="flex items-start gap-2.5 cursor-pointer group">
              <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                draft.phase_transition_role === opt.value ? "border-primary-container" : "border-outline-variant/40"
              }`}>
                {draft.phase_transition_role === opt.value && <div className="w-2 h-2 rounded-full bg-primary-container" />}
              </div>
              <div>
                <span className="text-on-surface text-xs font-bold uppercase tracking-widest">{opt.label}</span>
                <p className="text-on-surface-variant/50 text-[10px] mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Trigger Condition */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <label className={LABEL_CLASS}>Trigger Condition</label>
          <SectionTooltip tip="The body position event that fires this checkpoint. Describe in terms of keypoint relationships. The Edge Function evaluates this condition frame-by-frame within the assigned phase." />
        </div>
        <input className={INPUT_CLASS} value={draft.trigger_condition} onChange={(e) => onChange({ trigger_condition: e.target.value })} placeholder="e.g. Left Heel (19) Y-coordinate reaches minimum value" />
        <p className="text-on-surface-variant/40 text-[10px] mt-1.5 leading-relaxed">
          Format examples: [Keypoint] Y-coordinate minimum (foot plant) · Angle at [vertex] &lt; X° · Distance between [kpt1] and [kpt2] &lt; X yards · [Keypoint] velocity &gt; X mph
        </p>
      </div>

      {/* Required Keypoints */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <label className={LABEL_CLASS}>Required Keypoints</label>
          <SectionTooltip tip="Which keypoints must be above the confidence threshold for this checkpoint to be considered valid. If any required keypoint falls below threshold, the checkpoint is flagged as undetectable for that frame." />
        </div>

        {/* Group tabs */}
        <div className="flex gap-1 mb-3">
          {ALL_GROUPS.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setActiveGroupTab(g)}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
                activeGroupTab === g
                  ? "bg-surface-container-highest text-on-surface"
                  : "text-on-surface-variant/40 hover:text-on-surface-variant"
              }`}
            >
              {GROUP_NAMES[g]}
            </button>
          ))}
        </div>

        {/* Chips */}
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
          {groupedTabKeypoints.map(({ subGroup, displayName, keypoints: sgKps }) => (
            <div key={subGroup}>
              <p className="text-on-surface-variant/40 text-[9px] font-semibold uppercase tracking-widest mb-1.5">{displayName}</p>
              <div className="flex flex-wrap gap-1.5">
                {sgKps.map(kp => {
                  const selected = draft.required_keypoint_indices.includes(kp.index);
                  return (
                    <button
                      key={kp.index}
                      type="button"
                      onClick={() => toggleKeypoint(kp.index)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                        selected
                          ? "bg-primary-container/20 text-primary-container border border-primary-container/30"
                          : "bg-surface-container text-on-surface-variant/60 border border-outline-variant/10 hover:border-outline-variant/30"
                      }`}
                    >
                      {kp.name} ({kp.index})
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Selected summary */}
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <p className="text-on-surface-variant/50 text-[10px] font-semibold uppercase tracking-widest mb-1.5">
            Selected: {draft.required_keypoint_indices.length} keypoints
          </p>
          {draft.required_keypoint_indices.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {draft.required_keypoint_indices.map(kpIdx => {
                const kp = keypoints.find(k => k.index === kpIdx);
                return (
                  <span key={kpIdx} className="px-2 py-0.5 rounded-lg bg-primary-container/10 text-primary-container text-[10px] font-medium flex items-center gap-1 border border-primary-container/20">
                    {kp?.name || kpIdx} ({kpIdx})
                    <button type="button" onClick={() => removeKeypoint(kpIdx)} className="hover:text-red-400 transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: 10 }}>close</span>
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confidence Threshold */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <label className={LABEL_CLASS}>Confidence Threshold</label>
          <SectionTooltip tip="Minimum rtmlib confidence score for required keypoints. Checkpoints use 0.75 default (higher than metrics) because they are binary pass/fail events — a low-confidence detection produces an unreliable phase boundary." />
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={draft.confidence_threshold}
            onChange={(e) => onChange({ confidence_threshold: parseFloat(e.target.value) })}
            className="flex-1 accent-primary-container"
          />
          <span className={`text-sm font-bold tabular-nums w-12 text-right ${confidenceColor}`}>
            {draft.confidence_threshold.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Priority */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <label className={LABEL_CLASS}>Priority</label>
          <SectionTooltip tip="If two checkpoints fire on the same frame, lower priority number wins. Priority 1 = highest priority. Use when two checkpoints could logically fire simultaneously." />
        </div>
        <input type="number" min="1" step="1" className={INPUT_CLASS + " max-w-[120px]"} value={draft.priority} onChange={(e) => onChange({ priority: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
        <p className="text-on-surface-variant/40 text-[10px] mt-1.5">Lower number = higher priority. Priority 1 always evaluated first.</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button onClick={onSave} className="px-4 py-2 rounded-lg bg-primary-container text-surface text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">Save</button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors" style={{ backgroundColor: '#1A2029' }}>Cancel</button>
      </div>
    </div>
  );
}

/* ── Completeness check ── */
export function checkCheckpointCompleteness(segmentationMethod: string, checkpoints: Checkpoint[]): Array<{ label: string; detail: string }> {
  if (segmentationMethod === "checkpoint" && checkpoints.length === 0) {
    return [{ label: "Checkpoints", detail: "Checkpoint-triggered segmentation selected but no checkpoints defined. Add checkpoints or switch to Proportional segmentation in Phases tab." }];
  }
  return [];
}
