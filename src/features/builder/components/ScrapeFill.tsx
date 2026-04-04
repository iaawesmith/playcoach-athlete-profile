import { useState } from "react";
import { useAthleteStore } from "@/store/athleteStore";
import { firecrawlApi, type AthleteProfileData } from "@/services/firecrawl";
import { supabase } from "@/integrations/supabase/client";

type FieldKey = keyof AthleteProfileData;

type ImageUrls = {
  headshot?: string;
  actionPhoto?: string;
  schoolLogo?: string;
};

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
  classYear: "Class",
  starRating: "Star Rating",
  nationalRank: "National Rank",
  positionRank: "Position Rank",
  number: "Jersey Number",
  bio: "Bio",
  commitmentStatus: "Commitment Status",
};

const imageLabels: Record<keyof ImageUrls, string> = {
  headshot: "Profile Photo",
  actionPhoto: "Action Photo",
  schoolLogo: "School Logo",
};

const imageStoreKeys: Record<keyof ImageUrls, string> = {
  headshot: "profilePictureUrl",
  actionPhoto: "actionPhotoUrl",
  schoolLogo: "schoolLogoUrl",
};

const formatDisplayValue = (field: FieldKey, val: unknown): string => {
  if (field === "height") {
    const total = parseInt(String(val), 10);
    if (total > 11) return `${Math.floor(total / 12)}'${total % 12}"`;
  }
  return String(val ?? "");
};

const uploadImageViaProxy = async (
  imageUrl: string,
  fileName: string,
): Promise<string | null> => {
  const { data, error } = await supabase.functions.invoke("image-proxy", {
    body: { imageUrl, fileName, bucket: "athlete-media" },
  });
  if (error || !data?.success) return null;
  return data.publicUrl || null;
};

export const ScrapeFill = () => {
  const { firstName, lastName, school, position, number, classYear, setAthlete } = useAthleteStore();
  const [status, setStatus] = useState<"idle" | "loading" | "results" | "applying" | "error">("idle");
  const [scrapedData, setScrapedData] = useState<AthleteProfileData | null>(null);
  const [imageUrls, setImageUrls] = useState<ImageUrls | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<Set<FieldKey>>(new Set());
  const [selectedImages, setSelectedImages] = useState<Set<keyof ImageUrls>>(new Set());
  const [errorMessage, setErrorMessage] = useState("");

  const fullName = `${firstName} ${lastName}`.trim();
  const canScrape = fullName.length >= 3;

  const handleScrape = async () => {
    if (!canScrape) return;
    setStatus("loading");
    setErrorMessage("");

    const result = await firecrawlApi.fetchAthleteProfile(
      fullName,
      school || undefined,
      { position, number, classYear },
    );

    if (!result.success || !result.data) {
      setStatus("error");
      setErrorMessage(result.error || "No profile data found");
      return;
    }

    const data = result.data;
    setScrapedData(data);
    setImageUrls(result.imageUrls || null);
    setSources(result.sources || []);

    const fields = new Set<FieldKey>();
    for (const key of Object.keys(data) as FieldKey[]) {
      const val = data[key];
      if (val !== null && val !== undefined && val !== "") {
        fields.add(key);
      }
    }
    setSelectedFields(fields);

    const imgs = new Set<keyof ImageUrls>();
    if (result.imageUrls) {
      for (const key of Object.keys(result.imageUrls) as (keyof ImageUrls)[]) {
        if (result.imageUrls[key]) imgs.add(key);
      }
    }
    setSelectedImages(imgs);
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

  const toggleImage = (key: keyof ImageUrls) => {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleApply = async () => {
    if (!scrapedData && selectedImages.size === 0) return;
    setStatus("applying");

    const update: Record<string, unknown> = {};

    // Apply text fields
    if (scrapedData) {
      for (const field of selectedFields) {
        const val = scrapedData[field];
        if (val !== null && val !== undefined && val !== "") {
          update[field] = val;
        }
      }
    }

    // Upload selected images via proxy
    if (imageUrls) {
      const slug = `${firstName}-${lastName}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
      const timestamp = Date.now();

      for (const imgKey of selectedImages) {
        const url = imageUrls[imgKey];
        if (!url) continue;

        const ext = url.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || "jpg";
        const fileName = `${slug}/${imgKey}-${timestamp}.${ext}`;
        const publicUrl = await uploadImageViaProxy(url, fileName);

        if (publicUrl) {
          const storeKey = imageStoreKeys[imgKey];
          update[storeKey] = publicUrl;
        }
      }
    }

    setAthlete(update as Partial<Parameters<typeof setAthlete>[0]>);
    setStatus("idle");
    setScrapedData(null);
    setImageUrls(null);
  };

  const handleDismiss = () => {
    setStatus("idle");
    setScrapedData(null);
    setImageUrls(null);
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

  const availableImages = imageUrls
    ? (Object.keys(imageUrls) as (keyof ImageUrls)[]).filter((k) => !!imageUrls[k])
    : [];

  const totalItems = availableFields.length + availableImages.length;
  const totalSelected = selectedFields.size + selectedImages.size;

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
              const url = imageUrls![imgKey]!;
              const selected = selectedImages.has(imgKey);
              return (
                <button
                  key={imgKey}
                  type="button"
                  onClick={() => toggleImage(imgKey)}
                  className="relative rounded-lg overflow-hidden aspect-square bg-surface-container-lowest group transition-all duration-200"
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
          onClick={handleApply}
          disabled={totalSelected === 0}
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
