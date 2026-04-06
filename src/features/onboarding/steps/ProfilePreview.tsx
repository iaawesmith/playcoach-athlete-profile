import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";
import { useAthleteStore } from "@/store/athleteStore";
import { useAutoFill, fieldLabels, imageLabels, formatDisplayValue } from "@/hooks/useAutoFill";
import { ProCard } from "@/features/builder/components/ProCard";

const STATUS_MESSAGES = [
  "Searching 247Sports, Rivals, On3...",
  "Scanning ESPN profiles...",
  "Checking school roster...",
  "Locating action photos...",
  "Finding measurables...",
  "Analyzing results...",
];

const cardStyle: React.CSSProperties = { backgroundColor: "#2A2E33", border: "1px solid #3D434A" };

export function ProfilePreview() {
  const navigate = useNavigate();
  const { role, athleteTier, completeOnboarding } = useUserStore();
  const store = useAthleteStore();
  const { teamColor } = store;

  const autoFill = useAutoFill();
  const [msgIndex, setMsgIndex] = useState(0);
  const [segmentCount, setSegmentCount] = useState(0);

  useEffect(() => {
    if (autoFill.status !== "scraping") return;
    setMsgIndex(0);
    setSegmentCount(0);
    const msgTimer = setInterval(() => setMsgIndex((i) => (i + 1) % STATUS_MESSAGES.length), 2500);
    const segTimer = setInterval(() => setSegmentCount((c) => Math.min(c + 1, 10)), 1500);
    return () => { clearInterval(msgTimer); clearInterval(segTimer); };
  }, [autoFill.status]);

  const handleComplete = () => {
    completeOnboarding();
    if (role === "athlete" && athleteTier === "college") navigate("/builder");
    else if (role === "coach" || role === "trainer") navigate("/coach-dashboard");
    else navigate("/agency-dashboard");
  };

  const handleApply = async () => { await autoFill.apply(); };
  const tc = teamColor || "#4DC9C9";

  return (
    <div className="space-y-8">
      <h1 className="text-white font-black text-3xl md:text-4xl uppercase tracking-tight text-center">
        Let's Auto-Populate Your Profile
      </h1>

      {/* ProCard — unchanged */}
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
            className="w-full rounded-xl p-5 flex items-center gap-4 transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed group"
            style={{ ...cardStyle, boxShadow: `0 0 20px ${tc}15` }}
          >
            <span className="material-symbols-outlined text-2xl" style={{ color: tc }}>auto_fix_high</span>
            <div className="text-left flex-1">
              <span className="text-white text-sm font-black uppercase tracking-wide block">Auto-Populate My Profile</span>
              <span className="text-[11px]" style={{ color: "#8A8F94" }}>We'll search recruiting sites, ESPN & school rosters to fill in your data</span>
            </div>
            <span className="material-symbols-outlined text-base group-hover:translate-x-0.5 transition-transform" style={{ color: "#8A8F94" }}>arrow_forward</span>
          </button>
          <button type="button" onClick={handleComplete} className="w-full text-center text-xs font-bold uppercase tracking-[0.2em] hover:underline active:scale-95 transition-all duration-150 py-2" style={{ color: "#8A8F94" }}>
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
                style={{ backgroundColor: i < segmentCount ? "#4DC9C9" : "#1E242B" }}
              />
            ))}
          </div>
          <p key={msgIndex} className="text-white text-sm font-medium text-center animate-fade-in">{STATUS_MESSAGES[msgIndex]}</p>
          <p className="text-[11px] text-center" style={{ color: "#8A8F94" }}>Searching for {autoFill.fullName}...</p>
        </div>
      )}

      {autoFill.status === "applying" && (
        <div className="space-y-3 py-2 text-center">
          <span className="material-symbols-outlined text-2xl animate-spin" style={{ color: tc }}>progress_activity</span>
          <p className="text-white text-sm font-bold uppercase tracking-wide">Applying Data...</p>
          <p className="text-[11px]" style={{ color: "#8A8F94" }}>Uploading images and filling your profile...</p>
        </div>
      )}

      {autoFill.status === "error" && (
        <div className="rounded-xl p-4 space-y-3" style={cardStyle}>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-xl" style={{ color: "#d53d18" }}>error</span>
            <span className="text-white text-sm font-bold uppercase tracking-wide">No Results Found</span>
          </div>
          <p className="text-xs" style={{ color: "#8A8F94" }}>{autoFill.errorMessage}</p>
          <div className="flex gap-3">
            <button type="button" onClick={autoFill.scrape} className="text-xs font-bold uppercase tracking-wide hover:underline" style={{ color: tc }}>Try Again</button>
            <button type="button" onClick={autoFill.dismiss} className="text-xs font-bold uppercase tracking-wide hover:underline" style={{ color: "#8A8F94" }}>Skip</button>
          </div>
        </div>
      )}

      {(autoFill.status === "results" || autoFill.status === "done") && (
        <div className="space-y-4">
          {autoFill.status === "results" && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-xl" style={{ color: tc }}>fact_check</span>
                  <span className="text-white text-sm font-bold uppercase tracking-wide">Data Found</span>
                </div>
                <span className="text-[10px] uppercase tracking-widest" style={{ color: "#8A8F94" }}>{autoFill.totalItems} items</span>
              </div>

              {autoFill.sources.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {autoFill.sources.map((src) => {
                    const domain = (() => { try { return new URL(src).hostname.replace("www.", ""); } catch { return src; } })();
                    return (
                      <span key={src} className="text-[9px] font-semibold uppercase tracking-widest rounded px-2 py-0.5" style={{ color: "#8A8F94", backgroundColor: "#1E2227" }}>
                        {domain}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Image previews */}
              {autoFill.availableImages.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.4em] block" style={{ color: "#8A8F94" }}>Photos</span>
                  <div className="grid grid-cols-3 gap-2">
                    {autoFill.availableImages.map((imgKey) => {
                      const url = autoFill.imageUrls![imgKey]!;
                      const selected = autoFill.selectedImages.has(imgKey);
                      return (
                        <button
                          key={imgKey}
                          type="button"
                          onClick={() => autoFill.toggleImage(imgKey)}
                          className="relative rounded-lg overflow-hidden aspect-square group transition-all duration-200"
                          style={{
                            backgroundColor: "#1E2227",
                            outline: selected ? `2px solid ${tc}` : "2px solid transparent",
                            outlineOffset: "-2px",
                          }}
                        >
                          <img src={url} alt={imageLabels[imgKey]} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0"; }} />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#12161A] via-[#12161A]/80 to-transparent pt-6 pb-1.5 px-1.5 flex items-end">
                            <span className="text-[8px] font-bold uppercase tracking-widest text-white">{imageLabels[imgKey]}</span>
                          </div>
                          <div
                            className="absolute top-1.5 right-1.5 w-4 h-4 rounded border flex items-center justify-center"
                            style={{ borderColor: selected ? tc : "#3D434A", backgroundColor: selected ? tc : "rgba(0,0,0,0.5)" }}
                          >
                            {selected && <span className="material-symbols-outlined text-[12px]" style={{ color: "#12161A" }}>check</span>}
                          </div>
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
                    <span className="text-[10px] font-semibold uppercase tracking-[0.4em] block mb-2" style={{ color: "#8A8F94" }}>Profile Data</span>
                  )}
                  {autoFill.availableFields.map((field) => (
                    <button
                      key={field}
                      type="button"
                      onClick={() => autoFill.toggleField(field)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-150 text-left"
                      style={{ backgroundColor: "transparent" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#363B40"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                    >
                      <span
                        className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors duration-150"
                        style={{ borderColor: autoFill.selectedFields.has(field) ? tc : "#3D434A", backgroundColor: autoFill.selectedFields.has(field) ? tc : "transparent" }}
                      >
                        {autoFill.selectedFields.has(field) && <span className="material-symbols-outlined text-[12px]" style={{ color: "#12161A" }}>check</span>}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-widest w-28 shrink-0" style={{ color: "#8A8F94" }}>{fieldLabels[field] || field}</span>
                      <span className="text-white text-sm font-normal truncate flex-1">{formatDisplayValue(field, autoFill.scrapedData?.[field])}</span>
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
                  style={{ backgroundColor: tc, color: "#12161A", boxShadow: `0 0 15px ${tc}40` }}
                >
                  Apply Selected
                </button>
                <button
                  type="button"
                  onClick={autoFill.dismiss}
                  className="rounded-full h-10 px-5 font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-150"
                  style={{ ...cardStyle, color: "#fff" }}
                >
                  Skip
                </button>
              </div>
            </>
          )}

          {autoFill.status === "done" && (
            <div className="flex items-center gap-3 justify-center py-2">
              <span className="material-symbols-outlined text-xl" style={{ color: tc }}>check_circle</span>
              <span className="text-white text-sm font-bold uppercase tracking-wide">Profile Updated</span>
            </div>
          )}
        </div>
      )}

      {autoFill.status === "done" && (
        <button
          onClick={handleComplete}
          className="w-full py-3.5 rounded-full font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-200"
          style={{ backgroundColor: "#4DC9C9", color: "#12161A", boxShadow: "0 0 20px rgba(77, 201, 201, 0.3)" }}
        >
          Enter Brand HQ →
        </button>
      )}
    </div>
  );
}
