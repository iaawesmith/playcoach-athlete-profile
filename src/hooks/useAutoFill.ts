import { useState, useCallback, useRef } from "react";
import { useAthleteStore, type FieldSource } from "@/store/athleteStore";
import { cfbdApi } from "@/services/cfbd";
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

function scoreCandidateRoster(
  candidate: Record<string, unknown>,
  target: { firstName: string; lastName: string; position: string; jersey: string },
): number {
  // CFBD API returns camelCase: firstName, lastName, position, jersey
  const cf = String(candidate.firstName ?? candidate.first_name ?? "");
  const cl = String(candidate.lastName ?? candidate.last_name ?? "");
  let score = fuzzyNameScore(cf, cl, target.firstName, target.lastName);

  const pos = String(candidate.position ?? "");
  if (pos && target.position && pos.toUpperCase() === target.position.toUpperCase()) {
    score += 15;
  }

  const jerseyVal = candidate.jersey ?? candidate.jerseyNumber;
  if (jerseyVal != null && target.jersey) {
    if (String(jerseyVal) === target.jersey) score += 10;
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
  stars247: "247 Stars",
  rating247: "247 Rating",
  compositeStars247: "247 Composite Stars",
  compositeRating247: "247 Composite Rating",
  compositeNationalRank247: "247 Composite Natl. Rank",
  compositePositionRank247: "247 Composite Position Rank",
  compositeStateRank247: "247 Composite State Rank",
  on3StateRank: "On3 State Rank",
  recruitingClassYear: "Recruiting Class Year",
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

  /* ── PHASE 1: CFBD Direct API — writes to store immediately ── */

  const runCfbdPhase = useCallback(async (): Promise<{ espnId: string | null; errors: string[] }> => {
    const errors: string[] = [];

    // CHANGE 5: skip if minimum data is missing
    if (!firstName || !school) {
      return { espnId: null, errors: [] };
    }

    const currentYear = new Date().getFullYear();
    const rosterYears = [currentYear, currentYear - 1, currentYear - 2];
    const fullNameLower = `${firstName} ${lastName}`.trim().toLowerCase();
    const target = { firstName, lastName, position, jersey, school };
    const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();
    let espnId: string | null = null;

    // CHANGE 1 & 3: only roster, recruiting, portal, games — no teams()
    const settled = await Promise.allSettled([
      ...rosterYears.map((year) => cfbdApi.roster(school, year)),
      cfbdApi.recruitingPlayers(`${firstName} ${lastName}`),
      cfbdApi.playerPortal(currentYear, school),
      cfbdApi.upcomingGames(school, currentYear),
    ]);

    // Helper to extract data from settled results
    const readSettled = <T,>(
      index: number,
      label: string,
    ): T | null => {
      const result = settled[index];
      if (result.status === "rejected") {
        errors.push(`${label} ✗ (${String(result.reason)})`);
        return null;
      }
      const value = result.value as { success: true; data: T } | { success: false; error: string };
      if (value.success === false) {
        errors.push(`${label} ✗ (${value.error})`);
        return null;
      }
      return value.data;
    };

    const cfbdData: Record<string, unknown> = {};

    // ── Roster: height, weight, hometown, headshot, ESPN ID ──
    let bestCandidate: Record<string, unknown> | null = null;
    let bestScore = 0;
    for (let i = 0; i < rosterYears.length; i++) {
      const roster = readSettled<Record<string, unknown>[]>(i, `roster ${rosterYears[i]}`);
      if (!roster) continue;
      for (const player of roster) {
        const score = scoreCandidateRoster(player, target) + 35;
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = player;
        }
      }
    }

    if (bestCandidate && bestScore >= 70) {
      const h = bestCandidate.height;
      const w = bestCandidate.weight;
      const city = bestCandidate.homeCity ?? bestCandidate.home_city;
      const state = bestCandidate.homeState ?? bestCandidate.home_state;

      if (h) cfbdData.height = String(h);
      if (w) cfbdData.weight = String(w);
      if (city && state) cfbdData.hometown = `${city}, ${state}`;

      // Headshot — only if photo is currently empty
      const headshot = String(bestCandidate.headshot_url ?? bestCandidate.headshotUrl ?? "");
      if (headshot && !store.getState().profilePictureUrl) {
        cfbdData.profilePictureUrl = headshot;
      }

      // Extract ESPN ID for action photo phase
      if (headshot) {
        espnId = extractEspnId(headshot);
      }

      errors.push(`roster ✓ (${String(bestCandidate.firstName)} ${String(bestCandidate.lastName)}, score ${bestScore})`);
    } else {
      errors.push(`roster ✗ (best score ${bestScore}, need 70)`);
    }

    // ── Recruiting: starRating, recruitingRating, nationalRank, highSchool, commitmentStatus ──
    const recruitingIdx = rosterYears.length;
    const recruitingData = readSettled<Record<string, unknown>[]>(recruitingIdx, "recruiting");
    if (recruitingData && recruitingData.length > 0) {
      const recruit = recruitingData.find((entry) => normalize(entry.name) === fullNameLower) ?? null;
      if (recruit) {
        if (recruit.stars) cfbdData.starRating = recruit.stars;
        if (recruit.rating) {
          cfbdData.recruitingRating = recruit.rating;
          cfbdData.ratingComposite = Number(recruit.rating).toFixed(4);
        }
        if (recruit.ranking) cfbdData.nationalRank = recruit.ranking;
        if (recruit.school) cfbdData.highSchool = String(recruit.school);
        const committed = recruit.committedTo ?? recruit.committed_to;
        cfbdData.commitmentStatus = committed ? "committed" : "uncommitted";
        if (recruit.year) cfbdData.recruitingClassYear = String(recruit.year);
        errors.push("recruiting ✓");
      } else {
        errors.push(`recruiting ✗ (no name match)`);
      }
    }

    // ── Portal: transferFrom, eligibilityYears, transferStars, transferRating ──
    const portalIdx = rosterYears.length + 1;
    const portalData = readSettled<Record<string, unknown>[]>(portalIdx, "portal");
    if (portalData) {
      const portalMatch = portalData.find((entry) =>
        normalize(entry.firstName) === firstName.toLowerCase() &&
        normalize(entry.lastName) === lastName.toLowerCase(),
      );
      if (portalMatch) {
        if (portalMatch.origin) cfbdData.transferFrom = String(portalMatch.origin);
        const eligibility = String(portalMatch.eligibility ?? "");
        if (eligibility) cfbdData.eligibilityYears = parseInt(eligibility, 10) || 0;
        if (portalMatch.stars) cfbdData.transferStars = portalMatch.stars;
        if (portalMatch.rating) cfbdData.transferRating = portalMatch.rating;
        if (!portalMatch.destination) cfbdData.commitmentStatus = "portal";
        errors.push("portal ✓");
      }
    }

    // ── Games: upcomingGame ──
    const gamesIdx = rosterYears.length + 2;
    const gameData = readSettled<{ opponent: string; date: string; time: string; location: string } | null>(gamesIdx, "games");
    if (gameData) {
      cfbdData.upcomingGame = {
        opponent: gameData.opponent,
        date: gameData.date,
        time: gameData.time,
        network: "",
        location: gameData.location,
      };
      errors.push("games ✓");
    }

    // CHANGE 2: write directly to store — never appears in ScrapeFill
    if (Object.keys(cfbdData).length > 0) {
      setAthleteFromSource(cfbdData as Partial<Record<string, unknown>>, "cfbd");
      errors.push(`store ✓ (${Object.keys(cfbdData).join(", ")})`);
    } else {
      errors.push("store ✗ (no data extracted)");
    }

    return { espnId, errors };
  }, [firstName, lastName, school, position, jersey, store, setAthleteFromSource]);

  /* ── PHASE 2: Firecrawl (247 + On3) — results go to ScrapeFill modal ── */

  const runFirecrawlPhase = useCallback(async (espnId: string | null) => {
    if (!firstName || !lastName || !school) {
      setStatus("done");
      return;
    }

    setStatus("enriching");

    const data: EnrichedData = {};
    const srcList: string[] = [];
    const posTag = position || store.getState().position || "";
    const schoolTag = school;
    let actionPhotoFrom247: string | null = null;
    let actionPhotoFromOn3: string | null = null;

    try {
      const [s247Res, sOn3Res] = await Promise.all([
        firecrawlApi.search247Profile(firstName, lastName, posTag, schoolTag),
        firecrawlApi.searchOn3Profile(firstName, lastName, posTag, schoolTag),
      ]);

      if (s247Res.success && s247Res.data) {
        srcList.push("247Sports");
        const d = s247Res.data as Record<string, unknown>;
        if (d.stars != null) data.stars247 = d.stars;
        if (d.playerRating247 != null) data.rating247 = d.playerRating247;
        if (d.positionRank != null) data.positionRank = d.positionRank;
        if (d.stateRank != null) data.stateRank = d.stateRank;
        if (d.compositeStars247 != null) data.compositeStars247 = d.compositeStars247;
        if (d.compositeRating != null) data.compositeRating247 = d.compositeRating;
        if (d.compositeRating247 != null) data.compositeRating247 = d.compositeRating247;
        if (d.compositeNationalRank247 != null) data.compositeNationalRank247 = d.compositeNationalRank247;
        if (d.compositePositionRank247 != null) data.compositePositionRank247 = d.compositePositionRank247;
        if (d.compositeStateRank247 != null) data.compositeStateRank247 = d.compositeStateRank247;
        if (d.nationalRank != null) data.compositeNationalRank247 = d.nationalRank;
        if (d.height) data.height = d.height;
        if (d.weight) data.weight = String(d.weight);
        if (d.highSchool) data.highSchool = d.highSchool;
        if (d.hometown) data.hometown = d.hometown;
        if (d.actionPhotoUrl && isValidActionPhoto(String(d.actionPhotoUrl))) {
          actionPhotoFrom247 = String(d.actionPhotoUrl);
        }
      }

      if (sOn3Res.success && sOn3Res.data) {
        srcList.push("On3");
        const d = sOn3Res.data;
        if (d.on3Rating != null) data.on3Rating = d.on3Rating;
        if (d.on3NationalRank != null) data.on3NationalRank = d.on3NationalRank;
        if (d.on3PositionRank != null) data.on3PositionRank = d.on3PositionRank;
        if (d.on3StateRank != null) data.on3StateRank = d.on3StateRank;
        if (d.nilValuation) data.nilValuation = d.nilValuation;
        if (d.actionPhotoUrl && isValidActionPhoto(d.actionPhotoUrl)) {
          actionPhotoFromOn3 = d.actionPhotoUrl;
        }
      }
    } catch {
      // Firecrawl is non-critical
    }

    // Action photo resolution — only if actionPhoto is currently empty
    if (!store.getState().actionPhotoUrl) {
      let resolvedActionPhoto: string | null = null;

      if (actionPhotoFromOn3) {
        resolvedActionPhoto = actionPhotoFromOn3;
      } else if (actionPhotoFrom247) {
        resolvedActionPhoto = actionPhotoFrom247;
      }

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

    // School logo fallback (only if not already set from onboarding)
    if (!store.getState().schoolLogoUrl) {
      try {
        const logoRes = await firecrawlApi.fetchSchoolLogo(schoolTag);
        if (logoRes.success && logoRes.logoUrl) {
          data.schoolLogoUrl = logoRes.logoUrl;
        }
      } catch {
        // non-critical
      }
    }

    // Build field entries for ScrapeFill review — CFBD data is NOT included here
    const entries: FieldEntry[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined || value === "") continue;

      let source: FieldSource = "firecrawl";
      if (srcList.includes("247Sports") && [
        "stars247", "rating247", "positionRank", "stateRank",
        "compositeStars247", "compositeRating247",
        "compositeNationalRank247", "compositePositionRank247", "compositeStateRank247",
        "height", "weight", "highSchool", "hometown",
      ].includes(key)) {
        source = "247";
      }
      if (srcList.includes("On3") && [
        "on3Rating", "on3NationalRank", "on3PositionRank", "on3StateRank", "nilValuation",
      ].includes(key)) {
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
      setStatus("done");
    }
  }, [firstName, lastName, school, position, store, setAthleteFromSource]);

  /* ── Main scrape entry ──────────────────────────────────────── */

  const scrape = useCallback(async () => {
    if (!canScrape) return;
    setStatus("resolving");
    setErrorMessage("");
    setEnrichedFields([]);
    setSources([]);
    setConfirmCandidate(null);

    const diagParts: string[] = [];
    let espnId: string | null = null;

    // CHANGE 4 & 5: CFBD phase wrapped in try/catch, never blocks Firecrawl
    if (firstName && school) {
      try {
        const cfbdResult = await runCfbdPhase();
        espnId = cfbdResult.espnId;
        if (cfbdResult.errors.length > 0) {
          diagParts.push(`CFBD: ${cfbdResult.errors.join(", ")}`);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        diagParts.push(`CFBD crashed: ${msg}`);
      }
    }

    // Phase 2: Firecrawl — always runs regardless of CFBD outcome
    try {
      await runFirecrawlPhase(espnId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      diagParts.push(`Firecrawl crashed: ${msg}`);
    }

    if (diagParts.length > 0) {
      setErrorMessage(diagParts.join(" | "));
    }

    // Only show error status if absolutely nothing was written
    const storeAfter = useAthleteStore.getState();
    const anyDataWritten = !!(storeAfter.height || storeAfter.weight || storeAfter.hometown);
    if (!anyDataWritten && diagParts.length > 0) {
      setStatus("error");
    }
  }, [canScrape, firstName, school, runCfbdPhase, runFirecrawlPhase]);

  /* ── Confirm identity (kept for backward compat) ────────── */

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

  /* ── Apply selected fields (Firecrawl results only) ──────── */

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
