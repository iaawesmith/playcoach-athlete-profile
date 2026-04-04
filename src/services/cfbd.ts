import { supabase } from "@/integrations/supabase/client";

type CfbdParams = Record<string, string | number | undefined>;

const callCfbd = async <T = unknown>(
  endpoint: string,
  params?: CfbdParams,
): Promise<{ success: boolean; data?: T; error?: string }> => {
  const { data, error } = await supabase.functions.invoke("cfbd-api", {
    body: { endpoint, params },
  });
  if (error) return { success: false, error: error.message };
  if (Array.isArray(data) || (data && typeof data === "object" && !data.error)) {
    return { success: true, data: data as T };
  }
  return { success: false, error: data?.error || "Unknown CFBD error" };
};

export type CfbdRosterPlayer = {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  jersey: number;
  height: number;
  weight: number;
  year: number;
  home_city: string;
  home_state: string;
};

export type CfbdRecruit = {
  id: number;
  name: string;
  school: string;
  stars: number;
  ranking: number;
  position_rank: number;
  position: string;
  city: string;
  state_province: string;
  year: number;
};

export const cfbdApi = {
  roster: (team: string, year = 2025) =>
    callCfbd<CfbdRosterPlayer[]>("/roster", { team, year }),

  playerSearch: (name: string, team?: string) =>
    callCfbd("/player/search", { searchTerm: name, team }),

  recruitingPlayers: (year: number, team?: string) =>
    callCfbd<CfbdRecruit[]>("/recruiting/players", { year, team }),
};
