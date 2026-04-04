import { supabase } from "@/integrations/supabase/client";

type FirecrawlResponse<T = unknown> = {
  success: boolean;
  error?: string;
  data?: T;
};

type ScrapeOptions = {
  formats?: (
    | "markdown"
    | "html"
    | "rawHtml"
    | "links"
    | "screenshot"
    | "branding"
    | "summary"
    | { type: "json"; schema?: Record<string, unknown>; prompt?: string }
  )[];
  onlyMainContent?: boolean;
  waitFor?: number;
  location?: { country?: string; languages?: string[] };
};

type SearchOptions = {
  limit?: number;
  lang?: string;
  country?: string;
  tbs?: string;
  scrapeOptions?: { formats?: ("markdown" | "html")[] };
};

type CrawlOptions = {
  limit?: number;
  maxDepth?: number;
  includePaths?: string[];
  excludePaths?: string[];
};

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
};

type ProfileResponse = {
  success: boolean;
  error?: string;
  data?: AthleteProfileData;
  imageUrls?: { headshot?: string; actionPhoto?: string; schoolLogo?: string };
  actionPhotoCandidates?: string[];
  sources?: string[];
  resultsCount?: number;
};

export const firecrawlApi = {
  async scrape(url: string, options?: ScrapeOptions): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke("firecrawl-scrape", {
      body: { url, options },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  async search(query: string, options?: SearchOptions): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke("firecrawl-search", {
      body: { query, options },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  async crawl(url: string, options?: CrawlOptions): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke("firecrawl-crawl", {
      body: { url, options },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

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
