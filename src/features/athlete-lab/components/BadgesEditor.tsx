import { useState, useRef } from "react";
import type { Badge, KeyMetric } from "../types";
import { SectionTooltip } from "./SectionTooltip";

const INPUT_CLASS = "w-full border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface text-sm placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-container/70 focus:ring-2 focus:ring-primary-container/30 focus:shadow-[0_0_8px_rgba(0,230,57,0.15)] transition-all bg-[#0E1319]";
const LABEL_CLASS = "text-on-surface-variant text-[10px] font-medium uppercase tracking-widest";
const CARD_CLASS = "p-5 rounded-xl border border-outline-variant/20 space-y-3 bg-[#1A2029]";

type ConfirmDeleteFn = (opts: { title: string; body: string; confirmLabel: string; onConfirm: () => void }) => void;

type BadgeRarity = "common" | "rare" | "epic" | "legendary";
type ConditionType = "score" | "metric" | "streak" | "custom";

const RARITY_COLORS: Record<BadgeRarity, { bg: string; text: string; border: string }> = {
  common: { bg: "bg-[#333840]", text: "text-[#a8abaf]", border: "border-[#44484c]" },
  rare: { bg: "bg-[#1a2940]", text: "text-[#60a5fa]", border: "border-[#2563eb]/30" },
  epic: { bg: "bg-[#2a1a40]", text: "text-[#a78bfa]", border: "border-[#7c3aed]/30" },
  legendary: { bg: "bg-[#3a2a10]", text: "text-[#fbbf24]", border: "border-[#d97706]/30" },
};

const EMOJI_OPTIONS = ["🏆", "⭐", "🔥", "💎", "🎯", "⚡", "🏅", "👑", "💪", "🚀", "🎖️", "✨", "🏈", "🏃", "🦅", "🐐"];

function newBadge(): Badge {
  return {
    id: crypto.randomUUID(),
    name: "",
    icon: "🏆",
    description: "",
    rarity: "common",
    condition: "",
    condition_type: "score",
    condition_operator: ">=",
    condition_threshold: 90,
    condition_metric_id: null,
    condition_count: 1,
    condition_custom: null,
    sequence_order: 0,
  };
}

/** Migrate old {name,condition} badges to new shape */
export function migrateBadges(raw: unknown[]): Badge[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((b: any, i) => ({
    id: b.id || crypto.randomUUID(),
    name: b.name || "",
    icon: b.icon || "🏆",
    description: b.description || "",
    rarity: b.rarity || "common",
    condition: b.condition || "",
    condition_type: b.condition_type || "custom",
    condition_operator: b.condition_operator || ">=",
    condition_threshold: b.condition_threshold ?? 90,
    condition_metric_id: b.condition_metric_id ?? null,
    condition_count: b.condition_count ?? 1,
    condition_custom: b.condition_custom ?? (b.condition || null),
    sequence_order: b.sequence_order ?? i,
  }));
}

interface Props {
  badges: Badge[];
  keyMetrics: KeyMetric[];
  onChange: (b: Badge[]) => void;
  onConfirmDelete: ConfirmDeleteFn;
}

