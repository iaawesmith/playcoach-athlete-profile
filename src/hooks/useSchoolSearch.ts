import { useState, useEffect, useCallback, useRef } from "react";
import { cfbdApi, type CfbdTeam } from "@/services/cfbd";
import { universities } from "@/data/universities";

export interface SchoolOption {
  name: string;
  abbrev: string;
  primaryColor: string;
  altColor: string;
  logoUrl: string | null;
  source: "cfbd" | "local";
}

let cachedTeams: CfbdTeam[] | null = null;
let fetchPromise: Promise<CfbdTeam[]> | null = null;

const loadTeams = async (): Promise<CfbdTeam[]> => {
  if (cachedTeams) return cachedTeams;
  if (fetchPromise) return fetchPromise;
  fetchPromise = cfbdApi.teams().then((res) => {
    if (res.success && res.data) {
      cachedTeams = res.data;
      return res.data;
    }
    return [];
  }).catch(() => []);
  return fetchPromise;
};

const matchesQuery = (team: CfbdTeam, q: string): boolean => {
  const lower = q.toLowerCase();
  if (team.school.toLowerCase().includes(lower)) return true;
  if (team.abbreviation?.toLowerCase().includes(lower)) return true;
  if (team.alternateNames?.some((n) => n.toLowerCase().includes(lower))) return true;
  return false;
};

const teamToOption = (team: CfbdTeam): SchoolOption => ({
  name: team.school,
  abbrev: team.abbreviation || team.school.split(" ").map((w) => w[0]).join("").toUpperCase(),
  primaryColor: team.color?.startsWith("#") ? team.color : `#${team.color || "50C4CA"}`,
  altColor: team.alternateColor?.startsWith("#") ? team.alternateColor : `#${team.alternateColor || ""}`,
  logoUrl: team.logos?.[0] || null,
  source: "cfbd",
});

export function useSchoolSearch(query: string) {
  const [results, setResults] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback((q: string) => {
    if (q.length < 1) {
      setResults([]);
      return;
    }

    setLoading(true);

    // Search cached CFBD first, fall back to local
    if (cachedTeams) {
      const cfbdResults = cachedTeams.filter((t) => matchesQuery(t, q)).slice(0, 8).map(teamToOption);
      if (cfbdResults.length > 0) {
        setResults(cfbdResults);
        setLoading(false);
        return;
      }
    }

    // Local fallback while CFBD loads
    const localResults = universities
      .filter((u) => u.name.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8)
      .map((u): SchoolOption => ({
        name: u.name,
        abbrev: u.abbrev,
        primaryColor: u.primaryColor,
        altColor: u.secondaryColor,
        logoUrl: null,
        source: "local",
      }));
    setResults(localResults);

    // Try CFBD async
    loadTeams().then((teams) => {
      if (teams.length > 0) {
        const cfbdResults = teams.filter((t) => matchesQuery(t, q)).slice(0, 8).map(teamToOption);
        if (cfbdResults.length > 0) {
          setResults(cfbdResults);
        }
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 100);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  // Preload teams on mount
  useEffect(() => {
    loadTeams();
  }, []);

  return { results, loading };
}
