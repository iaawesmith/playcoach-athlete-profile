import {
  useAutoFill,
  fieldLabels,
  imageLabels,
  formatDisplayValue,
  type AutoFillStatus,
} from "@/hooks/useAutoFill";

type ImageKey = "headshot" | "actionPhoto" | "schoolLogo";

export const ScrapeFill = () => {
  const {
    status,
    canScrape,
    fullName,
    scrape,
    apply,
    dismiss,
    scrapedData,
    imageUrls,
    sources,
    selectedFields,
    selectedImages,
    toggleField,
    toggleImage,
    availableFields,
    availableImages,
    errorMessage,
    totalSelected,
    totalItems,
  } = useAutoFill();

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

  if (status === "scraping") {
    return (
      <div className="w-full bg-surface-container rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-xl animate-spin">progress_activity</span>
          <span className="text-on-surface text-sm font-bold uppercase tracking-wide">
            Searching the Web...
          </span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 bg-surface-container-high rounded animate-pulse" style={{ width: `${70 - i * 15}%` }} />
          ))}
        </div>
        <p className="text-on-surface-variant text-[11px]">
          Searching recruiting sites, ESPN, and school rosters for {fullName}...
        </p>
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
          {sources.map((src) => {
            const domain = (() => {
              try {
                return new URL(src).hostname.replace("www.", "");
              } catch {
                return src;
              }
            })();
            return (
              <span
                key={src}
                className="text-[9px] font-semibold uppercase tracking-widest text-on-surface-variant bg-surface-container-high rounded px-2 py-0.5"
              >
                {domain}
              </span>
            );
          })}
        </div>
      )}

      {/* Image previews */}
      {availableImages.length > 0 && (
        <div className="space-y-2">
          <span className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.4em] block">
            Photos
          </span>
          <div className="grid grid-cols-3 gap-2">
            {availableImages.map((imgKey) => {
              const url = imageUrls?.[imgKey];
              if (!url) return null;
              const selected = selectedImages.has(imgKey);
              return (
                <div key={imgKey} className="relative">
                  <button
                    type="button"
                    onClick={() => toggleImage(imgKey)}
                    className="relative rounded-lg overflow-hidden aspect-square bg-surface-container-lowest group transition-all duration-200 w-full"
                    style={{
                      outline: selected ? `2px solid var(--team-color, #00e639)` : "2px solid transparent",
                      outlineOffset: "-2px",
                    }}
                  >
                    <img
                      src={url}
                      alt={imageLabels[imgKey]}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.opacity = "0";
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-surface via-surface/80 to-transparent pt-6 pb-1.5 px-1.5 flex items-end">
                      <span className="text-[8px] font-bold uppercase tracking-widest text-on-surface">
                        {imageLabels[imgKey]}
                      </span>
                    </div>
                    <div
                      className="absolute top-1.5 right-1.5 w-4 h-4 rounded border flex items-center justify-center"
                      style={{
                        borderColor: selected ? "var(--team-color, #00e639)" : "rgba(68,72,76,0.6)",
                        backgroundColor: selected ? "var(--team-color, #00e639)" : "rgba(0,0,0,0.5)",
                      }}
                    >
                      {selected && (
                        <span className="material-symbols-outlined text-[12px] text-surface">check</span>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Text fields */}
      {availableFields.length > 0 && (
        <div className="space-y-1">
          {availableImages.length > 0 && (
            <span className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.4em] block mb-2">
              Profile Data
            </span>
          )}
          {availableFields.map((field) => (
            <button
              key={field}
              type="button"
              onClick={() => toggleField(field)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-container-high transition-colors duration-150 text-left"
            >
              <span
                className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors duration-150"
                style={{
                  borderColor: selectedFields.has(field) ? "var(--team-color, #00e639)" : "rgba(68,72,76,0.4)",
                  backgroundColor: selectedFields.has(field) ? "var(--team-color, #00e639)" : "transparent",
                }}
              >
                {selectedFields.has(field) && (
                  <span className="material-symbols-outlined text-[12px] text-surface">check</span>
                )}
              </span>
              <span className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-widest w-28 shrink-0">
                {fieldLabels[field] || field}
              </span>
              <span className="text-on-surface text-sm font-normal truncate flex-1">
                {formatDisplayValue(field, scrapedData?.[field])}
              </span>
            </button>
          ))}
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
