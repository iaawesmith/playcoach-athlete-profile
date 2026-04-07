import { useState, useCallback, useRef } from "react";
import { useAthleteStore, type FieldSource } from "@/store/athleteStore";
import { cfbdApi, type CfbdRosterPlayer, type CfbdRecruit, type CfbdTeam, type CfbdPortalPlayer } from "@/services/cfbd";
import { firecrawlApi } from "@/services/firecrawl";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AutoFillField = string;

export type AutoFillStatus =
  | "idle"
  | "resolving"
  | "enriching"
  | "confirm"
  | "results"
  | "applying"
  | "error"
  | "done";

type EnrichedData = Record<string, unknown>;
type ImageUrls = { actionPhoto?: string };

export type FieldEntry = {
  key: string;
  label: string;
  value: unknown;
  source: FieldSource;
};

/* ------------------------------------------------------------------ */
/*  Identity resolution scoring                                        */
/* ------------------------------------------------------------------ */

function fuzzyNameScore(
  candidateFirst: string,
  candidateLast: string,
  targetFirst: string,
  targetLast: string,
): number {
  const cf = candidateFirst.toLowerCase();
  const cl = candidateLast.toLowerCase();
  const tf = targetFirst.toLowerCase();
  const tl = targetLast.toLowerCase();

  if (cf === tf && cl === tl) return 40;
  if (cl === tl && cf.startsWith(tf.slice(0, 3))) return 30;
  if (cl === tl) return 20;
  return 0;
}

function scoreCandidate(
  candidate: { first_name: string; last_name: string; position?: string; jersey?: number },
  target: { firstName: string; lastName: string; position: string; jersey: string; school?: string },
): number {
  let score = fuzzyNameScore(candidate.first_name, candidate.last_name, target.firstName, target.lastName);

  if (candidate.position && target.position && candidate.position.toUpperCase() === target.position.toUpperCase()) {
    score += 15;
  }

  if (candidate.jersey != null && target.jersey) {
    if (String(candidate.jersey) === target.jersey) score += 10;
  }

  return score;
}

/* ------------------------------------------------------------------ */
/*  Field labels for UI                                                */
/* ------------------------------------------------------------------ */

export const fieldLabels: Record<string, string> = {
  height: "Height",
  weight: "Weight",
  hometown: "Hometown",
  highSchool: "High School",
  classYear: "Class",
  starRating: "Stars",
  recruitingRating: "Composite Rating",
  nationalRank: "National Rank",
  positionRank: "Position Rank",
  stateRank: "State Rank",
  commitmentStatus: "Commitment",
  schoolAbbrev: "School Abbreviation",
  teamColor: "Team Color",
  teamColorAlt: "Alternate Color",
  schoolLogoUrl: "School Logo",
  transferFrom: "Transferred From",
  eligibilityYears: "Eligibility",
  actionPhotoUrl: "Headshot Photo",
  on3Rating: "On3 Rating",
  on3NationalRank: "On3 National Rank",
  on3PositionRank: "On3 Position Rank",
  fortyTime: "40-Yard Dash",
  vertical: "Vertical Leap",
  wingspan: "Wingspan",
  handSize: "Hand Size",
  offersCount: "Offers",
  upcomingGame: "Upcoming Game",
};

export const formatDisplayValue = (key: string, val: unknown): string => {
  if (val === null || val === undefined) return "—";
  if (key === "height") {
    const total = parseInt(String(val), 10);
    if (total > 11) return `${Math.floor(total / 12)}'${total % 12}"`;
  }
  if (key === "upcomingGame" && typeof val === "object") {
    const g = val as Record<string, string>;
    return `${g.opponent || "TBD"} — ${g.date || ""}`;
  }
  return String(val);
};

/* ------------------------------------------------------------------ */
/*  Image upload helper                                                */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Year-to-class mapping                                              */
/* ------------------------------------------------------------------ */

const yearToClass: Record<number, string> = {
  1: "Freshman",
  2: "Sophomore",
  3: "Junior",
  4: "Senior",
  5: "5th Year",
};

/* ------------------------------------------------------------------ */
/*  useAutoFill hook                                                   */
/* ------------------------------------------------------------------ */

