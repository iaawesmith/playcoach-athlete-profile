import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";
import { useAthleteStore } from "@/store/athleteStore";
import {
  useAutoFill,
  fieldLabels,
  imageLabels,
  formatDisplayValue,
} from "@/hooks/useAutoFill";
import { ProCard } from "@/features/builder/components/ProCard";

const STATUS_MESSAGES = [
  "Searching 247Sports, Rivals, On3...",
  "Scanning ESPN profiles...",
  "Checking school roster...",
  "Locating action photos...",
  "Finding measurables...",
  "Analyzing results...",
];



export function ProfilePreview() {
  const navigate = useNavigate();
  const { role, athleteTier, completeOnboarding } = useUserStore();
  const store = useAthleteStore();
  const { teamColor } = store;

  const autoFill = useAutoFill();
  const [msgIndex, setMsgIndex] = useState(0);
  const [segmentCount, setSegmentCount] = useState(0);

  // Rotate status messages during scraping
  useEffect(() => {
    if (autoFill.status !== "scraping") return;
    setMsgIndex(0);
    setSegmentCount(0);

    const msgTimer = setInterval(() => {
      setMsgIndex((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 2500);

    const segTimer = setInterval(() => {
      setSegmentCount((c) => Math.min(c + 1, 10));
    }, 1500);

    return () => {
      clearInterval(msgTimer);
      clearInterval(segTimer);
    };
  }, [autoFill.status]);

  

  const handleComplete = () => {
    completeOnboarding();
    if (role === "athlete" && athleteTier === "college") {
      navigate("/builder");
    } else if (role === "coach" || role === "trainer") {
      navigate("/coach-dashboard");
    } else {
      navigate("/agency-dashboard");
    }
  };

  const handleApply = async () => {
    await autoFill.apply();
  };

  const tc = teamColor || "#50C4CA";

  return (
    <div className="space-y-8">
      <h1 className="text-on-surface font-black text-3xl md:text-4xl uppercase tracking-tight text-center">
        Let's Auto-Populate Your Profile
      </h1>

      {/* ProCard — same component as builder */}
      <div className="flex justify-center">
        <div className="w-full max-w-sm">
          <ProCard />
        </div>
      </div>


      {/* Auto-Fill States */}
      {autoFill.status === "idle" && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={autoFill.scrape}
            disabled={!autoFill.canScrape}
            className="w-full rounded-xl p-5 flex items-center gap-4 transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed group"
            style={{ backgroundColor: `${tc}15`, border: `1px solid ${tc}30` }}
          >
            <span className="material-symbols-outlined text-2xl" style={{ color: tc }}>
              auto_fix_high
            </span>
            <div className="text-left flex-1">
              <span className="text-on-surface text-sm font-black uppercase tracking-wide block">
                Auto-Populate My Profile
              </span>
              <span className="text-on-surface-variant text-[11px]">
                We'll search recruiting sites, ESPN & school rosters to fill in your data
              </span>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant text-base group-hover:translate-x-0.5 transition-transform">
              arrow_forward
            </span>
          </button>
          <button
            type="button"
            onClick={handleComplete}
            className="w-full text-center text-on-surface-variant text-xs font-bold uppercase tracking-[0.2em] hover:underline active:scale-95 transition-all duration-150 py-2"
          >
            Skip
          </button>
        </div>
      )}

      {autoFill.status === "scraping" && (
        <div className="space-y-4 py-2">
          <div className="flex gap-0.5 w-full">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-1.5 rounded-sm transition-all duration-700"
                style={{
                  backgroundColor: i < segmentCount ? "#50C4CA" : "hsl(var(--surface-container-high))",
                }}
              />
            ))}
          </div>
          <p
            key={msgIndex}
            className="text-on-surface text-sm font-medium text-center animate-fade-in"
          >
            {STATUS_MESSAGES[msgIndex]}
          </p>
          <p className="text-on-surface-variant text-[11px] text-center">
            Searching for {autoFill.fullName}...
          </p>
        </div>
      )}

      {autoFill.status === "applying" && (
        <div className="space-y-3 py-2 text-center">
          <span className="material-symbols-outlined text-2xl animate-spin" style={{ color: tc }}>
            progress_activity
          </span>
          <p className="text-on-surface text-sm font-bold uppercase tracking-wide">
            Applying Data...
          </p>
          <p className="text-on-surface-variant text-[11px]">
            Uploading images and filling your profile...
          </p>
        </div>
      )}

      {autoFill.status === "error" && (
        <div className="rounded-xl p-4 space-y-3 bg-surface-container">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#d53d18] text-xl">error</span>
            <span className="text-on-surface text-sm font-bold uppercase tracking-wide">
              No Results Found
            </span>
          </div>
          <p className="text-on-surface-variant text-xs">{autoFill.errorMessage}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={autoFill.scrape}
              className="text-xs font-bold uppercase tracking-wide hover:underline"
              style={{ color: tc }}
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={autoFill.dismiss}
              className="text-on-surface-variant text-xs font-bold uppercase tracking-wide hover:underline"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {(autoFill.status === "results" || autoFill.status === "done") && (
        <div className="space-y-4">
          {autoFill.status === "results" && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-xl" style={{ color: tc }}>
                    fact_check
                  </span>
                  <span className="text-on-surface text-sm font-bold uppercase tracking-wide">
                    Data Found
                  </span>
                </div>
                <span className="text-on-surface-variant text-[10px] uppercase tracking-widest">
                  {autoFill.totalItems} items
                </span>
              </div>

              {autoFill.sources.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {autoFill.sources.map((src) => {
                    const domain = (() => {
                      try { return new URL(src).hostname.replace("www.", ""); } catch { return src; }
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
              {autoFill.availableImages.length > 0 && (
                <div className="space-y-2">
                  <span className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.4em] block">
                    Photos
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {autoFill.availableImages.map((imgKey) => {
                      const url = autoFill.imageUrls![imgKey]!;
                      const selected = autoFill.selectedImages.has(imgKey);
                      const isActionPhoto = imgKey === "actionPhoto";
                      return (
                        <button
                          key={imgKey}
                          type="button"
                          onClick={() => autoFill.toggleImage(imgKey)}
                          className="relative rounded-lg overflow-hidden aspect-square bg-surface-container-lowest group transition-all duration-200"
                          style={{
                            outline: selected ? `2px solid ${tc}` : "2px solid transparent",
                            outlineOffset: "-2px",
                          }}
                        >
                          <img
                            src={url}
                            alt={imageLabels[imgKey]}
                            className="w-full h-full object-cover"
                            onError={() => {
                              if (isActionPhoto) {
                                autoFill.handleActionPhotoError();
                              }
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
                              borderColor: selected ? tc : "rgba(68,72,76,0.6)",
                              backgroundColor: selected ? tc : "rgba(0,0,0,0.5)",
                            }}
                          >
                            {selected && (
                              <span className="material-symbols-outlined text-[12px] text-surface">check</span>
                            )}
                          </div>
                          {/* Compact corner control for cycling action photo candidates */}
                          {isActionPhoto && autoFill.hasMultipleActionPhotos && (
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                autoFill.nextActionPhoto();
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.stopPropagation();
                                  autoFill.nextActionPhoto();
                                }
                              }}
                              className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-surface/80 backdrop-blur-sm rounded-full px-2 py-0.5 cursor-pointer hover:bg-surface/90 transition-colors duration-150 z-10"
                            >
                              <span className="material-symbols-outlined text-[14px] text-on-surface">
                                refresh
                              </span>
                              <span className="text-[8px] font-bold uppercase tracking-widest text-on-surface-variant">
                                {autoFill.activeActionPhotoIndex + 1}/{autoFill.actionPhotoCandidateCount}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Text fields */}
              {autoFill.availableFields.length > 0 && (
                <div className="space-y-1">
                  {autoFill.availableImages.length > 0 && (
                    <span className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.4em] block mb-2">
                      Profile Data
                    </span>
                  )}
                  {autoFill.availableFields.map((field) => (
                    <button
                      key={field}
                      type="button"
                      onClick={() => autoFill.toggleField(field)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-container-high transition-colors duration-150 text-left"
                    >
                      <span
                        className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors duration-150"
                        style={{
                          borderColor: autoFill.selectedFields.has(field) ? tc : "rgba(68,72,76,0.4)",
                          backgroundColor: autoFill.selectedFields.has(field) ? tc : "transparent",
                        }}
                      >
                        {autoFill.selectedFields.has(field) && (
                          <span className="material-symbols-outlined text-[12px] text-surface">check</span>
                        )}
                      </span>
                      <span className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-widest w-28 shrink-0">
                        {fieldLabels[field] || field}
                      </span>
                      <span className="text-on-surface text-sm font-normal truncate flex-1">
                        {formatDisplayValue(field, autoFill.scrapedData?.[field])}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={autoFill.totalSelected === 0}
                  className="flex-1 rounded-full h-10 font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: tc, color: "white" }}
                >
                  Apply Selected
                </button>
                <button
                  type="button"
                  onClick={autoFill.dismiss}
                  className="glass-card border border-outline-variant/20 text-on-surface rounded-full h-10 px-5 font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-150"
                >
                  Skip
                </button>
              </div>
            </>
          )}

          {autoFill.status === "done" && (
            <div className="flex items-center gap-3 justify-center py-2">
              <span className="material-symbols-outlined text-xl" style={{ color: tc }}>
                check_circle
              </span>
              <span className="text-on-surface text-sm font-bold uppercase tracking-wide">
                Profile Updated
              </span>
            </div>
          )}
        </div>
      )}

      {/* CTA — only after apply */}
      {autoFill.status === "done" && (
        <button
          onClick={handleComplete}
          className="w-full py-3.5 rounded-full font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-200"
          style={{ backgroundColor: "#50C4CA", color: "white" }}
        >
          Enter Brand HQ →
        </button>
      )}
    </div>
  );
}
