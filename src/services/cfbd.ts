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
/*  Team name resolution cache                                         */
/* ------------------------------------------------------------------ */

const teamNameCache = new Map<string, string | null>();

export const resolveTeamName = async (input: string): Promise<string | null> => {
  const key = input.toLowerCase().trim();
  if (teamNameCache.has(key)) return teamNameCache.get(key) ?? null;

  const result = await cfbdApi.teams();
  if (!result.success) {
    teamNameCache.set(key, null);
    return null;
  }

  const teams = result.data;
  // 1. Exact match on school field
  const exact = teams.find((t) => t.school.toLowerCase() === key);
  if (exact) { teamNameCache.set(key, exact.school); return exact.school; }

  // 2. school + mascot
  const composite = teams.find(
    (t) => `${t.school} ${t.mascot}`.toLowerCase() === key,
  );
  if (composite) { teamNameCache.set(key, composite.school); return composite.school; }

  // 3. Input starts with school name (longest match first)
  const startsWith = teams
    .filter((t) => key.startsWith(t.school.toLowerCase()))
    .sort((a, b) => b.school.length - a.school.length);
  if (startsWith.length > 0) { teamNameCache.set(key, startsWith[0].school); return startsWith[0].school; }

  // 4. Alternate names
  const alt = teams.find(
    (t) => t.alternateNames?.some((n) => n.toLowerCase() === key),
  );
  if (alt) { teamNameCache.set(key, alt.school); return alt.school; }

  teamNameCache.set(key, null);
  return null;
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

  /** Recruiting data — pass team to get all recruits for that school */
  recruitingPlayers: (team: string) =>
    callCfbd<CfbdRecruit[]>("/recruiting/players", { team }),

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

    if (!result.success) {
      return { success: false as const, error: (result as { success: false; error: string }).error };
    }

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
