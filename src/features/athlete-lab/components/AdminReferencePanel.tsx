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

export function AdminReferencePanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>("agent_briefing");
  const [prompts, setPrompts] = useState<Record<string, string>>({
    agent_briefing: TAB_CONFIG.agent_briefing.placeholder,
    node_builder: TAB_CONFIG.node_builder.placeholder,
  });
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("admin_tab_guidance")
        .select("tab_key, content")
        .in("tab_key", ["agent_briefing", "node_builder", "handoff_prompt"]);
      if (data) {
        const updates: Record<string, string> = {};
        for (const row of data) {
          if (row.tab_key === "handoff_prompt" || row.tab_key === "agent_briefing") {
            updates.agent_briefing = row.content;
          }
          if (row.tab_key === "node_builder") {
            updates.node_builder = row.content;
          }
        }
        if (Object.keys(updates).length) {
          setPrompts((prev) => ({ ...prev, ...updates }));
        }
      }
    };
    load();
  }, []);

  const handleCopy = async (tabKey: string) => {
    try {
      await navigator.clipboard.writeText(prompts[tabKey] || "");
      setCopiedTab(tabKey);
      setTimeout(() => setCopiedTab(null), 2000);
    } catch {
      // fallback
    }
  };

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
        {activeTab !== "data_dictionary" ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-on-surface font-extrabold uppercase tracking-tight text-sm">
                {TAB_CONFIG[activeTab].title}
              </h2>
              <p className="text-on-surface-variant text-xs mt-1">
                {TAB_CONFIG[activeTab].subtitle}
              </p>
            </div>

            <textarea
              readOnly
              value={prompts[activeTab] || ""}
              className="w-full min-h-[500px] bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-4 text-on-surface text-xs font-mono leading-relaxed resize-y focus:outline-none"
            />

            <button
              onClick={() => handleCopy(activeTab)}
              className={`w-full h-11 rounded-full font-black uppercase tracking-[0.2em] text-[10px] transition-all active:scale-95 ${
                copiedTab === activeTab
                  ? "kinetic-gradient text-[#00460a]"
                  : "kinetic-gradient text-[#00460a]"
              }`}
            >
              {copiedTab === activeTab ? "✓ COPIED!" : "COPY TO CLIPBOARD"}
            </button>
          </div>
        ) : (
          /* Data Dictionary — empty state */
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 32 }}>
                database
              </span>
            </div>
            <p className="text-on-surface font-bold text-sm">Coming soon</p>
            <p className="text-on-surface-variant text-xs mt-1 max-w-xs">
              Field definitions and schema reference will be documented here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
