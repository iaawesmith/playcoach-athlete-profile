import { useState, useEffect } from "react";

/* Phase 1c.3-D: One-time per-browser banner explaining the 13→8 tab
   consolidation. Mounted at the top of the editor surface. Dismissed
   state is persisted in localStorage so each user sees it once. The
   redirect list is explicit (not conceptual prose) per the slice
   approval clarification — every retired tab key has a named target
   plus the surviving sub-section name. Anchor redirects (URL hash) and
   HelpDrawer redirects ship alongside this banner; the banner exists to
   tell users why their bookmark / muscle-memory tab disappeared. */

const STORAGE_KEY = "athleteLab.consolidationBannerDismissed.v1";

export function ConsolidationRedirectBanner() {
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "true");
    }
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="mx-6 mt-4 rounded-xl border border-primary-container/30 bg-[#0E1319] px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span
            className="material-symbols-outlined text-primary-container shrink-0 mt-0.5"
            style={{ fontSize: 20 }}
            aria-hidden
          >
            info
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-on-surface font-extrabold uppercase tracking-widest text-[11px] mb-2">
              Tabs have been consolidated
            </div>
            <div className="text-on-surface-variant text-sm mb-2">
              Here&apos;s where things moved:
            </div>
            <ul className="space-y-1 text-on-surface-variant text-sm">
              <li>
                <span className="text-on-surface font-semibold">Filming Guidance</span>
                <span className="text-on-surface-variant"> → Reference (Filming Guidance section)</span>
              </li>
              <li>
                <span className="text-on-surface font-semibold">Scoring</span>
                <span className="text-on-surface-variant"> → Metrics (Scoring section)</span>
              </li>
              <li>
                <span className="text-on-surface font-semibold">Errors</span>
                <span className="text-on-surface-variant"> → Metrics (Common Errors section)</span>
              </li>
              <li>
                <span className="text-on-surface font-semibold">Checkpoints</span>
                <span className="text-on-surface-variant"> → Phases (Checkpoints section, shown when segmentation method is checkpoint-based)</span>
              </li>
              <li>
                <span className="text-on-surface font-semibold">Training Status</span>
                <span className="text-on-surface-variant"> → Basics (Pipeline Config section)</span>
              </li>
            </ul>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 px-4 py-2 rounded-xl bg-primary-container text-[#0b0f12] font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-150 hover:shadow-[0_0_12px_rgba(0,230,57,0.35)]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
