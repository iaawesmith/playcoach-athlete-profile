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
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

function extractEspnId(headshotUrl: string): string | null {
  const match = headshotUrl?.match(/\/full\/(\d+)\.png$/);
  return match ? match[1] : null;
}

function isValidActionPhoto(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.includes("hudl.com")) return false;
  if (lower.includes("maxpreps.com")) return false;
  if (lower.includes("/headshots/")) return false;
  if (lower.includes("placeholder")) return false;
  const hasImageExt = /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url);
  if (!hasImageExt) return false;
  return true;
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
  profilePictureUrl: "Profile Picture",
  actionPhotoUrl: "Action Photo",
  on3Rating: "On3 Rating",
  on3NationalRank: "On3 National Rank",
  on3PositionRank: "On3 Position Rank",
  fortyTime: "40-Yard Dash",
  vertical: "Vertical Leap",
  wingspan: "Wingspan",
  handSize: "Hand Size",
  offersCount: "Offers",
  nilValuation: "NIL Valuation",
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
      const teamsResult = await cfbdApi.teams(school);
      if (teamsResult.success && teamsResult.data.length > 0) {
        schoolForCfbd = teamsResult.data[0].school;
      }

      const yr = new Date().getFullYear();
      const rosterResult = await cfbdApi.roster(schoolForCfbd, yr);

      if (rosterResult.success && rosterResult.data) {
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
      let espnId: string | null = null;

      const yr = new Date().getFullYear();

      // Phase 1: CFBD parallel calls
      if (bestCandidate && bestScore > 75 && school) {
        const [recruitRes, teamsRes, portalRes, gameRes] = await Promise.all([
          cfbdApi.recruitingPlayers(`${firstName} ${lastName}`, schoolForCfbd),
          cfbdApi.teams(schoolForCfbd),
          cfbdApi.playerPortal(yr, schoolForCfbd),
          cfbdApi.upcomingGames(schoolForCfbd, yr),
        ]);

        srcList.push("CFBD");

        // 1a: Roster data
        if (bestCandidate.height) data.height = String(bestCandidate.height);
        if (bestCandidate.weight) data.weight = String(bestCandidate.weight);
        if (bestCandidate.jersey != null) data.number = String(bestCandidate.jersey);
        if (bestCandidate.position) data.position = bestCandidate.position;
        if (bestCandidate.year) data.classYear = yearToClass[bestCandidate.year] || String(bestCandidate.year);
        if (bestCandidate.home_city && bestCandidate.home_state) {
          data.hometown = `${bestCandidate.home_city}, ${bestCandidate.home_state}`;
        }

        // Profile picture from headshot — only if empty
        if (bestCandidate.headshot_url && !store.getState().profilePictureUrl) {
          data.profilePictureUrl = bestCandidate.headshot_url;
        }

        // Extract ESPN ID for Phase 3
        if (bestCandidate.headshot_url) {
          espnId = extractEspnId(bestCandidate.headshot_url);
        }

        // 1b: Recruiting
        if (recruitRes.success && recruitRes.data) {
          const recruit = recruitRes.data.find((r: CfbdRecruit) => r.athlete_id != null) ||
            (recruitRes.data.length > 0 ? recruitRes.data[0] : null);
          if (recruit) {
            if (recruit.stars) data.starRating = recruit.stars;
            if (recruit.rating) {
              data.recruitingRating = recruit.rating;
              data.ratingComposite = String(recruit.rating);
            }
            if (recruit.ranking) data.nationalRank = recruit.ranking;
            if (recruit.school) data.highSchool = recruit.school;
            data.commitmentStatus = recruit.committed_to ? "committed" : "uncommitted";
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
            if (!portalMatch.destination) data.commitmentStatus = "portal";
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

      // Phase 2: Firecrawl 247Sports + On3
      const posTag = position || String(data.position || "");
      const schoolTag = school || "";
      let actionPhotoFrom247: string | null = null;
      let actionPhotoFromOn3: string | null = null;

      if (schoolTag && firstName && lastName) {
        try {
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
            if (d.compositeRating != null) {
              data.recruitingRating = d.compositeRating;
              data.ratingComposite = String(d.compositeRating);
            }
            if (d.stars != null) data.starRating = d.stars;
            if (d.height) data.height = d.height;
            if (d.weight) data.weight = String(d.weight);
            if (d.highSchool) data.highSchool = d.highSchool;
            if (d.hometown) data.hometown = d.hometown;
            if (d.actionPhotoUrl && isValidActionPhoto(d.actionPhotoUrl)) {
              actionPhotoFrom247 = d.actionPhotoUrl;
            }
          }

          // On3 extraction
          if (sOn3Res.success && sOn3Res.data) {
            srcList.push("On3");
            const d = sOn3Res.data;
            if (d.on3Rating != null) data.on3Rating = d.on3Rating;
            if (d.on3NationalRank != null) data.on3NationalRank = d.on3NationalRank;
            if (d.on3PositionRank != null) data.on3PositionRank = d.on3PositionRank;
            if (d.on3StateRank != null) data.stateRank = d.on3StateRank;
            if (d.nilValuation) data.nilValuation = d.nilValuation;
            if (d.actionPhotoUrl && isValidActionPhoto(d.actionPhotoUrl)) {
              actionPhotoFromOn3 = d.actionPhotoUrl;
            }
          }
        } catch {
          // Firecrawl is non-critical
        }

        // School logo fallback
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

      // Phase 3: Action photo resolution — only if actionPhoto is currently empty
      if (!store.getState().actionPhotoUrl) {
        let resolvedActionPhoto: string | null = null;

        // Check On3 and 247 first (already scraped, free)
        if (actionPhotoFromOn3) {
          resolvedActionPhoto = actionPhotoFromOn3;
        } else if (actionPhotoFrom247) {
          resolvedActionPhoto = actionPhotoFrom247;
        }

        // Phase 3A: ESPN player page
        if (!resolvedActionPhoto && espnId) {
          try {
            const espnRes = await firecrawlApi.scrapeEspnActionPhoto(espnId, firstName, lastName);
            if (espnRes.success && espnRes.data?.actionPhotoUrl && isValidActionPhoto(espnRes.data.actionPhotoUrl)) {
              resolvedActionPhoto = espnRes.data.actionPhotoUrl;
            }
          } catch {
            // non-critical
          }
        }

        // Phase 3B: School athletic website
        if (!resolvedActionPhoto && schoolTag) {
          try {
            const schoolRes = await firecrawlApi.scrapeSchoolRosterPhoto(firstName, lastName, schoolTag);
            if (schoolRes.success && schoolRes.data?.actionPhotoUrl && isValidActionPhoto(schoolRes.data.actionPhotoUrl)) {
              resolvedActionPhoto = schoolRes.data.actionPhotoUrl;
            }
          } catch {
            // non-critical
          }
        }

        // Phase 3C: Google Image Search (last resort)
        if (!resolvedActionPhoto && schoolTag) {
          try {
            const googleRes = await firecrawlApi.scrapeGoogleImagePhoto(firstName, lastName, schoolTag);
            if (googleRes.success && googleRes.data?.actionPhotoUrl && isValidActionPhoto(googleRes.data.actionPhotoUrl)) {
              resolvedActionPhoto = googleRes.data.actionPhotoUrl;
            }
          } catch {
            // non-critical
          }
        }

        if (resolvedActionPhoto) {
          data.actionPhotoUrl = resolvedActionPhoto;
        }
      }

      // Immediate preview write — update ProCard-critical fields now
      const previewFields: Record<string, unknown> = {};
      if (data.height) previewFields.height = data.height;
      if (data.weight) previewFields.weight = data.weight;
      if (data.ratingComposite) previewFields.ratingComposite = data.ratingComposite;
      if (data.actionPhotoUrl && !store.getState().actionPhotoUrl) previewFields.actionPhotoUrl = data.actionPhotoUrl;
      if (Object.keys(previewFields).length > 0) {
        setAthleteFromSource(previewFields as Partial<Record<string, unknown>>, "cfbd");
      }

      // Build field entries for review UI
      const entries: FieldEntry[] = [];
      const manualFields = new Set(["firstName", "lastName", "school"]);

      for (const [key, value] of Object.entries(data)) {
        if (manualFields.has(key)) continue;
        if (value === null || value === undefined || value === "") continue;

        let source: FieldSource = "cfbd";
        if (srcList.includes("247Sports") && ["nationalRank", "positionRank", "stateRank", "compositeRating"].includes(key)) {
          source = "247";
        }
        if (srcList.includes("On3") && ["on3Rating", "on3NationalRank", "on3PositionRank", "nilValuation"].includes(key)) {
          source = "on3";
        }
        if (key === "actionPhotoUrl") {
          if (actionPhotoFromOn3 && data.actionPhotoUrl === actionPhotoFromOn3) source = "on3";
          else if (actionPhotoFrom247 && data.actionPhotoUrl === actionPhotoFrom247) source = "247";
          else source = "firecrawl";
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
      setConfirmCandidate({
        name: `${bestCandidate.first_name} ${bestCandidate.last_name}`,
        school: schoolForCfbd,
        position: bestCandidate.position || "",
      });
      pendingEnrichRef.current = runEnrichment;
      setStatus("confirm");
    } else {
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

    const bySource: Record<FieldSource, Record<string, unknown>> = {
      cfbd: {},
      "247": {},
      on3: {},
      firecrawl: {},
      manual: {},
    };

    for (const entry of enrichedFields) {
      if (!selectedKeys.has(entry.key)) continue;

      // Handle image uploads — proxy external URLs to storage
      if (
        (entry.key === "actionPhotoUrl" || entry.key === "profilePictureUrl" || entry.key === "schoolLogoUrl") &&
        typeof entry.value === "string" &&
        entry.value.startsWith("http")
      ) {
        const label = entry.key === "actionPhotoUrl" ? "action" : entry.key === "profilePictureUrl" ? "headshot" : "school-logo";
        const ext = entry.value.match(/\.(jpg|jpeg|png|webp|svg)/i)?.[1] || "jpg";
        const fileName = `${slug}/${label}-${timestamp}.${ext}`;
        const publicUrl = await uploadImageViaProxy(entry.value, fileName);
        if (publicUrl) {
          bySource[entry.source][entry.key] = publicUrl;
        }
        continue;
      }

      bySource[entry.source][entry.key] = entry.value;
    }

    for (const [source, batch] of Object.entries(bySource)) {
      if (Object.keys(batch).length > 0) {
        setAthleteFromSource(batch as Partial<Record<string, unknown>>, source as FieldSource);
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
