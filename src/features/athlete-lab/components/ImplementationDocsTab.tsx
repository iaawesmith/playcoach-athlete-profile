import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DocCard {
  id: string;
  title: string;
  subtitle: string;
  content: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_DOCS: Omit<DocCard, "id" | "created_at" | "updated_at">[] = [
  {
    title: "Edge Function — analyze-athlete-video",
    subtitle: "Complete Deno/TypeScript implementation for Phase 1 Step 3 and all Phase 3 Edge Function logic",
    content: "",
    display_order: 0,
  },
  {
    title: "Cloud Run — rtmlib Service",
    subtitle: "Dockerfile, FastAPI service, dynamic calibration, and deployment commands for Phase 2",
    content: "",
    display_order: 1,
  },
  {
    title: "Metric Calculation Reference",
    subtitle: "Formulas, edge cases, and validation rules for all 5 calculation types",
    content: "",
    display_order: 2,
  },
];

export function ImplementationDocsTab() {
  const [docs, setDocs] = useState<DocCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");

  const loadDocs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("admin_implementation_docs")
      .select("*")
      .order("display_order", { ascending: true });

    if (data && data.length > 0) {
      setDocs(data as DocCard[]);
    } else {
      // Seed defaults
      const inserts = DEFAULT_DOCS.map((d) => ({
        title: d.title,
        subtitle: d.subtitle,
        content: d.content,
        display_order: d.display_order,
      }));
      const { data: seeded } = await supabase
        .from("admin_implementation_docs")
        .insert(inserts)
        .select();
      if (seeded) setDocs(seeded as DocCard[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleSave = async (doc: DocCard) => {
    setSavingId(doc.id);
    const updates: Record<string, unknown> = {
      content: editContent,
      updated_at: new Date().toISOString(),
    };
    if (editTitle !== doc.title) updates.title = editTitle;
    if (editSubtitle !== doc.subtitle) updates.subtitle = editSubtitle;

    await supabase
      .from("admin_implementation_docs")
      .update(updates)
      .eq("id", doc.id);

    setDocs((prev) =>
      prev.map((d) =>
        d.id === doc.id
          ? { ...d, content: editContent, title: editTitle || d.title, subtitle: editSubtitle || d.subtitle, updated_at: new Date().toISOString() }
          : d
      )
    );
    setEditingId(null);
    setSavingId(null);
    setSavedId(doc.id);
    setTimeout(() => setSavedId(null), 1500);
  };

  const handleCopy = async (doc: DocCard) => {
    try {
      await navigator.clipboard.writeText(doc.content);
      setCopiedId(doc.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* silent */ }
  };

  const startEdit = (doc: DocCard) => {
    setEditingId(doc.id);
    setEditContent(doc.content);
    setEditTitle(doc.title);
    setEditSubtitle(doc.subtitle);
    setExpandedId(doc.id);
  };

  const handleAddDoc = async () => {
    if (!newTitle.trim()) return;
    const order = docs.length;
    const { data } = await supabase
      .from("admin_implementation_docs")
      .insert({ title: newTitle, subtitle: newSubtitle, content: "", display_order: order })
      .select()
      .single();
    if (data) {
      setDocs((prev) => [...prev, data as DocCard]);
      setAddingNew(false);
      setNewTitle("");
      setNewSubtitle("");
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-container animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-on-surface font-extrabold uppercase tracking-tight text-sm">Implementation Docs</h2>
        <p className="text-on-surface-variant text-xs mt-1">
          Technical specifications and implementation guides for the rtmlib pipeline. Each document is ready to paste into Claude or share with a developer.
        </p>
      </div>

      {/* Document cards */}
      <div className="space-y-3">
        {docs.map((doc) => {
          const isExpanded = expandedId === doc.id;
          const isEditing = editingId === doc.id;

          return (
            <div
              key={doc.id}
              className="bg-surface-container border border-outline-variant/10 rounded-xl overflow-hidden transition-colors hover:border-primary-container/20"
            >
              {/* Card header */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer"
                onClick={() => !isEditing && setExpandedId(isExpanded ? null : doc.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="material-symbols-outlined text-on-surface-variant/50 transition-transform"
                      style={{ fontSize: 16, transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
                    >
                      chevron_right
                    </span>
                    {isEditing ? (
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 bg-surface-container-lowest border border-outline-variant/10 rounded-lg px-2 py-1 text-on-surface text-sm font-bold focus:outline-none focus:border-primary-container/30"
                      />
                    ) : (
                      <span className="text-on-surface font-bold text-sm">{doc.title}</span>
                    )}
                  </div>
                  {isEditing ? (
                    <input
                      value={editSubtitle}
                      onChange={(e) => setEditSubtitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 ml-6 w-full bg-surface-container-lowest border border-outline-variant/10 rounded-lg px-2 py-1 text-on-surface-variant text-xs focus:outline-none focus:border-primary-container/30"
                    />
                  ) : doc.subtitle ? (
                    <p className="text-on-surface-variant text-xs mt-0.5 ml-6">{doc.subtitle}</p>
                  ) : null}
                  <p className="text-on-surface-variant/40 text-[10px] mt-1 ml-6">
                    Last updated: {formatDate(doc.updated_at)}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
                  {savedId === doc.id ? (
                    <span className="flex items-center gap-1 text-primary-container text-[10px] font-black uppercase tracking-[0.2em] px-3">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                      Saved ✓
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => handleCopy(doc)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
                        title="Copy content"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          {copiedId === doc.id ? "check" : "content_copy"}
                        </span>
                      </button>
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => setEditingId(null)}
                            className="h-7 px-3 rounded-full text-on-surface-variant font-black uppercase tracking-[0.2em] text-[10px] hover:text-on-surface transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSave(doc)}
                            disabled={savingId === doc.id}
                            className="h-7 px-3 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all disabled:opacity-50"
                          >
                            {savingId === doc.id ? "Saving..." : "Save"}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEdit(doc)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Card body — expandable */}
              {isExpanded && (
                <div className="px-4 pb-4">
                  <textarea
                    readOnly={!isEditing}
                    value={isEditing ? editContent : doc.content}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder={isEditing ? "Paste implementation documentation here..." : "No content yet. Click Edit to add documentation."}
                    className={`w-full bg-surface-container-lowest border rounded-xl p-4 text-on-surface text-xs font-mono leading-relaxed resize-y focus:outline-none transition-colors ${
                      isEditing
                        ? "border-primary-container/30 focus:border-primary-container/50 min-h-[400px]"
                        : "border-outline-variant/10 text-on-surface/70 min-h-[400px]"
                    }`}
                    style={{ minHeight: 400 }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add new document */}
      {addingNew ? (
        <div className="bg-surface-container border border-outline-variant/10 rounded-xl p-4 space-y-3">
          <div>
            <label className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.15em]">Title</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Document title..."
              className="mt-1 w-full h-9 bg-surface-container-lowest border border-outline-variant/10 rounded-lg px-3 text-on-surface text-xs focus:outline-none focus:border-primary-container/30 transition-colors"
            />
          </div>
          <div>
            <label className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.15em]">Subtitle</label>
            <input
              value={newSubtitle}
              onChange={(e) => setNewSubtitle(e.target.value)}
              placeholder="Brief description of what this document covers..."
              className="mt-1 w-full h-9 bg-surface-container-lowest border border-outline-variant/10 rounded-lg px-3 text-on-surface text-xs focus:outline-none focus:border-primary-container/30 transition-colors"
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleAddDoc}
              disabled={!newTitle.trim()}
              className="h-8 px-4 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all disabled:opacity-50"
            >
              Add Document
            </button>
            <button
              onClick={() => { setAddingNew(false); setNewTitle(""); setNewSubtitle(""); }}
              className="text-on-surface-variant font-black uppercase tracking-[0.2em] text-[10px] hover:text-on-surface transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingNew(true)}
          className="w-full h-11 rounded-xl border border-dashed border-outline-variant/20 text-on-surface-variant font-black uppercase tracking-[0.2em] text-[10px] hover:border-primary-container/30 hover:text-on-surface transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          Add Document
        </button>
      )}
    </div>
  );
}