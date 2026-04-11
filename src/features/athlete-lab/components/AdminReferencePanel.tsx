import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type TabId = "agent_briefing" | "node_builder" | "data_dictionary";

const TABS: { id: TabId; label: string }[] = [
  { id: "agent_briefing", label: "AGENT BRIEFING" },
  { id: "node_builder", label: "NODE BUILDER" },
  { id: "data_dictionary", label: "DATA DICTIONARY" },
];

const TAB_CONFIG: Record<
  "agent_briefing" | "node_builder",
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
};

const QUICK_LINKS = [
  {
    title: "Keypoint Library",
    subtitle: "Full 133-keypoint COCO-WholeBody schema",
    url: "https://github.com/iaawesmith/playcoach-athlete-profile/blob/main/src/constants/keypointLibrary.json",
  },
  {
    title: "rtmlib Documentation",
    subtitle: "RTMPose/RTMW deployment library",
    url: "https://github.com/Tau-J/rtmlib",
  },
  {
    title: "MMPose Model Zoo",
    subtitle: "Full RTMPose model performance benchmarks",
    url: "https://github.com/open-mmlab/mmpose/tree/dev-1.x/projects/rtmpose",
  },
  {
    title: "Supabase Dashboard",
    subtitle: "Database, storage, and edge functions",
    url: "https://supabase.com/dashboard",
  },
];

function QuickLinks() {
  return (
    <section className="space-y-3 pt-6 mt-6 border-t border-outline-variant/10">
      <h2 className="text-on-surface font-extrabold uppercase tracking-tight text-sm">Quick References</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {QUICK_LINKS.map((link) => (
          <a
            key={link.title}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-surface-container border border-outline-variant/10 rounded-xl p-4 hover:border-primary-container/30 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="text-on-surface font-bold text-sm">{link.title}</span>
              <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-on-surface-variant transition-colors" style={{ fontSize: 16 }}>open_in_new</span>
            </div>
            <p className="text-on-surface-variant text-xs mt-1">{link.subtitle}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

function PromptTab({ tabKey }: { tabKey: "agent_briefing" | "node_builder" }) {
  const config = TAB_CONFIG[tabKey];
  const [content, setContent] = useState(config.placeholder);
  const [savedContent, setSavedContent] = useState(config.placeholder);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      // Try the specific tab key first, fall back to "handoff_prompt" for agent_briefing
      const keys = tabKey === "agent_briefing" ? [tabKey, "handoff_prompt"] : [tabKey];
      const { data } = await supabase
        .from("admin_tab_guidance")
        .select("tab_key, content")
        .in("tab_key", keys);
      if (data && data.length > 0) {
        // Prefer the specific key over the legacy key
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
      const { data: existing } = await supabase
        .from("admin_tab_guidance")
        .select("id")
        .eq("tab_key", tabKey)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("admin_tab_guidance")
          .update({ content, updated_at: new Date().toISOString() })
          .eq("tab_key", tabKey);
      } else {
        await supabase
          .from("admin_tab_guidance")
          .insert({ tab_key: tabKey, content });
      }
      setSavedContent(content);
      setEditing(false);
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    } catch {
      // silent
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
    } catch {
      // silent
    }
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
              <button
                onClick={handleCancel}
                className="h-8 px-4 rounded-full text-on-surface-variant font-black uppercase tracking-[0.2em] text-[10px] hover:text-on-surface transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-8 px-4 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="h-8 px-4 rounded-full bg-surface-container border border-outline-variant/10 text-on-surface-variant font-black uppercase tracking-[0.2em] text-[10px] hover:bg-surface-container-high transition-all active:scale-95 flex items-center gap-1.5"
            >
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
          editing
            ? "border-primary-container/30 focus:border-primary-container/50"
            : "border-outline-variant/10 text-on-surface/70"
        }`}
      />

      <button
        onClick={handleCopy}
        className="w-full h-11 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all"
      >
        {copied ? "✓ COPIED!" : "COPY TO CLIPBOARD"}
      </button>

      <QuickLinks />
    </div>
  );
}

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
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          title="Close"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
        </button>
      </div>

      {/* Tab selector */}
      <div className="px-6 pt-5 pb-2 max-w-4xl mx-auto w-full">
        <div className="inline-flex bg-surface-container rounded-full p-1 border border-outline-variant/10">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-full font-black uppercase tracking-[0.15em] text-[10px] transition-all ${
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
        {activeTab === "agent_briefing" && <PromptTab tabKey="agent_briefing" />}
        {activeTab === "node_builder" && <PromptTab tabKey="node_builder" />}
        {activeTab === "data_dictionary" && (
          <div className="space-y-0">
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-16 h-16 rounded-xl bg-surface-container flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 32 }}>database</span>
              </div>
              <p className="text-on-surface font-bold text-sm">Coming soon</p>
              <p className="text-on-surface-variant text-xs mt-1 max-w-xs">
                Field definitions and schema reference will be documented here.
              </p>
            </div>
            <QuickLinks />
          </div>
        )}
      </div>
    </div>
  );
}
