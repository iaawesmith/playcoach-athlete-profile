import { useState } from "react";

const HANDOFF_PROMPT = `[Paste the full contents of athletelab_admin_handoff_prompt.md here]`;

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
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(HANDOFF_PROMPT);
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
          <div>
            <h2 className="text-on-surface font-extrabold uppercase tracking-tight text-sm">Agent Handoff Prompt</h2>
            <p className="text-on-surface-variant text-xs mt-1">
              Copy this into any new Claude conversation to instantly onboard a new agent or admin on AthleteLab, the rtmlib pipeline, and node configuration standards.
            </p>
          </div>
          <textarea
            readOnly
            value={HANDOFF_PROMPT}
            className="w-full min-h-[400px] bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-4 text-on-surface text-xs font-mono leading-relaxed resize-y focus:outline-none"
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
