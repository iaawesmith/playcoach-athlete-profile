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
