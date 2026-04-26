/**
 * SectionTooltip — small info popover used throughout the athlete-lab editors.
 *
 * Slice C.2 audit (2026-04-26): a "Function components cannot be given refs"
 * warning was investigated as the suspected source. Audit confirmed:
 *   `rg "<SectionTooltip[^>]*\\bref=" src/ --include='*.tsx'` → 0 matches.
 * No caller forwards a ref to this component, so React's forwardRef machinery
 * is not required here. The internal `useRef<HTMLDivElement>` on the wrapper
 * div is for click-outside handling only and does not surface to callers.
 *
 * If a future caller needs to forward a ref, wrap this in
 * `React.forwardRef<HTMLDivElement, SectionTooltipProps>` and merge the
 * forwarded ref with the internal click-outside ref.
 */
import { useState, useRef, useEffect } from "react";

interface SectionTooltipProps {
  tip: string;
}

export function SectionTooltip({ tip }: SectionTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center ml-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-4 h-4 rounded-full bg-surface-container-highest text-on-surface-variant text-xs flex items-center justify-center hover:bg-outline-variant/40 transition-colors shrink-0"
        aria-label="Info"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>info</span>
      </button>
      {open && (
        <div className="absolute left-6 top-0 z-50 w-72 p-3 rounded-xl bg-surface-container-high border border-white/10 text-on-surface-variant text-xs leading-relaxed shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {tip}
        </div>
      )}
    </div>
  );
}
