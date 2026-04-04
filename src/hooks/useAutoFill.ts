import { useState, useCallback, useRef } from "react";
import { useAthleteStore } from "@/store/athleteStore";
import { firecrawlApi, type AthleteProfileData } from "@/services/firecrawl";
import { supabase } from "@/integrations/supabase/client";

type FieldKey = keyof AthleteProfileData;

type ImageUrls = {
  actionPhoto?: string;
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
  classYear: "Class",
  starRating: "Star Rating",
  nationalRank: "National Rank",
  positionRank: "Position Rank",
  number: "Jersey Number",
  bio: "Bio",
  commitmentStatus: "Commitment Status",
  rating247: "247 Rating",
  ratingOn3: "On3 Rating",
  ratingComposite: "Composite Rating",
  offersCount: "Offers",
};

export const imageLabels: Record<keyof ImageUrls, string> = {
  actionPhoto: "Action Photo",
};

const imageStoreKeys: Record<keyof ImageUrls, string> = {
  actionPhoto: "actionPhotoUrl",
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
  const originalValues = useRef<Record<string, unknown>>({});

  const fullName = `${firstName} ${lastName}`.trim();
  const canScrape = fullName.length >= 3;

  const scrape = useCallback(async () => {
    if (!canScrape) return;
    setStatus("scraping");
    setErrorMessage("");

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

    // Live preview: set action photo + measurables immediately
    const preview: Record<string, unknown> = {};
    if (result.imageUrls?.actionPhoto) {
      preview.actionPhotoUrl = result.imageUrls.actionPhoto;
    }
    if (data.height) preview.height = data.height;
    if (data.weight) preview.weight = data.weight;
    if (Object.keys(preview).length > 0) {
      setAthlete(preview as Parameters<typeof setAthlete>[0]);
    }

    // Smart merge: exclude fields the user already provided
    const userProvidedFields = new Set<FieldKey>();
    if (position) userProvidedFields.add("position");
    if (number) userProvidedFields.add("number");
    if (classYear) userProvidedFields.add("classYear");

    const fields = new Set<FieldKey>();
    for (const key of Object.keys(data) as FieldKey[]) {
      const val = data[key];
      if (val !== null && val !== undefined && val !== "") {
        if (!userProvidedFields.has(key)) {
          fields.add(key);
        }
      }
    }
    setSelectedFields(fields);

    const imgs = new Set<keyof ImageUrls>();
    if (result.imageUrls?.actionPhoto) {
      imgs.add("actionPhoto");
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

    // Revert any live-previewed images the user unchecked
    const previewedImageKeys: (keyof ImageUrls)[] = ["actionPhoto"];
    for (const imgKey of previewedImageKeys) {
      if (imageUrls?.[imgKey] && !selectedImages.has(imgKey)) {
        const storeKey = imageStoreKeys[imgKey];
        update[storeKey] = originalValues.current[storeKey] ?? null;
      }
    }

    setAthlete(update as Partial<Parameters<typeof setAthlete>[0]>);
    setStatus("done");
  }, [scrapedData, imageUrls, selectedFields, selectedImages, firstName, lastName, setAthlete]);

  const dismiss = useCallback(() => {
    if (Object.keys(originalValues.current).length > 0) {
      setAthlete(originalValues.current as Parameters<typeof setAthlete>[0]);
    }
    setStatus("idle");
    setScrapedData(null);
    setImageUrls(null);
    setErrorMessage("");
  }, [setAthlete]);

  const availableFields = scrapedData
    ? (Object.keys(scrapedData) as FieldKey[]).filter((k) => {
        const val = scrapedData[k];
        return val !== null && val !== undefined && val !== "";
      })
    : [];

  const availableImages = imageUrls?.actionPhoto
    ? (["actionPhoto"] as (keyof ImageUrls)[])
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
  };
}
