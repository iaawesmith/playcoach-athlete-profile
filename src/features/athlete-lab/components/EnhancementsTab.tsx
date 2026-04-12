import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Urgency = "critical" | "high" | "medium" | "future";

interface Enhancement {
  id: string;
  title: string;
  tab: string;
  urgency: Urgency;
  description: string;
  reason: string;
  lovable_prompt: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TAB_OPTIONS = [
  "All Tabs", "Basics", "Videos", "Overview", "Phases", "Mechanics",
  "Metrics", "Scoring", "Errors", "Reference", "Camera", "Checkpoints",
  "LLM Prompt", "Badges", "Training Status", "Run Analysis",
  "Admin Reference", "Global / Cross-Tab",
] as const;

const URGENCY_OPTIONS: { value: Urgency; emoji: string; label: string; desc: string }[] = [
  { value: "critical", emoji: "🔴", label: "CRITICAL", desc: "Blocks pipeline or causes data loss" },
  { value: "high", emoji: "🟡", label: "HIGH", desc: "Significant UX or functionality gap" },
  { value: "medium", emoji: "🔵", label: "MEDIUM", desc: "Valuable improvement, not urgent" },
  { value: "future", emoji: "⚪", label: "FUTURE STATE", desc: "Good idea, revisit later" },
];

const URGENCY_ORDER: Record<Urgency, number> = { critical: 0, high: 1, medium: 2, future: 3 };

const TAB_COLORS: Record<string, string> = {
  "Basics": "bg-slate-500/20 text-slate-300",
  "Videos": "bg-slate-500/20 text-slate-300",
  "Overview": "bg-slate-500/20 text-slate-300",
  "Phases": "bg-teal-500/20 text-teal-300",
  "Mechanics": "bg-teal-500/20 text-teal-300",
  "Metrics": "bg-emerald-500/20 text-emerald-300",
  "Scoring": "bg-amber-500/20 text-amber-300",
  "Errors": "bg-amber-500/20 text-amber-300",
  "Reference": "bg-purple-500/20 text-purple-300",
  "Camera": "bg-purple-500/20 text-purple-300",
  "Checkpoints": "bg-pink-500/20 text-pink-300",
  "LLM Prompt": "bg-pink-500/20 text-pink-300",
  "Badges": "bg-pink-500/20 text-pink-300",
  "Training Status": "bg-orange-500/20 text-orange-300",
  "Run Analysis": "bg-orange-500/20 text-orange-300",
  "Admin Reference": "bg-neutral-500/20 text-neutral-400",
  "Global / Cross-Tab": "bg-white/10 text-white",
  "All Tabs": "bg-white/10 text-white",
};

const URGENCY_PILL: Record<Urgency, string> = {
  critical: "bg-red-500/20 text-red-400",
  high: "bg-amber-500/20 text-amber-400",
  medium: "bg-blue-500/20 text-blue-400",
  future: "bg-neutral-500/20 text-neutral-500",
};

const URGENCY_COUNT_COLOR: Record<Urgency, string> = {
  critical: "text-red-400",
  high: "text-amber-400",
  medium: "text-blue-400",
  future: "text-neutral-500",
};

const INPUT_CLASS = "w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl px-3 text-on-surface text-xs focus:outline-none focus:border-primary-container/30 transition-colors";
const LABEL_CLASS = "text-on-surface-variant text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-1 mb-1";

/* ------------------------------------------------------------------ */
/*  Tooltip                                                            */
/* ------------------------------------------------------------------ */

function Tip({ text }: { text: string }) {
  return (
    <span className="material-symbols-outlined text-on-surface-variant/40 cursor-help" style={{ fontSize: 12 }} title={text}>
      info
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  EnhancementsTab                                                    */
/* ------------------------------------------------------------------ */

export function EnhancementsTab() {
  const [items, setItems] = useState<Enhancement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState("All Tabs");
  const [filterUrgency, setFilterUrgency] = useState<Urgency | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Enhancement> | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  /* ---------- load ---------- */
  const load = useCallback(async () => {
    const { data } = await supabase
      .from("admin_enhancements")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      const sorted = (data as Enhancement[]).sort((a, b) => {
        const u = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
        if (u !== 0) return u;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setItems(sorted);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ---------- filter ---------- */
  const filtered = items.filter((e) => {
    if (filterTab !== "All Tabs" && e.tab !== filterTab) return false;
    if (filterUrgency !== "all" && e.urgency !== filterUrgency) return false;
    return true;
  });

  /* ---------- counts ---------- */
  const countByUrgency = (u: Urgency) => items.filter((e) => e.urgency === u).length;

  /* ---------- new / edit helpers ---------- */
  const blankDraft: Partial<Enhancement> = {
    title: "", tab: "Global / Cross-Tab", urgency: "medium",
    description: "", reason: "", lovable_prompt: "", notes: "",
  };

  const startAdd = () => {
    setAddingNew(true);
    setExpandedId(null);
    setEditDraft({ ...blankDraft });
  };

  const startEdit = (e: Enhancement) => {
    setAddingNew(false);
    setExpandedId(e.id);
    setEditDraft({ ...e });
  };

  const cancelEdit = () => {
    setExpandedId(null);
    setAddingNew(false);
    setEditDraft(null);
  };

  const handleSave = async () => {
    if (!editDraft?.title?.trim() || !editDraft?.description?.trim() || !editDraft?.reason?.trim()) return;
    setSaving(true);
    try {
      if (addingNew) {
        const { data } = await supabase.from("admin_enhancements").insert({
          title: editDraft.title!.trim(),
          tab: editDraft.tab!,
          urgency: editDraft.urgency!,
          description: editDraft.description!.trim(),
          reason: editDraft.reason!.trim(),
          lovable_prompt: editDraft.lovable_prompt?.trim() || null,
          notes: editDraft.notes?.trim() || null,
        }).select().single();
        if (data) setItems((prev) => [...prev, data as Enhancement].sort((a, b) => {
          const u = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
          if (u !== 0) return u;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }));
      } else if (expandedId) {
        await supabase.from("admin_enhancements").update({
          title: editDraft.title!.trim(),
          tab: editDraft.tab!,
          urgency: editDraft.urgency!,
          description: editDraft.description!.trim(),
          reason: editDraft.reason!.trim(),
          lovable_prompt: editDraft.lovable_prompt?.trim() || null,
          notes: editDraft.notes?.trim() || null,
          updated_at: new Date().toISOString(),
        }).eq("id", expandedId);
        setItems((prev) => prev.map((e) => e.id === expandedId ? { ...e, ...editDraft, updated_at: new Date().toISOString() } as Enhancement : e));
      }
      cancelEdit();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("admin_enhancements").delete().eq("id", id);
    setItems((prev) => prev.filter((e) => e.id !== id));
    setDeleteConfirmId(null);
    if (expandedId === id) cancelEdit();
  };

  const copyPrompt = async () => {
    if (!editDraft?.lovable_prompt) return;
    try {
      await navigator.clipboard.writeText(editDraft.lovable_prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch { /* silent */ }
  };

  /* ---------- render form fields ---------- */
  const renderForm = () => {
    if (!editDraft) return null;
    const d = editDraft;
    const set = (k: keyof Enhancement, v: string) => setEditDraft({ ...d, [k]: v });
    const canSave = !!(d.title?.trim() && d.description?.trim() && d.reason?.trim());

    return (
      <div className="space-y-4 pt-3">
        {/* Title */}
        <div>
          <label className={LABEL_CLASS}>Enhancement Title <Tip text="Short descriptive name for this enhancement. Should be specific enough to understand at a glance." /></label>
          <input className={`${INPUT_CLASS} h-9`} value={d.title || ""} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Duplicate Node button" />
        </div>

        {/* Tab */}
        <div>
          <label className={LABEL_CLASS}>Tab <Tip text="Which AthleteLab tab this enhancement applies to." /></label>
          <select className={`${INPUT_CLASS} h-9`} value={d.tab || "Global / Cross-Tab"} onChange={(e) => set("tab", e.target.value)}>
            {TAB_OPTIONS.filter((t) => t !== "All Tabs").map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Urgency */}
        <div>
          <label className={LABEL_CLASS}>Urgency <Tip text="Priority level. Critical = do immediately. Future State = tracked but not scheduled." /></label>
          <div className="flex flex-wrap gap-2">
            {URGENCY_OPTIONS.map((u) => (
              <button key={u.value} onClick={() => set("urgency", u.value)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.12em] transition-all border ${
                  d.urgency === u.value ? `${URGENCY_PILL[u.value]} border-current` : "bg-surface-container-lowest border-outline-variant/10 text-on-surface-variant"
                }`}>
                {u.emoji} {u.label}
              </button>
            ))}
          </div>
          {d.urgency && <p className="text-on-surface-variant/60 text-[10px] mt-1">{URGENCY_OPTIONS.find((u) => u.value === d.urgency)?.desc}</p>}
        </div>

        {/* Description */}
        <div>
          <label className={LABEL_CLASS}>Description <Tip text="What this enhancement does and why it matters. Be specific enough that any admin or developer can understand the scope." /></label>
          <textarea className={`${INPUT_CLASS} min-h-[80px] py-2`} value={d.description || ""} onChange={(e) => set("description", e.target.value)} placeholder="Describe the enhancement and what problem it solves..." />
        </div>

        {/* Reason */}
        <div>
          <label className={LABEL_CLASS}>Reason for Enhancement <Tip text="Why is this needed? Reference the specific gap, user pain point, or pipeline limitation this addresses." /></label>
          <textarea className={`${INPUT_CLASS} min-h-[80px] py-2`} value={d.reason || ""} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. Admins building new route nodes start from a blank slate — duplicating an existing node saves 80% of configuration time..." />
        </div>

        {/* Lovable Prompt */}
        <div>
          <label className={LABEL_CLASS}>Lovable Prompt <Tip text="If a Lovable prompt has been written for this enhancement, paste it here for reference. Can be copied and pasted directly into Lovable when ready to build." /></label>
          <textarea className={`${INPUT_CLASS} min-h-[120px] py-2 font-mono`} value={d.lovable_prompt || ""} onChange={(e) => set("lovable_prompt", e.target.value)} placeholder="Paste Lovable prompt here if available..." />
          <div className="flex items-center justify-between mt-1">
            <span className="text-on-surface-variant/40 text-[10px]">{(d.lovable_prompt || "").length} characters</span>
            {(d.lovable_prompt || "").trim().length > 0 && (
              <button onClick={copyPrompt} className="h-7 px-3 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.15em] text-[9px] active:scale-95 transition-all flex items-center gap-1">
                {copiedPrompt ? "✓ COPIED!" : "COPY PROMPT ↗"}
              </button>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className={LABEL_CLASS}>Notes <Tip text="Any additional context, links, screenshots references, or follow-up thoughts." /></label>
          <textarea className={`${INPUT_CLASS} min-h-[60px] py-2`} value={d.notes || ""} onChange={(e) => set("notes", e.target.value)} placeholder="Additional context, related discussions, or follow-up notes..." />
        </div>

        {/* Date Added */}
        {!addingNew && d.created_at && (
          <p className="text-on-surface-variant/40 text-[10px]">
            Added {new Date(d.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button onClick={handleSave} disabled={!canSave || saving}
            className="h-8 px-4 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={cancelEdit} className="text-on-surface-variant font-black uppercase tracking-[0.2em] text-[10px] hover:text-on-surface transition-colors">Cancel</button>
        </div>
      </div>
    );
  };

  /* ---------- loading ---------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
      </div>
    );
  }

  /* ---------- main render ---------- */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-on-surface font-extrabold uppercase tracking-tight text-sm">Enhancements</h2>
          <p className="text-on-surface-variant text-xs mt-1">
            Track planned and future-state improvements across all AthleteLab tabs. Add, prioritize, and reference enhancement ideas so nothing gets lost.
          </p>
        </div>
        {!addingNew && (
          <button onClick={startAdd} className="h-8 px-4 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all shrink-0 ml-4 flex items-center gap-1.5">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
            Add Enhancement
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={filterTab} onChange={(e) => setFilterTab(e.target.value)}
          className={`${INPUT_CLASS} h-8 w-48 text-[10px]`}>
          {TAB_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFilterUrgency("all")}
            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.12em] transition-all border ${
              filterUrgency === "all" ? "bg-white/10 border-white/20 text-white" : "bg-surface-container-lowest border-outline-variant/10 text-on-surface-variant"
            }`}>Show All</button>
          {URGENCY_OPTIONS.map((u) => (
            <button key={u.value} onClick={() => setFilterUrgency(u.value)}
              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.12em] transition-all border ${
                filterUrgency === u.value ? `${URGENCY_PILL[u.value]} border-current` : "bg-surface-container-lowest border-outline-variant/10 text-on-surface-variant"
              }`}>
              {u.emoji} {u.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary strip */}
      <p className="text-[10px] font-medium tracking-wide">
        <span className="text-on-surface">{items.length}</span>
        <span className="text-on-surface-variant"> enhancements · </span>
        <span className={URGENCY_COUNT_COLOR.critical}>{countByUrgency("critical")}</span>
        <span className="text-on-surface-variant"> critical · </span>
        <span className={URGENCY_COUNT_COLOR.high}>{countByUrgency("high")}</span>
        <span className="text-on-surface-variant"> high · </span>
        <span className={URGENCY_COUNT_COLOR.medium}>{countByUrgency("medium")}</span>
        <span className="text-on-surface-variant"> medium · </span>
        <span className={URGENCY_COUNT_COLOR.future}>{countByUrgency("future")}</span>
        <span className="text-on-surface-variant"> future state</span>
      </p>

      {/* Add new form */}
      {addingNew && (
        <div className="bg-surface-container border border-primary-container/20 rounded-xl p-4">
          <h3 className="text-on-surface font-extrabold uppercase tracking-tight text-xs">New Enhancement</h3>
          {renderForm()}
        </div>
      )}

      {/* Cards */}
      {filtered.length === 0 && !addingNew && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-xl bg-surface-container flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 32 }}>lightbulb</span>
          </div>
          <p className="text-on-surface font-bold text-sm mb-1">No enhancements tracked yet</p>
          <p className="text-on-surface-variant text-xs mb-4">Add enhancement ideas here to keep track of planned improvements and future-state features.</p>
          <button onClick={startAdd} className="h-8 px-4 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all flex items-center gap-1.5">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
            Add Enhancement
          </button>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((e, idx) => {
          const isExpanded = expandedId === e.id && !addingNew;
          const isDeleting = deleteConfirmId === e.id;

          return (
            <div key={e.id} className={`bg-surface-container border rounded-xl transition-colors ${isExpanded ? "border-primary-container/20" : "border-outline-variant/10 hover:border-primary-container/10"}`}>
              {/* Collapsed row */}
              <div className="flex items-center gap-2 px-4 py-3">
                <span className="text-on-surface-variant/40 text-[10px] font-mono w-5 shrink-0">#{idx + 1}</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] shrink-0 ${TAB_COLORS[e.tab] || TAB_COLORS["All Tabs"]}`}>
                  {e.tab}
                </span>
                <span className="text-on-surface text-xs font-bold flex-1 min-w-0 truncate">{e.title}</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] shrink-0 ${URGENCY_PILL[e.urgency]}`}>
                  {URGENCY_OPTIONS.find((u) => u.value === e.urgency)?.emoji} {e.urgency}
                </span>
                <button onClick={() => isExpanded ? cancelEdit() : startEdit(e)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors shrink-0" title="Edit">
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{isExpanded ? "expand_less" : "edit"}</span>
                </button>
                <button onClick={() => setDeleteConfirmId(e.id)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:text-red-500 hover:bg-surface-container-high transition-colors shrink-0" title="Delete">
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                </button>
              </div>

              {/* Delete confirmation */}
              {isDeleting && (
                <div className="px-4 pb-3 flex items-center justify-between border-t border-outline-variant/10 pt-3">
                  <p className="text-on-surface text-xs">Delete this enhancement? This cannot be undone.</p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleDelete(e.id)} className="h-8 px-4 rounded-full bg-red-600 text-on-surface font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all">Delete</button>
                    <button onClick={() => setDeleteConfirmId(null)} className="text-on-surface-variant font-black uppercase tracking-[0.2em] text-[10px] hover:text-on-surface transition-colors">Cancel</button>
                  </div>
                </div>
              )}

              {/* Expanded edit form */}
              {isExpanded && !isDeleting && (
                <div className="px-4 pb-4 border-t border-outline-variant/10">
                  {renderForm()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
