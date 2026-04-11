import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_HANDOFF_PROMPT = `[Paste the full contents of athletelab_admin_handoff_prompt.md here]`;

const TAB_KEY = "handoff_prompt";

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

export function AdminReferencePanel({ onClose }: { onClose: () => void }) {
  const [prompt, setPrompt] = useState(DEFAULT_HANDOFF_PROMPT);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("admin_tab_guidance")
        .select("content")
        .eq("tab_key", TAB_KEY)
        .maybeSingle();
      if (data?.content) {
        setPrompt(data.content);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("admin_tab_guidance")
        .select("id")
        .eq("tab_key", TAB_KEY)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("admin_tab_guidance")
          .update({ content: prompt, updated_at: new Date().toISOString() })
          .eq("tab_key", TAB_KEY);
      } else {
        await supabase
          .from("admin_tab_guidance")
          .insert({ tab_key: TAB_KEY, content: prompt });
      }
      setEditing(false);
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-8">
        {/* Section 1 — Handoff Prompt */}
        <section className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-on-surface font-extrabold uppercase tracking-tight text-sm">Agent Handoff Prompt</h2>
              <p className="text-on-surface-variant text-xs mt-1">
                Copy this into any new Claude conversation to instantly onboard a new agent or admin on AthleteLab, the rtmlib pipeline, and node configuration standards.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              {editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="h-8 px-4 rounded-full bg-surface-container border border-outline-variant/10 text-on-surface-variant font-black uppercase tracking-[0.2em] text-[10px] hover:bg-surface-container-high transition-all active:scale-95"
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

          {savedFeedback && (
            <div className="flex items-center gap-2 text-primary-container text-xs font-semibold">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
              Saved successfully
            </div>
          )}

          <textarea
            readOnly={!editing}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className={`w-full min-h-[400px] bg-surface-container-lowest border rounded-xl p-4 text-on-surface text-xs font-mono leading-relaxed resize-y focus:outline-none transition-colors ${
              editing
                ? "border-primary-container/30 focus:border-primary-container/50"
                : "border-outline-variant/10"
            }`}
          />

          <button
            onClick={handleCopy}
            className="h-10 px-6 rounded-full bg-surface-container-high border border-outline-variant/10 text-on-surface font-black uppercase tracking-[0.2em] text-[10px] hover:bg-surface-container-highest transition-all active:scale-95"
          >
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
        </section>

        {/* Section 2 — Quick Links */}
        <section className="space-y-3">
          <h2 className="text-on-surface font-extrabold uppercase tracking-tight text-sm">Quick References</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {QUICK_LINKS.map((link) => (
              <a
                key={link.title}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-surface-container border border-outline-variant/10 rounded-xl p-4 hover:bg-surface-container-high transition-colors group"
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
      </div>
    </div>
  );
}
