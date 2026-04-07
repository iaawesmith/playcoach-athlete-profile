import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type Extracted247Data = {
  nationalRank: number | null;
  positionRank: number | null;
  stateRank: number | null;
  compositeRating: number | null;
};

export type ExtractedOn3Data = {
  on3Rating: number | null;
  on3NationalRank: number | null;
  on3PositionRank: number | null;
  fortyTime: number | null;
  vertical: number | null;
  wingspan: number | null;
  handSize: number | null;
};

type ExtractionResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const invokeFirecrawl = async (
  fnName: string,
  body: Record<string, unknown>,
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> => {
  const { data, error } = await supabase.functions.invoke(fnName, { body });
  if (error) return { success: false, error: error.message };
  return data as { success: boolean; data?: Record<string, unknown>; error?: string };
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

  /** Extract 247Sports profile data using targeted prompt */
  async search247Profile(
    firstName: string,
    lastName: string,
    position: string,
    school: string,
  ): Promise<ExtractionResult<Extracted247Data>> {
    const { data, error } = await supabase.functions.invoke("firecrawl-profile", {
      body: {
        mode: "247",
        firstName,
        lastName,
        position,
        school,
      },
    });
    if (error) return { success: false, error: error.message };
    const result = data as { success: boolean; data?: Extracted247Data; error?: string };
    return result;
  },

  /** Extract On3 profile data using targeted prompt */
  async searchOn3Profile(
    firstName: string,
    lastName: string,
    position: string,
    school: string,
  ): Promise<ExtractionResult<ExtractedOn3Data>> {
    const { data, error } = await supabase.functions.invoke("firecrawl-profile", {
      body: {
        mode: "on3",
        firstName,
        lastName,
        position,
        school,
      },
    });
    if (error) return { success: false, error: error.message };
    const result = data as { success: boolean; data?: ExtractedOn3Data; error?: string };
    return result;
  },
};
