import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

type CfbdParams = Record<string, string | number | undefined>;

type CfbdResult<T> = { success: true; data: T } | { success: false; error: string };

const callCfbd = async <T = unknown>(
  endpoint: string,
  params?: CfbdParams,
): Promise<CfbdResult<T>> => {
  const { data, error } = await supabase.functions.invoke("cfbd-api", {
    body: { endpoint, params },
  });
  if (error) return { success: false, error: error.message };
  if (Array.isArray(data) || (data && typeof data === "object" && !data.error)) {
    return { success: true, data: data as T };
  }
  return { success: false, error: data?.error || "Unknown CFBD error" };
};

/* ------------------------------------------------------------------ */
/*  Response types                                                     */
/* ------------------------------------------------------------------ */

export type CfbdRosterPlayer = {
  athlete_id: number;
  first_name: string;
  last_name: string;
  position: string;
  jersey: number;
  height: number;
  weight: number;
  year: number;
  home_city: string;
  home_state: string;
  headshot_url: string | null;
};

export type CfbdPlayerSearchResult = {
  id: number;
  first_name: string;
  last_name: string;
  team: string;
  weight: number;
  height: number;
  jersey: number;
  position: string;
  hometown: string;
  stars: number;
  rating: number;
};

export type CfbdRecruit = {
  athlete_id: number;
  stars: number;
  rating: number;
  ranking: number;
  school: string;
  committed_to: string;
  position: string;
  height: number;
  weight: number;
};

export type CfbdTeam = {
  id: number;
  school: string;
  abbreviation: string;
  mascot: string;
  classification: string | null;
  color: string;
  alt_color: string;
  alternateColor: string;
  alternateNames: string[];
  logos: string[];
};

export type CfbdPortalPlayer = {
  first_name: string;
  last_name: string;
  position: string;
  origin: string;
  destination: string;
  transfer_date: string;
  rating: number;
  stars: number;
  eligibility: string;
};

export type CfbdGame = {
  id: number;
  season: number;
  week: number;
  start_date: string;
  home_team: string;
  away_team: string;
  home_points: number | null;
  away_points: number | null;
  venue: string;
};

export type CfbdUpcomingGame = {
  opponent: string;
  date: string;
  time: string;
  location: string;
};

/* ------------------------------------------------------------------ */
/*  API functions                                                      */
/* ------------------------------------------------------------------ */

export const cfbdApi = {
  /** Full roster for a team + year */
  roster: (team: string, year: number) =>
    callCfbd<CfbdRosterPlayer[]>("/roster", { team, year }),

  /** Search players by name for identity resolution */
  playerSearch: (searchTerm: string) =>
    callCfbd<CfbdPlayerSearchResult[]>("/player/search", { searchTerm }),

  /** Recruiting data — search by name, optionally filter by school */
  recruitingPlayers: (name: string, school?: string) =>
    callCfbd<CfbdRecruit[]>("/recruiting/players", {
      search: name,
      ...(school ? { team: school } : {}),
    }),

  /** Team info including colors and logos */
  /** Team info — pass school name to filter, or omit for all teams */
  teams: (school?: string) =>
    callCfbd<CfbdTeam[]>("/teams", school ? { school } : undefined),

  /** Transfer portal entries for a year, optionally filtered by team */
  playerPortal: (year: number, team?: string) =>
    callCfbd<CfbdPortalPlayer[]>("/player/portal", {
      year,
      ...(team ? { team } : {}),
    }),

  /** Next upcoming game for a team — filters client-side for future games */
  upcomingGames: async (
    team: string,
    year: number,
  ): Promise<CfbdResult<CfbdUpcomingGame | null>> => {
    const result: CfbdResult<CfbdGame[]> = await callCfbd<CfbdGame[]>("/games", {
      team,
      year,
      season_type: "regular",
    });

    if (!result.success) return { success: false, error: result.error };

    const now = new Date();
    const future = (result.data ?? [])
      .filter((g) => new Date(g.start_date) > now)
      .sort(
        (a, b) =>
          new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
      );

    if (future.length === 0) return { success: true, data: null };

    const g = future[0];
    const isHome = g.home_team.toLowerCase() === team.toLowerCase();
    const opponent = isHome ? g.away_team : g.home_team;
    const startDate = new Date(g.start_date);

    return {
      success: true,
      data: {
        opponent,
        date: startDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        time: startDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
        location: g.venue,
      },
    };
  },
};
