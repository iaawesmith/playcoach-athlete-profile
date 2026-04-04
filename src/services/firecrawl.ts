import { supabase } from "@/integrations/supabase/client";

export type AthleteProfileData = {
  height?: string;
  weight?: string;
  fortyTime?: string;
  vertical?: string;
  wingspan?: string;
  handSize?: string;
  hometown?: string;
  highSchool?: string;
  position?: string;
  classYear?: string;
  starRating?: number;
  nationalRank?: number;
  positionRank?: number;
  number?: string;
  bio?: string;
  commitmentStatus?: string;
  rating247?: string;
  ratingOn3?: string;
  ratingComposite?: string;
  offersCount?: number;
};

type ProfileResponse = {
  success: boolean;
  error?: string;
  data?: AthleteProfileData;
  imageUrls?: { actionPhoto?: string };
  
  sources?: string[];
  resultsCount?: number;
};

export const firecrawlApi = {
  async fetchSchoolLogo(school: string): Promise<{ success: boolean; logoUrl?: string; error?: string }> {
    const { data, error } = await supabase.functions.invoke("firecrawl-school-logo", {
      body: { school },
    });
    if (error) return { success: false, error: error.message };
    return data as { success: boolean; logoUrl?: string; error?: string };
  },

  async fetchAthleteProfile(
    name: string,
    school?: string,
    knownFields?: { position?: string; number?: string; classYear?: string },
  ): Promise<ProfileResponse> {
    const { data, error } = await supabase.functions.invoke("firecrawl-profile", {
      body: { name, school, knownFields },
    });
    if (error) return { success: false, error: error.message };
    return data as ProfileResponse;
  },
};
