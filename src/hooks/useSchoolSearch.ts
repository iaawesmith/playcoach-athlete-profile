import { useState, useEffect, useCallback, useRef } from "react";
import { cfbdApi, type CfbdTeam } from "@/services/cfbd";

export interface SchoolOption {
  name: string;
  abbrev: string;
  primaryColor: string;
  altColor: string;
  logoUrl: string | null;
  source: "cfbd";
}

let cachedTeams: CfbdTeam[] | null = null;
let fetchPromise: Promise<CfbdTeam[]> | null = null;

const loadTeams = async (): Promise<CfbdTeam[]> => {
  if (cachedTeams) return cachedTeams;
  if (fetchPromise) return fetchPromise;
  fetchPromise = cfbdApi.teams().then((res) => {
    if (res.success && res.data) {
      // Only keep FBS and FCS teams (proper NCAA Division I)
      cachedTeams = res.data.filter(
        (t) => t.classification === "fbs" || t.classification === "fcs"
      );
      return cachedTeams;
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

const isValidColor = (c: string | null | undefined): boolean => {
  if (!c || c === "#null" || c === "null") return false;
  return /^#?[0-9a-fA-F]{3,8}$/.test(c);
};

const teamToOption = (team: CfbdTeam): SchoolOption => {
  const rawColor = isValidColor(team.color) ? team.color : null;
  const primaryColor = rawColor
    ? (rawColor.startsWith("#") ? rawColor : `#${rawColor}`)
    : "#50C4CA";
  const rawAlt = isValidColor(team.alternateColor) ? team.alternateColor : null;
  const altColor = rawAlt
    ? (rawAlt.startsWith("#") ? rawAlt : `#${rawAlt}`)
    : "";
  // Prefer dark variant logo (index 1) for dark backgrounds, fall back to index 0
  const logoUrl = team.logos?.[1] || team.logos?.[0] || null;
  return {
    name: team.school,
    abbrev: team.abbreviation || team.school.split(" ").map((w) => w[0]).join("").toUpperCase(),
    primaryColor,
    altColor,
    logoUrl,
    source: "cfbd",
  };
};

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

    // Search cached CFBD first
    if (cachedTeams) {
      const cfbdResults = cachedTeams.filter((t) => matchesQuery(t, q)).slice(0, 8).map(teamToOption);
      setResults(cfbdResults);
      setLoading(false);
      return;
    }

    // CFBD not yet loaded — fetch and search
    loadTeams().then((teams) => {
      const cfbdResults = teams.filter((t) => matchesQuery(t, q)).slice(0, 8).map(teamToOption);
      setResults(cfbdResults);
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
