import { useState, useCallback, useRef } from "react";
import { useAthleteStore } from "@/store/athleteStore";
import { firecrawlApi, type AthleteProfileData } from "@/services/firecrawl";
import { supabase } from "@/integrations/supabase/client";

type FieldKey = keyof AthleteProfileData;

type ImageUrls = {
  headshot?: string;
  actionPhoto?: string;
  schoolLogo?: string;
};

export const fieldLabels: Record<FieldKey, string> = {
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

export const imageLabels: Record<keyof ImageUrls, string> = {
  headshot: "Profile Photo",
  actionPhoto: "Action Photo",
  schoolLogo: "School Logo",
};

const imageStoreKeys: Record<keyof ImageUrls, string> = {
  headshot: "profilePictureUrl",
  actionPhoto: "actionPhotoUrl",
  schoolLogo: "schoolLogoUrl",
};

export const formatDisplayValue = (field: FieldKey, val: unknown): string => {
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

export type AutoFillStatus = "idle" | "scraping" | "results" | "applying" | "error" | "done";

export function useAutoFill() {
  const {
    firstName, lastName, school, position, number, classYear,
    actionPhotoUrl, setAthlete,
  } = useAthleteStore();

  const [status, setStatus] = useState<AutoFillStatus>("idle");
  const [scrapedData, setScrapedData] = useState<AthleteProfileData | null>(null);
  const [imageUrls, setImageUrls] = useState<ImageUrls | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<Set<FieldKey>>(new Set());
  const [selectedImages, setSelectedImages] = useState<Set<keyof ImageUrls>>(new Set());
  const [errorMessage, setErrorMessage] = useState("");

  // Action photo candidate cycling
  const [actionPhotoCandidates, setActionPhotoCandidates] = useState<string[]>([]);
  const [activeActionPhotoIndex, setActiveActionPhotoIndex] = useState(0);
  const originalValues = useRef<Record<string, unknown>>({});

  const fullName = `${firstName} ${lastName}`.trim();
  const canScrape = fullName.length >= 3;

  const scrape = useCallback(async () => {
    if (!canScrape) return;
    setStatus("scraping");
    setErrorMessage("");

    // Save original values to restore on dismiss
    originalValues.current = {
      actionPhotoUrl,
      height: useAthleteStore.getState().height,
      weight: useAthleteStore.getState().weight,
      schoolLogoUrl: useAthleteStore.getState().schoolLogoUrl,
    };

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

    // Store action photo candidates
    const candidates = result.actionPhotoCandidates || [];
    setActionPhotoCandidates(candidates);
    setActiveActionPhotoIndex(0);

    // Live preview: set action photo + measurables on the store immediately
    const preview: Record<string, unknown> = {};
    if (result.imageUrls?.actionPhoto) {
      preview.actionPhotoUrl = result.imageUrls.actionPhoto;
    }
    if (data.height) preview.height = data.height;
    if (data.weight) preview.weight = data.weight;
    if (Object.keys(preview).length > 0) {
      setAthlete(preview as Parameters<typeof setAthlete>[0]);
    }

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
  }, [canScrape, fullName, school, position, number, classYear, actionPhotoUrl, setAthlete]);

  const toggleField = useCallback((field: FieldKey) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }, []);

  const toggleImage = useCallback((key: keyof ImageUrls) => {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Cycle to next action photo candidate
  const nextActionPhoto = useCallback(() => {
    if (actionPhotoCandidates.length <= 1) return;
    const nextIdx = (activeActionPhotoIndex + 1) % actionPhotoCandidates.length;
    setActiveActionPhotoIndex(nextIdx);

    const nextUrl = actionPhotoCandidates[nextIdx];

    // Update imageUrls so the thumbnail reflects the new pick
    setImageUrls((prev) => prev ? { ...prev, actionPhoto: nextUrl } : { actionPhoto: nextUrl });

    // Live preview on ProCard
    setAthlete({ actionPhotoUrl: nextUrl } as Parameters<typeof setAthlete>[0]);
  }, [actionPhotoCandidates, activeActionPhotoIndex, setAthlete]);

  const hasMultipleActionPhotos = actionPhotoCandidates.length > 1;

  const apply = useCallback(async () => {
    if (!scrapedData && selectedImages.size === 0) return;
    setStatus("applying");

    const update: Record<string, unknown> = {};

    if (scrapedData) {
      for (const field of selectedFields) {
        const val = scrapedData[field];
        if (val !== null && val !== undefined && val !== "") {
          update[field] = val;
        }
      }
    }

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
    setStatus("done");
  }, [scrapedData, imageUrls, selectedFields, selectedImages, firstName, lastName, setAthlete]);

  const dismiss = useCallback(() => {
    // Restore all original values if user dismisses
    if (Object.keys(originalValues.current).length > 0) {
      setAthlete(originalValues.current as Parameters<typeof setAthlete>[0]);
    }
    setStatus("idle");
    setScrapedData(null);
    setImageUrls(null);
    setErrorMessage("");
    setActionPhotoCandidates([]);
    setActiveActionPhotoIndex(0);
  }, [setAthlete]);

  const availableFields = scrapedData
    ? (Object.keys(scrapedData) as FieldKey[]).filter((k) => {
        const val = scrapedData[k];
        return val !== null && val !== undefined && val !== "";
      })
    : [];

  const availableImages = imageUrls
    ? (Object.keys(imageUrls) as (keyof ImageUrls)[]).filter((k) => !!imageUrls[k])
    : [];

  return {
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
    totalSelected: selectedFields.size + selectedImages.size,
    totalItems: availableFields.length + availableImages.length,
    nextActionPhoto,
    hasMultipleActionPhotos,
    activeActionPhotoIndex,
    actionPhotoCandidateCount: actionPhotoCandidates.length,
  };
}
