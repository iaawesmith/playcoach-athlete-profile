import { useState } from "react";
import {
  useAutoFill,
  fieldLabels,
  formatDisplayValue,
  type AutoFillStatus,
} from "@/hooks/useAutoFill";


export const ScrapeFill = () => {
  const {
    status,
    canScrape,
    fullName,
    scrape,
    apply,
    dismiss,
    confirmIdentity,
    rejectIdentity,
    confirmCandidate,
    enrichedFields,
    selectedKeys,
    toggleField,
    sources,
    errorMessage,
    totalSelected,
    totalItems,
    missingFields,
  } = useAutoFill();

  const [showMissing, setShowMissing] = useState(false);

  if (status === "idle" || status === "done") {
    return (
      <button
        type="button"
        onClick={scrape}
        disabled={!canScrape}
        className="w-full bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-all duration-200 hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 group"
      >
        <span className="material-symbols-outlined text-primary text-xl">auto_fix_high</span>
        <div className="text-left flex-1">
          <span className="text-on-surface text-sm font-bold uppercase tracking-wide block">
            Auto-Fill from Web
          </span>
          <span className="text-on-surface-variant text-[11px]">
            {canScrape
              ? "Search recruiting sites, ESPN & school rosters for your profile data and photos"
              : "Enter your name first to enable web search"}
          </span>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant text-base group-hover:text-primary transition-colors">
          arrow_forward
        </span>
      </button>
    );
  }

  if (status === "resolving" || status === "enriching") {
    return (
      <div className="w-full bg-surface-container rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-xl animate-spin">progress_activity</span>
          <span className="text-on-surface text-sm font-bold uppercase tracking-wide">
            {status === "resolving" ? "Identifying Player..." : "Enriching Profile..."}
          </span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 bg-surface-container-high rounded animate-pulse" style={{ width: `${70 - i * 15}%` }} />
          ))}
        </div>
        <p className="text-on-surface-variant text-[11px]">
          {status === "resolving"
            ? `Looking up ${fullName} on CFBD...`
            : `Pulling data from CFBD, 247Sports, On3 for ${fullName}...`}
        </p>
      </div>
    );
  }

  if (status === "confirm" && confirmCandidate) {
    return (
      <div className="w-full bg-surface-container rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-xl">help</span>
          <span className="text-on-surface text-sm font-bold uppercase tracking-wide">
            Is this you?
          </span>
        </div>
        <p className="text-on-surface-variant text-xs">
          We found <span className="text-on-surface font-semibold">{confirmCandidate.name}</span>
          {confirmCandidate.position && <> — {confirmCandidate.position}</>}
          {confirmCandidate.school && <> at {confirmCandidate.school}</>}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={confirmIdentity}
            className="flex-1 kinetic-gradient text-[#00460a] rounded-full h-10 font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-150"
          >
            Yes, That's Me
          </button>
          <button
            type="button"
            onClick={rejectIdentity}
            className="glass-card border border-outline-variant/20 text-on-surface rounded-full h-10 px-5 font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-150"
          >
            No
          </button>
        </div>
      </div>
    );
  }

  if (status === "applying") {
    return (
      <div className="w-full bg-surface-container rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-xl animate-spin">progress_activity</span>
          <span className="text-on-surface text-sm font-bold uppercase tracking-wide">
            Applying Data...
          </span>
        </div>
        <p className="text-on-surface-variant text-[11px]">
          Uploading images and filling your profile...
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="w-full bg-surface-container rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[#d53d18] text-xl">error</span>
          <span className="text-on-surface text-sm font-bold uppercase tracking-wide">
            No Results Found
          </span>
        </div>
        <p className="text-on-surface-variant text-xs">{errorMessage}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={scrape}
            className="text-primary text-xs font-bold uppercase tracking-wide hover:underline"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="text-on-surface-variant text-xs font-bold uppercase tracking-wide hover:underline"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // results state
  return (
    <div className="w-full bg-surface-container rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-xl">fact_check</span>
          <span className="text-on-surface text-sm font-bold uppercase tracking-wide">
            Data Found
          </span>
        </div>
        <span className="text-on-surface-variant text-[10px] uppercase tracking-widest">
          {totalItems} items
        </span>
      </div>

      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sources.map((src) => (
            <span
              key={src}
              className="text-[9px] font-semibold uppercase tracking-widest text-on-surface-variant bg-surface-container-high rounded px-2 py-0.5"
            >
              {src}
            </span>
          ))}
        </div>
      )}

      {/* Field list */}
      {enrichedFields.length > 0 && (
        <div className="space-y-1">
          {enrichedFields.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => toggleField(entry.key)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-container-high transition-colors duration-150 text-left"
            >
              <span
                className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors duration-150"
                style={{
                  borderColor: selectedKeys.has(entry.key) ? "var(--team-color, #00e639)" : "rgba(68,72,76,0.4)",
                  backgroundColor: selectedKeys.has(entry.key) ? "var(--team-color, #00e639)" : "transparent",
                }}
              >
                {selectedKeys.has(entry.key) && (
                  <span className="material-symbols-outlined text-[12px] text-surface">check</span>
                )}
              </span>
              <span className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-widest w-28 shrink-0">
                {entry.label}
              </span>
              <span className="text-on-surface text-sm font-normal truncate flex-1">
                {formatDisplayValue(entry.key, entry.value)}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-on-surface-variant/50 bg-surface-container-highest/60 rounded px-1.5 py-0.5">
                {entry.source}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Missing fields */}
      {missingFields.length > 0 && (
        <div className="border-t border-white/5 pt-3">
          <button
            type="button"
            onClick={() => setShowMissing((prev) => !prev)}
            className="w-full flex items-center gap-2 px-1 py-1 text-left group"
          >
            <span className="material-symbols-outlined text-[#d53d18] text-base">warning</span>
            <span className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-widest flex-1">
              Data Not Found
            </span>
            <span className="text-on-surface-variant/60 text-[9px] font-semibold uppercase tracking-widest">
              {missingFields.length} fields
            </span>
            <span
              className="material-symbols-outlined text-on-surface-variant text-sm transition-transform duration-200"
              style={{ transform: showMissing ? "rotate(180deg)" : "rotate(0deg)" }}
            >
              expand_more
            </span>
          </button>
          {showMissing && (
            <div className="mt-2 space-y-0.5">
              {missingFields.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-left"
                >
                  <span className="text-on-surface-variant/40 text-[10px] font-semibold uppercase tracking-widest w-28 shrink-0">
                    {item.field}
                  </span>
                  <span className="text-on-surface-variant/30 text-[10px] truncate flex-1">
                    {item.reason}
                  </span>
                  <span
                    className="text-[9px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5"
                    style={{
                      color: "rgba(168,171,175,0.4)",
                      backgroundColor: "rgba(33,38,43,0.6)",
                    }}
                  >
                    {item.source}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={apply}
          disabled={totalSelected === 0}
          className="flex-1 kinetic-gradient text-[#00460a] rounded-full h-10 font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Apply Selected
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="glass-card border border-outline-variant/20 text-on-surface rounded-full h-10 px-5 font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-150"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};