export function BadgesEditor({ badges, keyMetrics, onChange, onConfirmDelete }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Badge>(newBadge());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editEmojiPicker, setEditEmojiPicker] = useState(false);
  const dragIdx = useRef<number | null>(null);

  const toggle = (i: number) => setExpandedIdx(expandedIdx === i ? null : i);

  const updateBadge = (i: number, patch: Partial<Badge>) => {
    const n = [...badges];
    n[i] = { ...n[i], ...patch };
    onChange(n);
  };

  const handleAdd = () => {
    const b = { ...draft, sequence_order: badges.length };
    onChange([...badges, b]);
    setDraft(newBadge());
    setAdding(false);
    setExpandedIdx(badges.length);
  };

  const handleDragStart = (i: number) => { dragIdx.current = i; };
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === i) return;
    const n = [...badges];
    const [moved] = n.splice(dragIdx.current, 1);
    n.splice(i, 0, moved);
    n.forEach((b, idx) => b.sequence_order = idx);
    dragIdx.current = i;
    onChange(n);
    if (expandedIdx === dragIdx.current) setExpandedIdx(i);
  };

  const rarityLabel = (r: string) => (r || "common").charAt(0).toUpperCase() + (r || "common").slice(1);

  const conditionPreview = (b: Badge) => {
    const op = b.condition_operator || ">=";
    const th = b.condition_threshold ?? 90;
    const cnt = b.condition_count ?? 1;
    if (b.condition_type === "score") return `Mastery Score ${op} ${th} on ${cnt} analysis${cnt > 1 ? "es" : ""}`;
    if (b.condition_type === "metric") {
      const m = keyMetrics.find((_m, idx) => _m.name === b.condition_metric_id || idx.toString() === b.condition_metric_id);
      const metricName = m?.name || b.condition_metric_id || "—";
      return `${metricName} ${op} ${th} on ${cnt} analysis${cnt > 1 ? "es" : ""}`;
    }
    if (b.condition_type === "streak") return `Mastery Score ${op} ${th} on ${cnt} consecutive analysis${cnt > 1 ? "es" : ""} in a row`;
    return b.condition_custom || b.condition || "Custom condition";
  };

  const renderConditionFields = (b: Badge, setB: (patch: Partial<Badge>) => void) => {
    const opSelect = (
      <select className={INPUT_CLASS + " !w-20 !px-2 text-center"} value={b.condition_operator || ">="} onChange={(e) => setB({ condition_operator: e.target.value })}>
        <option value=">=">≥</option>
        <option value=">">{">"}</option>
        <option value="=">＝</option>
        <option value="<=">≤</option>
      </select>
    );

    if (b.condition_type === "score") return (
      <div className="space-y-3">
        <div className={`${LABEL_CLASS} mb-2 flex items-center gap-1.5`}>
          Score Threshold
          <SectionTooltip tip="Unlock when the overall Mastery Score reaches or exceeds this value." />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-on-surface-variant text-xs">Unlock when Mastery Score is</span>
          {opSelect}
          <input type="number" className={INPUT_CLASS + " !w-20 !px-2 text-center"} value={b.condition_threshold ?? 90} onChange={(e) => setB({ condition_threshold: Number(e.target.value) })} min={0} max={100} />
          <span className="text-on-surface-variant text-xs">on</span>
          <input type="number" className={INPUT_CLASS + " !w-16 !px-2 text-center"} value={b.condition_count ?? 1} onChange={(e) => setB({ condition_count: Math.max(1, Number(e.target.value)) })} min={1} />
          <span className="text-on-surface-variant text-xs">consecutive analysis{(b.condition_count ?? 1) > 1 ? "es" : ""}</span>
        </div>
        <p className="text-on-surface-variant/50 text-[11px] italic">
          Unlocks when Mastery Score {b.condition_operator || ">="} {b.condition_threshold ?? 90} on {b.condition_count ?? 1} consecutive analysis{(b.condition_count ?? 1) > 1 ? "es" : ""}
        </p>
      </div>
    );

    if (b.condition_type === "metric") return (
      <div className="space-y-3">
        <div className={`${LABEL_CLASS} mb-2 flex items-center gap-1.5`}>
          Metric Condition
          <SectionTooltip tip="Unlock when a specific metric value reaches the target threshold." />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className={INPUT_CLASS + " !w-48"} value={b.condition_metric_id || ""} onChange={(e) => setB({ condition_metric_id: e.target.value || null })}>
            <option value="">Select metric…</option>
            {keyMetrics.map((m, idx) => <option key={idx} value={m.name}>{m.name || `Metric ${idx + 1}`}</option>)}
          </select>
          {opSelect}
          <input type="number" className={INPUT_CLASS + " !w-20 !px-2 text-center"} value={b.condition_threshold ?? 0} onChange={(e) => setB({ condition_threshold: Number(e.target.value) })} />
          <span className="text-on-surface-variant text-xs">on</span>
          <input type="number" className={INPUT_CLASS + " !w-16 !px-2 text-center"} value={b.condition_count ?? 1} onChange={(e) => setB({ condition_count: Math.max(1, Number(e.target.value)) })} min={1} />
          <span className="text-on-surface-variant text-xs">analysis{(b.condition_count ?? 1) > 1 ? "es" : ""}</span>
        </div>
        {b.condition_metric_id && (
          <p className="text-on-surface-variant/50 text-[11px] italic">
            Unlocks when {b.condition_metric_id} {b.condition_operator || ">="} {b.condition_threshold ?? 0} on {b.condition_count ?? 1} analysis{(b.condition_count ?? 1) > 1 ? "es" : ""}
          </p>
        )}
      </div>
    );

    if (b.condition_type === "streak") return (
      <div className="space-y-3">
        <div className={`${LABEL_CLASS} mb-2 flex items-center gap-1.5`}>
          Streak Condition
          <SectionTooltip tip="Unlock when the condition is met on multiple consecutive analyses in a row." />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-on-surface-variant text-xs">Unlock when Mastery Score is</span>
          {opSelect}
          <input type="number" className={INPUT_CLASS + " !w-20 !px-2 text-center"} value={b.condition_threshold ?? 80} onChange={(e) => setB({ condition_threshold: Number(e.target.value) })} min={0} max={100} />
          <span className="text-on-surface-variant text-xs">on</span>
          <input type="number" className={INPUT_CLASS + " !w-16 !px-2 text-center"} value={b.condition_count ?? 5} onChange={(e) => setB({ condition_count: Math.max(1, Number(e.target.value)) })} min={1} />
          <span className="text-on-surface-variant text-xs">consecutive analyses in a row</span>
        </div>
        <p className="text-on-surface-variant/50 text-[11px] italic">
          Unlocks when Mastery Score {b.condition_operator || ">="} {b.condition_threshold ?? 80} on {b.condition_count ?? 5} consecutive analyses in a row
        </p>
      </div>
    );

    return (
      <div className="space-y-3">
        <div className={`${LABEL_CLASS} mb-2 flex items-center gap-1.5`}>
          Custom Condition
          <SectionTooltip tip="Describe the unlock condition in plain English. The Edge Function evaluates this as plain text context — not executed code." />
        </div>
        <textarea className={INPUT_CLASS + " min-h-[80px]"} value={b.condition_custom || ""} onChange={(e) => setB({ condition_custom: e.target.value })} placeholder="e.g. All phase scores above 85 AND Break Angle within tolerance on 3 analyses" />
      </div>
    );
  };

  const renderEmojiPicker = (currentIcon: string, onSelect: (e: string) => void, show: boolean, setShow: (v: boolean) => void) => (
    <div className="relative">
      <button type="button" onClick={() => setShow(!show)} className="w-12 h-12 rounded-xl border border-outline-variant/30 flex items-center justify-center text-2xl hover:border-primary-container/50 transition-colors bg-[#0E1319]">
        {currentIcon || "🏆"}
      </button>
      {show && (
        <div className="absolute z-50 top-full mt-1 right-0 p-3 rounded-xl border border-outline-variant/20 bg-[#1A2029] shadow-xl grid grid-cols-4 gap-1.5 max-w-[280px] max-h-[200px] overflow-y-auto">
          {EMOJI_OPTIONS.map((em) => (
            <button key={em} type="button" onClick={() => { onSelect(em); setShow(false); }} className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg hover:bg-outline-variant/20 transition-colors ${currentIcon === em ? "bg-primary-container/20 ring-1 ring-primary-container" : ""}`}>
              {em}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderFields = (b: Badge, setB: (patch: Partial<Badge>) => void, isAdd: boolean) => (
    <div className="space-y-5 pt-3">
      {/* Name + Icon row */}
      <div className="flex gap-4 items-start">
        <div className="flex-1">
          <div className={`${LABEL_CLASS} mb-2 flex items-center gap-1.5`}>
            Badge Name
            <SectionTooltip tip="Athlete-facing badge title. Keep it aspirational and sport-specific. e.g. 'Route Technician', 'Deep Threat', 'Plant Foot Master'" />
          </div>
          <input className={INPUT_CLASS} value={b.name} onChange={(e) => setB({ name: e.target.value })} placeholder="e.g. Route Technician" />
        </div>
        <div>
          <div className={`${LABEL_CLASS} mb-2 flex items-center gap-1.5`}>
            Icon
            <SectionTooltip tip="Emoji or icon displayed alongside the badge name on the athlete profile and results screen." />
          </div>
          {renderEmojiPicker(b.icon || "🏆", (e) => setB({ icon: e }), isAdd ? showEmojiPicker : editEmojiPicker, isAdd ? setShowEmojiPicker : setEditEmojiPicker)}
        </div>
      </div>

      {/* Description */}
      <div>
        <div className={`${LABEL_CLASS} mb-2 flex items-center gap-1.5`}>
          Description
          <SectionTooltip tip="Short motivational line shown to the athlete when they earn or view this badge. Keep under 15 words." />
        </div>
        <input className={INPUT_CLASS} value={b.description || ""} onChange={(e) => setB({ description: e.target.value })} placeholder="e.g. Your break mechanics are operating at an elite level." />
      </div>

      {/* Rarity */}
      <div>
        <div className={`${LABEL_CLASS} mb-2 flex items-center gap-1.5`}>
          Rarity / Tier
          <SectionTooltip tip="Affects visual presentation on the athlete profile and sets difficulty expectations." />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["common", "rare", "epic", "legendary"] as BadgeRarity[]).map((r) => {
            const active = (b.rarity || "common") === r;
            const c = RARITY_COLORS[r];
            return (
              <button key={r} type="button" onClick={() => setB({ rarity: r })}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${active ? `${c.bg} ${c.text} ${c.border}` : "bg-[#0E1319] text-on-surface-variant/60 border-outline-variant/20 hover:border-outline-variant/40"}`}>
                {r}
              </button>
            );
          })}
        </div>
        <p className="text-on-surface-variant/40 text-[11px] mt-2">
          {(b.rarity || "common") === "common" && "Achievable in early sessions. Entry-level milestone."}
          {b.rarity === "rare" && "Requires consistent effort over multiple sessions."}
          {b.rarity === "epic" && "High performance threshold. Top 20% of athletes."}
          {b.rarity === "legendary" && "Elite-level achievement. Requires near-perfect execution."}
        </p>
      </div>

      {/* Condition Type */}
      <div>
        <div className={`${LABEL_CLASS} mb-2 flex items-center gap-1.5`}>
          Unlock Condition Type
          <SectionTooltip tip="Determines how the pipeline evaluates whether this badge should be awarded after each analysis." />
        </div>
        <select className={INPUT_CLASS} value={b.condition_type || "score"} onChange={(e) => setB({ condition_type: e.target.value as ConditionType })}>
          <option value="score">Score-Based — Unlock when overall Mastery Score reaches a threshold</option>
          <option value="metric">Metric-Based — Unlock when a specific metric reaches a target value</option>
          <option value="streak">Streak-Based — Unlock when a condition is met on consecutive analyses</option>
          <option value="custom">Custom — Free text condition for complex unlock logic</option>
        </select>
      </div>

      {/* Conditional fields */}
      {renderConditionFields(b, setB)}
    </div>
  );

  // Empty state
  if (badges.length === 0 && !adding) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <span className="text-5xl">🏆</span>
        <p className="text-on-surface font-semibold text-sm">No badges defined</p>
        <p className="text-on-surface-variant text-xs text-center max-w-xs">
          Add achievement badges to motivate athletes and reward performance milestones.
        </p>
        <button onClick={() => { setAdding(true); setDraft(newBadge()); }} className="px-5 py-3 rounded-xl bg-primary-container text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span> Add Badge
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Add button top right */}
      <div className="flex justify-end">
        <button onClick={() => { setAdding(true); setExpandedIdx(null); setDraft(newBadge()); setShowEmojiPicker(false); }}
          className="px-4 py-2.5 rounded-xl bg-primary-container text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Add Badge
        </button>
      </div>

      {/* Badge cards */}
      <div className="space-y-2">
        {badges.map((b, i) => {
          const expanded = expandedIdx === i;
          const rc = RARITY_COLORS[(b.rarity || "common") as BadgeRarity] || RARITY_COLORS.common;
          return (
            <div key={b.id || i} draggable onDragStart={() => handleDragStart(i)} onDragOver={(e) => handleDragOver(e, i)}
              className={`${CARD_CLASS} ${expanded ? "border-primary-container/30" : ""} cursor-grab active:cursor-grabbing`}>
              {expanded ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-on-surface-variant text-xs font-mono w-6">#{i + 1}</span>
                    <span className="text-lg">{b.icon || "🏆"}</span>
                    <span className="text-on-surface text-sm font-bold flex-1">{b.name || "New Badge"}</span>
                  </div>
                  {renderFields(b, (patch) => updateBadge(i, patch), false)}
                  <div className="flex gap-2 pt-3">
                    <button onClick={() => setExpandedIdx(null)} className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">Done</button>
                    <button onClick={() => onConfirmDelete({
                      title: "Delete Badge?",
                      body: `Deleting ${b.name || `Badge ${i + 1}`} will remove it from the badge library. This cannot be undone.`,
                      confirmLabel: "Delete Badge",
                      onConfirm: () => { onChange(badges.filter((_, j) => j !== i)); setExpandedIdx(null); }
                    })} className="px-4 py-2 rounded-lg text-red-400 text-xs font-bold uppercase tracking-widest hover:text-red-300 transition-colors" style={{ backgroundColor: '#1A2029' }}>Delete</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 group" onClick={() => toggle(i)}>
                  <span className="text-on-surface-variant/40 text-xs font-mono w-6 shrink-0">#{i + 1}</span>
                  <span className="text-lg shrink-0">{b.icon || "🏆"}</span>
                  <p className="text-on-surface text-sm font-semibold truncate flex-1 min-w-0">{b.name || "Untitled Badge"}</p>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${rc.bg} ${rc.text} ${rc.border}`}>
                    {rarityLabel(b.rarity || "common")}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); toggle(i); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary-container transition-colors" style={{ backgroundColor: '#111720' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onConfirmDelete({
                      title: "Delete Badge?",
                      body: `Deleting ${b.name || `Badge ${i + 1}`} will remove it from the badge library. This cannot be undone.`,
                      confirmLabel: "Delete Badge",
                      onConfirm: () => { onChange(badges.filter((_, j) => j !== i)); setExpandedIdx(null); }
                    }); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-red-400 transition-colors" style={{ backgroundColor: '#111720' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add form */}
      {adding && (
        <div className={CARD_CLASS + " border-primary-container/20"}>
          <p className="text-on-surface text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <span className="text-lg">{draft.icon || "🏆"}</span> New Badge
          </p>
          {renderFields(draft, (patch) => setDraft((prev) => ({ ...prev, ...patch })), true)}
          <div className="flex gap-2 pt-3">
            <button onClick={handleAdd} disabled={!draft.name.trim()} className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">Add Badge</button>
            <button onClick={() => { setAdding(false); setDraft(newBadge()); setShowEmojiPicker(false); }} className="px-4 py-2 rounded-lg text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors" style={{ backgroundColor: '#1A2029' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
