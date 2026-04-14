import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataDictionaryTab } from "./DataDictionaryTab";
import { EnhancementsTab } from "./EnhancementsTab";
import { PipelineSetupTab } from "./PipelineSetupTab";
import { ImplementationDocsTab } from "./ImplementationDocsTab";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TabId = "agent_briefing" | "node_builder" | "architecture" | "links" | "pipeline_setup" | "implementation_docs" | "enhancements" | "data_dictionary";

interface ReferenceLink {
  id: string;
  title: string;
  url: string;
  description: string;
  display_order: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TAB_SECTIONS: { label: string; tabs: { id: TabId; label: string }[] }[] = [
  {
    label: "AGENT KNOWLEDGE",
    tabs: [
      { id: "agent_briefing", label: "AGENT BRIEFING" },
      { id: "node_builder", label: "NODE BUILDER" },
    ],
  },
  {
    label: "SYSTEM REFERENCE",
    tabs: [
      { id: "architecture", label: "ARCHITECTURE" },
      { id: "data_dictionary", label: "DATA DICTIONARY" },
    ],
  },
  {
    label: "PIPELINE BUILD",
    tabs: [
      { id: "pipeline_setup", label: "PIPELINE SETUP" },
      { id: "implementation_docs", label: "IMPLEMENTATION DOCS" },
    ],
  },
  {
    label: "RESOURCES",
    tabs: [
      { id: "links", label: "LINKS" },
      { id: "enhancements", label: "ENHANCEMENTS" },
    ],
  },
];

const PROMPT_TAB_CONFIG: Record<
  "agent_briefing" | "node_builder" | "architecture",
  { title: string; subtitle: string; placeholder: string; tabKey: string }
> = {
  agent_briefing: {
    title: "Agent Briefing Prompt",
    subtitle:
      "Paste this into any new Claude conversation to instantly onboard an agent on AthleteLab, the rtmlib pipeline, and node configuration standards.",
    placeholder: "[Agent briefing prompt will be added here]",
    tabKey: "agent_briefing",
  },
  node_builder: {
    title: "Node Builder Prompt",
    subtitle:
      "Paste this into Claude alongside the Agent Briefing Prompt to generate a complete, pipeline-ready node configuration for any skill. Fill in the [PLACEHOLDER] fields with your skill details before pasting.",
    placeholder: "[Node builder prompt will be added here]",
    tabKey: "node_builder",
  },
  architecture: {
    title: "System Architecture",
    subtitle: "Technical architecture reference for the PlayCoach analysis pipeline.",
    placeholder: "[Architecture documentation will be added here]",
    tabKey: "architecture",
  },
};

const DEFAULT_LINKS: Omit<ReferenceLink, "id">[] = [
  {
    title: "Keypoint Library",
    url: "https://github.com/iaawesmith/playcoach-athlete-profile/blob/main/src/constants/keypointLibrary.json",
    description: "Full 133-keypoint COCO-WholeBody schema used by the analysis pipeline",
    display_order: 0,
  },
  {
    title: "rtmlib Documentation",
    url: "https://github.com/Tau-J/rtmlib",
    description: "RTMPose/RTMW lightweight deployment library",
    display_order: 1,
  },
  {
    title: "MMPose Model Zoo",
    url: "https://github.com/open-mmlab/mmpose/tree/dev-1.x/projects/rtmpose",
    description: "Full RTMPose model performance benchmarks and download links",
    display_order: 2,
  },
  {
    title: "Data Dictionary (GitHub)",
    url: "https://github.com/iaawesmith/playcoach-athlete-profile/blob/main/docs/data-dictionary/fields.json",
    description: "Live fields.json — AthleteLab, Supabase, and MMPose alignment status",
    display_order: 3,
  },
  {
    title: "PlayCoach GitHub Repo",
    url: "https://github.com/iaawesmith/playcoach-athlete-profile",
    description: "Main codebase — src, docs, constants, and data dictionary",
    display_order: 4,
  },
];

/* ------------------------------------------------------------------ */
/*  PromptTab                                                          */
/* ------------------------------------------------------------------ */

function PromptTab({ tabKey }: { tabKey: "agent_briefing" | "node_builder" | "architecture" }) {
  const config = PROMPT_TAB_CONFIG[tabKey];
  const [content, setContent] = useState(config.placeholder);
  const [savedContent, setSavedContent] = useState(config.placeholder);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      const keys = tabKey === "agent_briefing" ? [tabKey, "handoff_prompt"] : [tabKey];
      const { data } = await supabase.from("admin_tab_guidance").select("tab_key, content").in("tab_key", keys);
      if (data && data.length > 0) {
        const match = data.find((r) => r.tab_key === tabKey) || data[0];
        if (match?.content) {
          setContent(match.content);
          setSavedContent(match.content);
        }
      }
    };
    load();
  }, [tabKey]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase.from("admin_tab_guidance").select("id").eq("tab_key", tabKey).maybeSingle();
      if (existing) {
        await supabase.from("admin_tab_guidance").update({ content, updated_at: new Date().toISOString() }).eq("tab_key", tabKey);
      } else {
        await supabase.from("admin_tab_guidance").insert({ tab_key: tabKey, content });
      }
      setSavedContent(content);
      setEditing(false);
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setContent(savedContent);
    setEditing(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-on-surface font-extrabold uppercase tracking-tight text-sm">{config.title}</h2>
          <p className="text-on-surface-variant text-xs mt-1">{config.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {savedFeedback ? (
            <span className="flex items-center gap-1.5 text-primary-container text-[10px] font-black uppercase tracking-[0.2em]">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
              Saved ✓
            </span>
          ) : editing ? (
            <>
              <button onClick={handleCancel} className="h-8 px-4 rounded-full text-on-surface-variant font-black uppercase tracking-[0.2em] text-[10px] hover:text-on-surface transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="h-8 px-4 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="h-8 px-4 rounded-full bg-surface-container border border-outline-variant/10 text-on-surface-variant font-black uppercase tracking-[0.2em] text-[10px] hover:bg-surface-container-high transition-all active:scale-95 flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
              Edit
            </button>
          )}
        </div>
      </div>

      <textarea
        readOnly={!editing}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className={`w-full min-h-[500px] bg-surface-container-lowest border rounded-xl p-4 text-on-surface text-xs font-mono leading-relaxed resize-y focus:outline-none transition-colors ${
          editing ? "border-primary-container/30 focus:border-primary-container/50" : "border-outline-variant/10 text-on-surface/70"
        }`}
      />

      <button onClick={handleCopy} className="w-full h-11 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all">
        {copied ? "✓ COPIED!" : "COPY TO CLIPBOARD"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LinksTab                                                           */
/* ------------------------------------------------------------------ */

function LinksTab() {
  const [links, setLinks] = useState<ReferenceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Add form state
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [urlError, setUrlError] = useState("");

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editUrlError, setEditUrlError] = useState("");

  const loadLinks = useCallback(async () => {
    const { data } = await supabase.from("admin_reference_links").select("*").order("display_order");
    if (data && data.length > 0) {
      setLinks(data as ReferenceLink[]);
    } else if (data && data.length === 0) {
      // Seed defaults
      const inserts = DEFAULT_LINKS.map((l) => ({ ...l }));
      const { data: inserted } = await supabase.from("admin_reference_links").insert(inserts).select();
      if (inserted) setLinks(inserted as ReferenceLink[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  const validateUrl = (url: string) => {
    if (!url.startsWith("http://") && !url.startsWith("https://")) return "URL must start with http:// or https://";
    return "";
  };

  const handleAdd = async () => {
    const err = validateUrl(newUrl);
    if (err) { setUrlError(err); return; }
    const maxOrder = links.reduce((m, l) => Math.max(m, l.display_order), -1);
    const { data } = await supabase.from("admin_reference_links").insert({ title: newTitle.trim(), url: newUrl.trim(), description: newDesc.trim(), display_order: maxOrder + 1 }).select().single();
    if (data) setLinks([...links, data as ReferenceLink]);
    setNewTitle(""); setNewUrl(""); setNewDesc(""); setUrlError(""); setShowAddForm(false);
  };

  const startEdit = (link: ReferenceLink) => {
    setEditingId(link.id);
    setEditTitle(link.title);
    setEditUrl(link.url);
    setEditDesc(link.description);
    setEditUrlError("");
  };

  const handleEditSave = async () => {
    const err = validateUrl(editUrl);
    if (err) { setEditUrlError(err); return; }
    await supabase.from("admin_reference_links").update({ title: editTitle.trim(), url: editUrl.trim(), description: editDesc.trim(), updated_at: new Date().toISOString() }).eq("id", editingId!);
    setLinks(links.map((l) => l.id === editingId ? { ...l, title: editTitle.trim(), url: editUrl.trim(), description: editDesc.trim() } : l));
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("admin_reference_links").delete().eq("id", id);
    setLinks(links.filter((l) => l.id !== id));
    setDeleteConfirmId(null);
  };

  if (loading) return <div className="flex items-center justify-center py-32"><div className="w-6 h-6 rounded-full border-2 border-primary-container border-t-transparent animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-on-surface font-extrabold uppercase tracking-tight text-sm">External References</h2>
          <p className="text-on-surface-variant text-xs mt-1">Manage external links and resources for the AthleteLab team. Add, edit, or remove links using the cards below.</p>
        </div>
        {!showAddForm && (
          <button onClick={() => setShowAddForm(true)} className="h-8 px-4 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all shrink-0 ml-4 flex items-center gap-1.5">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
            Add Link
          </button>
        )}
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-surface-container border border-outline-variant/10 rounded-xl p-4 space-y-3">
          <div>
            <label className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-1">
              Link Title
              <span className="material-symbols-outlined text-on-surface-variant/40 cursor-help" style={{ fontSize: 12 }} title="The display name for this link.">info</span>
            </label>
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder='e.g. rtmlib Documentation' className="mt-1 w-full h-9 bg-surface-container-lowest border border-outline-variant/10 rounded-lg px-3 text-on-surface text-xs focus:outline-none focus:border-primary-container/30 transition-colors" />
          </div>
          <div>
            <label className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-1">
              URL
              <span className="material-symbols-outlined text-on-surface-variant/40 cursor-help" style={{ fontSize: 12 }} title="Full URL including https://">info</span>
            </label>
            <input value={newUrl} onChange={(e) => { setNewUrl(e.target.value); setUrlError(""); }} placeholder="https://..." className={`mt-1 w-full h-9 bg-surface-container-lowest border rounded-lg px-3 text-on-surface text-xs focus:outline-none transition-colors ${urlError ? "border-red-500" : "border-outline-variant/10 focus:border-primary-container/30"}`} />
            {urlError && <p className="text-red-500 text-[10px] mt-1">{urlError}</p>}
          </div>
          <div>
            <label className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-1">
              Description
              <span className="material-symbols-outlined text-on-surface-variant/40 cursor-help" style={{ fontSize: 12 }} title="One line description shown under the link title.">info</span>
            </label>
            <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Brief description of what this link contains..." className="mt-1 w-full h-9 bg-surface-container-lowest border border-outline-variant/10 rounded-lg px-3 text-on-surface text-xs focus:outline-none focus:border-primary-container/30 transition-colors" />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleAdd} disabled={!newTitle.trim() || !newUrl.trim()} className="h-8 px-4 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all disabled:opacity-50">Add Link</button>
            <button onClick={() => { setShowAddForm(false); setNewTitle(""); setNewUrl(""); setNewDesc(""); setUrlError(""); }} className="text-on-surface-variant font-black uppercase tracking-[0.2em] text-[10px] hover:text-on-surface transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Link cards */}
      {links.length === 0 && !showAddForm && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-xl bg-surface-container flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 32 }}>link</span>
          </div>
          <p className="text-on-surface-variant text-xs">No links added yet. Click Add Link to get started.</p>
        </div>
      )}

      <div className="space-y-3">
        {links.map((link) => (
          <div key={link.id} className="bg-surface-container border border-outline-variant/10 rounded-xl p-4 group hover:border-primary-container/20 transition-colors">
            {editingId === link.id ? (
              <div className="space-y-3">
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full h-9 bg-surface-container-lowest border border-outline-variant/10 rounded-lg px-3 text-on-surface text-xs focus:outline-none focus:border-primary-container/30 transition-colors" />
                <input value={editUrl} onChange={(e) => { setEditUrl(e.target.value); setEditUrlError(""); }} className={`w-full h-9 bg-surface-container-lowest border rounded-lg px-3 text-on-surface text-xs focus:outline-none transition-colors ${editUrlError ? "border-red-500" : "border-outline-variant/10 focus:border-primary-container/30"}`} />
                {editUrlError && <p className="text-red-500 text-[10px] mt-1">{editUrlError}</p>}
                <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="w-full h-9 bg-surface-container-lowest border border-outline-variant/10 rounded-lg px-3 text-on-surface text-xs focus:outline-none focus:border-primary-container/30 transition-colors" />
                <div className="flex items-center gap-3 pt-1">
                  <button onClick={handleEditSave} className="h-8 px-4 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-on-surface-variant font-black uppercase tracking-[0.2em] text-[10px] hover:text-on-surface transition-colors">Cancel</button>
                </div>
              </div>
            ) : deleteConfirmId === link.id ? (
              <div className="flex items-center justify-between">
                <p className="text-on-surface text-xs">Delete "<span className="font-bold">{link.title}</span>"?</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => handleDelete(link.id)} className="h-8 px-4 rounded-full bg-red-600 text-on-surface font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all">Delete</button>
                  <button onClick={() => setDeleteConfirmId(null)} className="text-on-surface-variant font-black uppercase tracking-[0.2em] text-[10px] hover:text-on-surface transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-on-surface font-bold text-sm hover:text-primary-container transition-colors">{link.title}</a>
                  <p className="text-on-surface-variant text-xs mt-0.5">{link.description}</p>
                  <p className="text-on-surface-variant/40 text-[10px] mt-1 truncate">{link.url}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(link)} className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors" title="Edit">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                  </button>
                  <button onClick={() => setDeleteConfirmId(link.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-red-500 hover:bg-surface-container-high transition-colors" title="Delete">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                  </button>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors" title="Open link">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AdminReferencePanel                                                */
/* ------------------------------------------------------------------ */

export function AdminReferencePanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>("agent_briefing");

  return (
    <div className="fixed inset-0 z-50 bg-surface flex flex-col">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 bg-surface/80 backdrop-blur-xl border-b border-white/10 shrink-0">
        <div>
          <h1 className="text-on-surface font-black uppercase tracking-tighter text-lg">Admin Reference</h1>
          <p className="text-on-surface-variant text-[10px] font-medium uppercase tracking-widest">
            Onboarding context and handoff prompt for AthleteLab node configuration
          </p>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors" title="Close">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
        </button>
      </div>

      {/* Tab selector */}
      <div className="px-6 pt-5 pb-2 max-w-6xl mx-auto w-full">
        <div className="flex flex-wrap gap-6">
          {TAB_SECTIONS.map((section) => (
            <div key={section.label} className="flex flex-col gap-1.5">
              <span className="text-on-surface-variant/50 text-[9px] font-semibold uppercase tracking-[0.3em] px-1">{section.label}</span>
              <div className="inline-flex bg-surface-container rounded-full p-1 border border-outline-variant/10 gap-0.5">
                {section.tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-full font-black uppercase tracking-[0.12em] text-[10px] transition-all ${
                      activeTab === tab.id
                        ? "bg-primary-container text-[#00460a]"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto p-6 mx-auto w-full ${activeTab === "data_dictionary" || activeTab === "enhancements" || activeTab === "pipeline_setup" || activeTab === "implementation_docs" ? "max-w-6xl" : "max-w-4xl"}`}>
        {activeTab === "agent_briefing" && <PromptTab tabKey="agent_briefing" />}
        {activeTab === "node_builder" && <PromptTab tabKey="node_builder" />}
        {activeTab === "architecture" && <PromptTab tabKey="architecture" />}
        {activeTab === "links" && <LinksTab />}
        {activeTab === "pipeline_setup" && <PipelineSetupTab />}
        {activeTab === "implementation_docs" && <ImplementationDocsTab />}
        {activeTab === "enhancements" && <EnhancementsTab />}
        {activeTab === "data_dictionary" && <DataDictionaryTab />}
      </div>
    </div>
  );
}
