import { useState } from "react";
import { useAthleteStore } from "@/store/athleteStore";
import { firecrawlApi, type AthleteProfileData } from "@/services/firecrawl";

type FieldKey = keyof AthleteProfileData;

const fieldLabels: Record<FieldKey, string> = {
  height: "Height",
  weight: "Weight",
  fortyTime: "40-Yard Dash",
  vertical: "Vertical",
  wingspan: "Wingspan",
  handSize: "Hand Size",
  hometown: "Hometown",
  highSchool: "High School",
  position: "Position",
  classYear: "Class Year",
  starRating: "Star Rating",
  nationalRank: "National Rank",
  positionRank: "Position Rank",
  number: "Jersey Number",
  bio: "Bio",
  commitmentStatus: "Commitment Status",
};

const formatDisplayValue = (field: FieldKey, val: unknown): string => {
  if (field === "height") {
    const total = parseInt(String(val), 10);
    if (total > 11) return `${Math.floor(total / 12)}'${total % 12}"`;
  }
  return String(val ?? "");
};

export const ScrapeFill = () => {
  const { firstName, lastName, school, setAthlete } = useAthleteStore();
  const [status, setStatus] = useState<"idle" | "loading" | "results" | "error">("idle");
  const [scrapedData, setScrapedData] = useState<AthleteProfileData | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<Set<FieldKey>>(new Set());
  const [errorMessage, setErrorMessage] = useState("");

  const fullName = `${firstName} ${lastName}`.trim();
  const canScrape = fullName.length >= 3;

  const handleScrape = async () => {
    if (!canScrape) return;
    setStatus("loading");
    setErrorMessage("");

    const result = await firecrawlApi.fetchAthleteProfile(fullName, school || undefined);

    if (!result.success || !result.data) {
      setStatus("error");
      setErrorMessage(result.error || "No profile data found");
      return;
    }

    const data = result.data;
    setScrapedData(data);
    setSources(result.sources || []);

    // Pre-select all fields that have values
    const fields = new Set<FieldKey>();
    for (const key of Object.keys(data) as FieldKey[]) {
      const val = data[key];
      if (val !== null && val !== undefined && val !== "") {
        fields.add(key);
      }
    }
    setSelectedFields(fields);
    setStatus("results");
  };

  const toggleField = (field: FieldKey) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const handleApply = () => {
    if (!scrapedData) return;

    const update: Record<string, unknown> = {};
    for (const field of selectedFields) {
      const val = scrapedData[field];
      if (val !== null && val !== undefined && val !== "") {
        update[field] = val;
      }
    }

    setAthlete(update as Partial<Parameters<typeof setAthlete>[0]>);
    setStatus("idle");
    setScrapedData(null);
  };

  const handleDismiss = () => {
    setStatus("idle");
    setScrapedData(null);
    setErrorMessage("");
  };

  if (status === "idle") {
    return (
      <button
        type="button"
        onClick={handleScrape}
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
              ? "Search 247Sports, Rivals & more for your profile data"
              : "Enter your name first to enable web search"}
          </span>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant text-base group-hover:text-primary transition-colors">
          arrow_forward
        </span>
      </button>
    );
  }

  if (status === "loading") {
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
            onClick={handleScrape}
            className="text-primary text-xs font-bold uppercase tracking-wide hover:underline"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-on-surface-variant text-xs font-bold uppercase tracking-wide hover:underline"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // results state
  const availableFields = scrapedData
    ? (Object.keys(scrapedData) as FieldKey[]).filter((k) => {
        const val = scrapedData[k];
        return val !== null && val !== undefined && val !== "";
      })
    : [];

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
          {availableFields.length} fields
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

      <div className="space-y-1">
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

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={handleApply}
          disabled={selectedFields.size === 0}
          className="flex-1 kinetic-gradient text-[#00460a] rounded-full h-10 font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Apply Selected
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="glass-card border border-outline-variant/20 text-on-surface rounded-full h-10 px-5 font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-150"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
