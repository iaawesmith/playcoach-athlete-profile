import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type Extracted247Data = {
  transferStars247: number | null;
  transferRating247: number | null;
  transferOvrRank247: number | null;
  transferPositionRank247: number | null;
  prospectStars247: number | null;
  prospectRating247: number | null;
  prospectNatlRank247: number | null;
  prospectPositionRank247: number | null;
  prospectStateRank247: number | null;
  actionPhotoUrl: string | null;
};

export type ExtractedOn3Data = {
  on3Rating: number | null;
  on3NationalRank: number | null;
  on3PositionRank: number | null;
  on3StateRank: number | null;
  nilValuation: string | null;
  actionPhotoUrl: string | null;
};

export type ExtractedActionPhoto = {
  actionPhotoUrl: string | null;
};

type ExtractionResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

/* ------------------------------------------------------------------ */
/*  API                                                                */
/* ------------------------------------------------------------------ */

export const firecrawlApi = {
  /** Fetch school logo — Firecrawl fallback for non-CFBD schools */
  async fetchSchoolLogo(school: string): Promise<{ success: boolean; logoUrl?: string; error?: string }> {
    const { data, error } = await supabase.functions.invoke("firecrawl-school-logo", {
      body: { school },
    });
    if (error) return { success: false, error: error.message };
    return data as { success: boolean; logoUrl?: string; error?: string };
  },

  /** Extract 247Sports profile data */
  async search247Profile(
    firstName: string,
    lastName: string,
    position: string,
    school: string,
  ): Promise<ExtractionResult<Extracted247Data>> {
    const { data, error } = await supabase.functions.invoke("firecrawl-profile", {
      body: { mode: "247", firstName, lastName, position, school },
    });
    if (error) return { success: false, error: error.message };
    return data as ExtractionResult<Extracted247Data>;
  },

  /** Extract On3 profile data */
  async searchOn3Profile(
    firstName: string,
    lastName: string,
    position: string,
    school: string,
  ): Promise<ExtractionResult<ExtractedOn3Data>> {
    const { data, error } = await supabase.functions.invoke("firecrawl-profile", {
      body: { mode: "on3", firstName, lastName, position, school },
    });
    if (error) return { success: false, error: error.message };
    return data as ExtractionResult<ExtractedOn3Data>;
  },

  /** Extract action photo from ESPN player page */
  async scrapeEspnActionPhoto(
    espnId: string,
    firstName: string,
    lastName: string,
  ): Promise<ExtractionResult<ExtractedActionPhoto>> {
    const { data, error } = await supabase.functions.invoke("firecrawl-profile", {
      body: { mode: "espn-photo", espnId, firstName, lastName },
    });
    if (error) return { success: false, error: error.message };
    return data as ExtractionResult<ExtractedActionPhoto>;
  },

  /** Extract action photo from school athletic website */
  async scrapeSchoolRosterPhoto(
    firstName: string,
    lastName: string,
    school: string,
  ): Promise<ExtractionResult<ExtractedActionPhoto>> {
    const { data, error } = await supabase.functions.invoke("firecrawl-profile", {
      body: { mode: "school-photo", firstName, lastName, school },
    });
    if (error) return { success: false, error: error.message };
    return data as ExtractionResult<ExtractedActionPhoto>;
  },
};