export function useAutoFill() {
  const store = useAthleteStore;
  const { firstName, lastName, school, position, number: jersey, classYear, setAthleteFromSource } = useAthleteStore();

  const [status, setStatus] = useState<AutoFillStatus>("idle");
  const [enrichedFields, setEnrichedFields] = useState<FieldEntry[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [confirmCandidate, setConfirmCandidate] = useState<{ name: string; school: string; position: string } | null>(null);
  const pendingEnrichRef = useRef<(() => Promise<void>) | null>(null);

  const fullName = `${firstName} ${lastName}`.trim();
  const canScrape = fullName.length >= 3;

  /* ── Main scrape entry ──────────────────────────────────────── */

  const scrape = useCallback(async () => {
    if (!canScrape) return;
    setStatus("resolving");
    setErrorMessage("");
    setEnrichedFields([]);
    setSources([]);
    setConfirmCandidate(null);

    const target = { firstName, lastName, position, jersey, school };

    // Step 1: Identity resolution via CFBD roster
    let bestCandidate: CfbdRosterPlayer | null = null;
    let bestScore = 0;
    let schoolForCfbd = school;

    if (school) {
      // Resolve school name via teams API
      const teamsResult = await cfbdApi.teams(school);
      if (teamsResult.success && teamsResult.data.length > 0) {
        schoolForCfbd = teamsResult.data[0].school;
      }

      const yr = new Date().getFullYear();
      const rosterResult = await cfbdApi.roster(schoolForCfbd, yr);

      if (rosterResult.success && rosterResult.data) {
        // Add school match bonus (35 pts) since we matched the school
        for (const player of rosterResult.data) {
          const s = scoreCandidate(player, target) + 35; // school match bonus
          if (s > bestScore) {
            bestScore = s;
            bestCandidate = player;
          }
        }
      }
    }

    // Build enrichment function
    const runEnrichment = async () => {
      setStatus("enriching");
      const data: EnrichedData = {};
      const srcList: string[] = [];

      const yr = new Date().getFullYear();

      // Phase 1: CFBD parallel calls
      if (bestCandidate && bestScore > 75 && school) {
        const [recruitRes, teamsRes, portalRes, gameRes] = await Promise.all([
          cfbdApi.recruitingPlayers(`${firstName} ${lastName}`, schoolForCfbd),
          cfbdApi.teams(schoolForCfbd),
          cfbdApi.playerPortal(yr, schoolForCfbd),
          cfbdApi.upcomingGames(schoolForCfbd, yr),
        ]);

        // 1a: Roster data
        srcList.push("CFBD");
        if (bestCandidate.height) data.height = String(bestCandidate.height);
        if (bestCandidate.weight) data.weight = String(bestCandidate.weight);
        if (bestCandidate.jersey != null) data.number = String(bestCandidate.jersey);
        if (bestCandidate.position) data.position = bestCandidate.position;
        if (bestCandidate.year) data.classYear = yearToClass[bestCandidate.year] || String(bestCandidate.year);
        if (bestCandidate.home_city && bestCandidate.home_state) {
          data.hometown = `${bestCandidate.home_city}, ${bestCandidate.home_state}`;
        }
        if (bestCandidate.headshot_url && !store.getState().actionPhotoUrl) {
          data.actionPhotoUrl = bestCandidate.headshot_url;
        }

        // 1b: Recruiting
        if (recruitRes.success && recruitRes.data) {
          const rMatch = recruitRes.data.find((r: CfbdRecruit) => {
            // Match by name (recruiting data uses full name search)
            return r.athlete_id != null;
          });
          const recruit = rMatch || (recruitRes.data.length > 0 ? recruitRes.data[0] : null);
          if (recruit) {
            if (recruit.stars) data.starRating = recruit.stars;
            if (recruit.rating) data.recruitingRating = recruit.rating;
            if (recruit.ranking) data.nationalRank = recruit.ranking;
            if (recruit.school) data.highSchool = recruit.school;
            if (recruit.committed_to) {
              data.commitmentStatus = "committed";
            } else {
              data.commitmentStatus = "uncommitted";
            }
          }
        }

        // 1c: Teams
        if (teamsRes.success && teamsRes.data.length > 0) {
          const team: CfbdTeam = teamsRes.data[0];
          if (team.logos?.[0]) data.schoolLogoUrl = team.logos[0];
          if (team.color) data.teamColor = team.color.startsWith("#") ? team.color : `#${team.color}`;
          if (team.alt_color) data.teamColorAlt = team.alt_color.startsWith("#") ? team.alt_color : `#${team.alt_color}`;
          if (team.abbreviation) data.schoolAbbrev = team.abbreviation;
        }

        // 1d: Portal
        if (portalRes.success && portalRes.data) {
          const portalMatch = portalRes.data.find((p: CfbdPortalPlayer) =>
            p.first_name.toLowerCase() === firstName.toLowerCase() &&
            p.last_name.toLowerCase() === lastName.toLowerCase()
          );
          if (portalMatch) {
            data.transferFrom = portalMatch.origin;
            if (portalMatch.eligibility) data.eligibilityYears = parseInt(portalMatch.eligibility, 10) || 0;
            if (portalMatch.stars) data.transferStars = portalMatch.stars;
            if (!portalMatch.destination) {
              data.commitmentStatus = "portal";
            }
          }
        }

        // 1e: Upcoming game
        if (gameRes.success && gameRes.data) {
          data.upcomingGame = {
            opponent: gameRes.data.opponent,
            date: gameRes.data.date,
            time: gameRes.data.time,
            network: "",
            location: gameRes.data.location,
          };
        }
      }

      // Phase 2: Firecrawl targeted extractions
      const posTag = position || String(data.position || "");
      const schoolTag = school || "";

      if (schoolTag && firstName && lastName) {
        try {
          const searchBase = `${firstName} ${lastName} ${posTag} ${schoolTag} football`;

          const [s247Res, sOn3Res] = await Promise.all([
            firecrawlApi.search247Profile(firstName, lastName, posTag, schoolTag),
            firecrawlApi.searchOn3Profile(firstName, lastName, posTag, schoolTag),
          ]);

          // 247Sports extraction
          if (s247Res.success && s247Res.data) {
            srcList.push("247Sports");
            const d = s247Res.data;
            if (d.nationalRank != null) data.nationalRank = d.nationalRank;
            if (d.positionRank != null) data.positionRank = d.positionRank;
            if (d.stateRank != null) data.stateRank = d.stateRank;
            if (d.compositeRating != null) data.recruitingRating = d.compositeRating;
          }

          // On3 extraction
          if (sOn3Res.success && sOn3Res.data) {
            srcList.push("On3");
            const d = sOn3Res.data;
            if (d.on3Rating != null) data.on3Rating = d.on3Rating;
            if (d.on3NationalRank != null) data.on3NationalRank = d.on3NationalRank;
            if (d.on3PositionRank != null) data.on3PositionRank = d.on3PositionRank;
            if (d.fortyTime) data.fortyTime = String(d.fortyTime);
            if (d.vertical) data.vertical = String(d.vertical);
            if (d.wingspan) data.wingspan = String(d.wingspan);
            if (d.handSize) data.handSize = String(d.handSize);
          }
        } catch {
          // Firecrawl is non-critical
        }

        // School logo fallback if CFBD didn't provide one
        if (!data.schoolLogoUrl) {
          try {
            const logoRes = await firecrawlApi.fetchSchoolLogo(schoolTag);
            if (logoRes.success && logoRes.logoUrl) {
              data.schoolLogoUrl = logoRes.logoUrl;
            }
          } catch {
            // non-critical
          }
        }
      }

      // Build field entries for review UI
      const entries: FieldEntry[] = [];
      const manualFields = new Set(["firstName", "lastName", "school"]);

      for (const [key, value] of Object.entries(data)) {
        if (manualFields.has(key)) continue;
        if (value === null || value === undefined || value === "") continue;

        // Determine source
        let source: FieldSource = "cfbd";
        if (srcList.includes("247Sports") && ["nationalRank", "positionRank", "stateRank", "recruitingRating"].includes(key)) {
          source = "247";
        }
        if (srcList.includes("On3") && ["on3Rating", "on3NationalRank", "on3PositionRank", "fortyTime", "vertical", "wingspan", "handSize"].includes(key)) {
          source = "on3";
        }

        entries.push({
          key,
          label: fieldLabels[key] || key,
          value,
          source,
        });
      }

      setEnrichedFields(entries);
      setSources(srcList);

      // Auto-select all fields that aren't manually set
      const currentSources = store.getState().fieldSources;
      const autoSelected = new Set<string>();
      for (const entry of entries) {
        if (currentSources[entry.key] !== "manual") {
          autoSelected.add(entry.key);
        }
      }
      setSelectedKeys(autoSelected);

      if (entries.length > 0) {
        setStatus("results");
      } else {
        setStatus("error");
        setErrorMessage("No profile data found for this athlete.");
      }
    };

    // Decision based on score
    if (bestScore > 75) {
      await runEnrichment();
    } else if (bestScore >= 60 && bestCandidate) {
      // Confirm identity
      setConfirmCandidate({
        name: `${bestCandidate.first_name} ${bestCandidate.last_name}`,
        school: schoolForCfbd,
        position: bestCandidate.position || "",
      });
      pendingEnrichRef.current = runEnrichment;
      setStatus("confirm");
    } else {
      // Skip CFBD, still try Firecrawl
      bestCandidate = null;
      bestScore = 0;
      await runEnrichment();
    }
  }, [canScrape, firstName, lastName, school, position, jersey, classYear, setAthleteFromSource]);

  /* ── Confirm identity ──────────────────────────────────────── */

  const confirmIdentity = useCallback(async () => {
    if (pendingEnrichRef.current) {
      await pendingEnrichRef.current();
      pendingEnrichRef.current = null;
    }
  }, []);

  const rejectIdentity = useCallback(() => {
    setConfirmCandidate(null);
    pendingEnrichRef.current = null;
    setStatus("idle");
  }, []);

  /* ── Toggle field selection ──────────────────────────────── */

  const toggleField = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  /* ── Apply selected fields ──────────────────────────────── */

  const apply = useCallback(async () => {
    if (enrichedFields.length === 0) return;
    setStatus("applying");

    const slug = `${firstName}-${lastName}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
    const timestamp = Date.now();

    // Group by source for setAthleteFromSource
    const bySource: Record<FieldSource, Record<string, unknown>> = {
      cfbd: {},
      "247": {},
      on3: {},
      firecrawl: {},
      manual: {},
    };

    for (const entry of enrichedFields) {
      if (!selectedKeys.has(entry.key)) continue;

      // Handle image uploads
      if (entry.key === "actionPhotoUrl" && typeof entry.value === "string" && entry.value.startsWith("http")) {
        const ext = entry.value.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || "jpg";
        const fileName = `${slug}/headshot-${timestamp}.${ext}`;
        const publicUrl = await uploadImageViaProxy(entry.value, fileName);
        if (publicUrl) {
          bySource[entry.source].actionPhotoUrl = publicUrl;
        }
        continue;
      }

      if (entry.key === "schoolLogoUrl" && typeof entry.value === "string" && entry.value.startsWith("http")) {
        const ext = entry.value.match(/\.(jpg|jpeg|png|webp|svg)/i)?.[1] || "png";
        const fileName = `${slug}/school-logo-${timestamp}.${ext}`;
        const publicUrl = await uploadImageViaProxy(entry.value, fileName);
        if (publicUrl) {
          bySource[entry.source].schoolLogoUrl = publicUrl;
        }
        continue;
      }

      bySource[entry.source][entry.key] = entry.value;
    }

    // Apply each source batch
    for (const [source, data] of Object.entries(bySource)) {
      if (Object.keys(data).length > 0) {
        setAthleteFromSource(data as Partial<Record<string, unknown>>, source as FieldSource);
      }
    }

    setStatus("done");
  }, [enrichedFields, selectedKeys, firstName, lastName, setAthleteFromSource]);

  /* ── Dismiss ──────────────────────────────────────────────── */

  const dismiss = useCallback(() => {
    setStatus("idle");
    setEnrichedFields([]);
    setErrorMessage("");
    setConfirmCandidate(null);
    pendingEnrichRef.current = null;
  }, []);

  return {
    status,
    canScrape,
    fullName,
    scrape,
    apply,
    dismiss,
    confirmIdentity,
    rejectIdentity,
    confirmCandidate,
    enrichedFields,
    selectedKeys,
    toggleField,
    sources,
    errorMessage,
    totalSelected: selectedKeys.size,
    totalItems: enrichedFields.length,
  };
}
