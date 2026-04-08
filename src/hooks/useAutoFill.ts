import { useState, useCallback, useRef } from "react";
import { useAthleteStore, type FieldSource, type MissingField } from "@/store/athleteStore";
import { cfbdApi, resolveTeamName } from "@/services/cfbd";
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

/* (scoring helpers removed — roster matching uses direct name comparison) */

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
  transferStars247: "Stars (Transfer)",
  transferRating247: "Rating (Transfer)",
  transferOvrRank247: "OVR Rank",
  transferPositionRank247: "Position Rank (Transfer)",
  prospectStars247: "Stars (Prospect)",
  prospectRating247: "Rating (Prospect)",
  prospectNatlRank247: "NATL. Rank",
  prospectPositionRank247: "Position Rank (Prospect)",
  prospectStateRank247: "State Rank (Prospect)",
  on3StateRank: "On3 State Rank",
  recruitingClassYear: "Recruiting Class Year",
};

export const formatDisplayValue = (key: string, val: unknown): string => {
  if (val === null || val === undefined) return "—";
  const normalizedKey = key.startsWith("cfbd_") ? key.slice(5) : key;
  if (normalizedKey === "height") {
    const total = parseInt(String(val), 10);
    if (total > 11) return `${Math.floor(total / 12)}'${total % 12}"`;
  }
  if (normalizedKey === "upcomingGame" && typeof val === "object") {
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
  const [localMissingFields, setLocalMissingFields] = useState<MissingField[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [confirmCandidate, setConfirmCandidate] = useState<{ name: string; school: string; position: string } | null>(null);
  const pendingEnrichRef = useRef<(() => Promise<void>) | null>(null);

  const fullName = `${firstName} ${lastName}`.trim();
  const canScrape = fullName.length >= 3;

  /* ── PHASE 1: CFBD Direct API — writes to store immediately ── */

  const runCfbdPhase = useCallback(async (): Promise<{ espnId: string | null; errors: string[]; cfbdData: Record<string, unknown> }> => {
    const errors: string[] = [];

    if (!firstName || !school) {
      return { espnId: null, errors: [], cfbdData: {} };
    }

    // Resolve display name → CFBD short name
    const cfbdTeam = await resolveTeamName(school);
    if (!cfbdTeam) {
      errors.push(`team ✗ (no CFBD match for "${school}")`);
      return { espnId: null, errors, cfbdData: {} };
    }
    errors.push(`team ✓ (${cfbdTeam})`);

    const currentYear = new Date().getFullYear();
    const rosterYears = [currentYear, currentYear - 1, currentYear - 2];
    const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();
    const firstLower = firstName.toLowerCase().trim();
    const lastLower = lastName.toLowerCase().trim();
    let espnId: string | null = null;

    const settled = await Promise.allSettled([
      ...rosterYears.map((year) => cfbdApi.roster(cfbdTeam, year)),
      cfbdApi.recruitingPlayers(cfbdTeam),
      cfbdApi.playerPortal(currentYear, cfbdTeam),
      cfbdApi.upcomingGames(cfbdTeam, currentYear),
    ]);

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

    // ── Roster: find player by name, extract data ──
    // CFBD returns camelCase: firstName, lastName, homeCity, homeState
    let matched: Record<string, unknown> | null = null;
    let rosterTotal = 0;
    for (let i = 0; i < rosterYears.length; i++) {
      const roster = readSettled<Record<string, unknown>[]>(i, `roster ${rosterYears[i]}`);
      if (!roster) continue;
      rosterTotal += roster.length;

      // Exact first+last match (camelCase primary, snake_case fallback)
      const exact = roster.find(
        (p) =>
          normalize(p.firstName ?? p.first_name) === firstLower &&
          normalize(p.lastName ?? p.last_name) === lastLower,
      );
      if (exact) { matched = exact; break; }

      // Last name fallback (handles nicknames)
      if (!matched) {
        const lastOnly = roster.find(
          (p) => normalize(p.lastName ?? p.last_name) === lastLower,
        );
        if (lastOnly) matched = lastOnly;
      }
    }

    if (matched) {
      const h = matched.height;
      const w = matched.weight;
      const city = matched.homeCity ?? matched.home_city;
      const state = matched.homeState ?? matched.home_state;
      const pos = matched.position;
      const jer = matched.jersey;
      const yr = matched.year;
      const playerId = matched.id;

      if (h) cfbdData.height = String(h);
      if (w) cfbdData.weight = String(w);
      if (city && state) cfbdData.hometown = `${city}, ${state}`;
      if (pos) cfbdData.position = String(pos);
      if (jer) cfbdData.number = String(jer);
      if (yr && yearToClass[Number(yr)]) cfbdData.classYear = yearToClass[Number(yr)];

      const headshot = String(matched.headshot_url ?? matched.headshotUrl ?? "");
      if (headshot && !store.getState().profilePictureUrl) {
        cfbdData.profilePictureUrl = headshot;
      }
      if (headshot) {
        espnId = extractEspnId(headshot);
      }
      // Use roster player id as ESPN fallback
      if (!espnId && playerId) {
        espnId = String(playerId);
      }

      const mFirst = String(matched.firstName ?? matched.first_name ?? "");
      const mLast = String(matched.lastName ?? matched.last_name ?? "");
      errors.push(`roster ✓ (${mFirst} ${mLast})`);
    } else {
      errors.push(`roster ✗ (${rosterTotal} players scanned, no match for "${firstName} ${lastName}")`);
    }

    // ── Recruiting ──
    const recruitingIdx = rosterYears.length;
    const recruitingData = readSettled<Record<string, unknown>[]>(recruitingIdx, "recruiting");
    if (recruitingData && recruitingData.length > 0) {
      // Match by name — CFBD recruiting uses camelCase or "name" field
      const recruit = recruitingData.find((entry) => {
        const n = normalize(entry.name);
        if (n === `${firstLower} ${lastLower}`) return true;
        const eFirst = normalize(entry.firstName ?? entry.first_name);
        const eLast = normalize(entry.lastName ?? entry.last_name);
        if (eFirst === firstLower && eLast === lastLower) return true;
        // Last name fallback
        return eLast === lastLower;
      }) ?? null;
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
        errors.push(`recruiting ✗ (${recruitingData.length} recruits, no match for "${firstName} ${lastName}")`);
      }
    }

    // ── Portal ──
    const portalIdx = rosterYears.length + 1;
    const portalResult = settled[portalIdx];
    let portalData: Record<string, unknown>[] | null = null;
    if (portalResult.status === "rejected") {
      const reason = String(portalResult.reason ?? "");
      if (!reason.includes("404")) {
        errors.push(`portal ✗ (${reason})`);
      }
    } else {
      const value = portalResult.value as { success: true; data: Record<string, unknown>[] } | { success: false; error: string };
      if (value.success === false) {
        if (!value.error.includes("404")) {
          errors.push(`portal ✗ (${value.error})`);
        }
      } else {
        portalData = value.data;
      }
    }
    if (portalData) {
      const portalMatch = portalData.find((entry) =>
        normalize(entry.firstName) === firstLower &&
        normalize(entry.lastName) === lastLower,
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

    // ── Games (with fallback to previous year) ──
    const gamesIdx = rosterYears.length + 2;
    let gameData = readSettled<{ opponent: string; date: string; time: string; location: string } | null>(gamesIdx, "games");
    if (!gameData) {
      const fallback = await cfbdApi.upcomingGames(cfbdTeam, currentYear - 1);
      if (fallback.success) gameData = fallback.data;
    }
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

    if (Object.keys(cfbdData).length > 0) {
      setAthleteFromSource(cfbdData as Partial<Record<string, unknown>>, "cfbd");
      errors.push(`store ✓ (${Object.keys(cfbdData).join(", ")})`);
    } else {
      errors.push("store ✗ (no data extracted)");
    }

    return { espnId, errors, cfbdData };
  }, [firstName, lastName, school, position, jersey, store, setAthleteFromSource]);

  /* ── PHASE 2: Firecrawl (247 + On3) — results go to ScrapeFill modal ── */

  const runFirecrawlPhase = useCallback(async (espnId: string | null, cfbdData: Record<string, unknown> = {}) => {
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

      // 247Sports — backend returns new transfer/prospect fields
      if (s247Res.success && s247Res.data) {
        srcList.push("247Sports");
        const d = s247Res.data as Record<string, unknown>;
        if (d.transferStars247 != null) data.transferStars247 = d.transferStars247;
        if (d.transferRating247 != null) data.transferRating247 = d.transferRating247;
        if (d.transferOvrRank247 != null) data.transferOvrRank247 = d.transferOvrRank247;
        if (d.transferPositionRank247 != null) data.transferPositionRank247 = d.transferPositionRank247;
        if (d.prospectStars247 != null) data.prospectStars247 = d.prospectStars247;
        if (d.prospectRating247 != null) data.prospectRating247 = d.prospectRating247;
        if (d.prospectNatlRank247 != null) data.prospectNatlRank247 = d.prospectNatlRank247;
        if (d.prospectPositionRank247 != null) data.prospectPositionRank247 = d.prospectPositionRank247;
        if (d.prospectStateRank247 != null) data.prospectStateRank247 = d.prospectStateRank247;
        if (d.highSchool) data.highSchool = String(d.highSchool);
        if (d.actionPhotoUrl && isValidActionPhoto(String(d.actionPhotoUrl))) {
          actionPhotoFrom247 = String(d.actionPhotoUrl);
        }
      } else {
        // 247 was attempted but returned no data — track for missing fields
        srcList.push("247Sports");
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
      } else {
        // On3 was attempted but returned no data — track for missing fields
        srcList.push("On3");
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

      /* Google Image Search removed — unreliable, returns wrong players */

      if (resolvedActionPhoto) {
        data.actionPhotoUrl = resolvedActionPhoto;
        // Write to store immediately so ProCard updates in real-time
        const photoSource: FieldSource = (actionPhotoFromOn3 && resolvedActionPhoto === actionPhotoFromOn3) ? "on3"
          : (actionPhotoFrom247 && resolvedActionPhoto === actionPhotoFrom247) ? "247"
          : "firecrawl";
        setAthleteFromSource({ actionPhotoUrl: resolvedActionPhoto }, photoSource);
      }
    }

    // Write 247 rating data to store immediately so ProCard updates live
    const immediateRatingFields: Record<string, unknown> = {};
    if (data.transferStars247 != null) immediateRatingFields.transferStars247 = data.transferStars247;
    if (data.transferRating247 != null) immediateRatingFields.transferRating247 = data.transferRating247;
    if (data.transferOvrRank247 != null) immediateRatingFields.transferOvrRank247 = data.transferOvrRank247;
    if (data.transferPositionRank247 != null) immediateRatingFields.transferPositionRank247 = data.transferPositionRank247;
    if (data.prospectStars247 != null) immediateRatingFields.prospectStars247 = data.prospectStars247;
    if (data.prospectRating247 != null) immediateRatingFields.prospectRating247 = data.prospectRating247;
    if (data.prospectNatlRank247 != null) immediateRatingFields.prospectNatlRank247 = data.prospectNatlRank247;
    if (data.prospectPositionRank247 != null) immediateRatingFields.prospectPositionRank247 = data.prospectPositionRank247;
    if (data.prospectStateRank247 != null) immediateRatingFields.prospectStateRank247 = data.prospectStateRank247;

    if (Object.keys(immediateRatingFields).length > 0) {
      setAthleteFromSource(immediateRatingFields as Partial<Record<string, unknown>>, "247");
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

    // Build field entries for review — include CFBD data as read-only reference
    const entries: FieldEntry[] = [];

    // Add CFBD-sourced fields first (already applied to store)
    for (const [key, value] of Object.entries(cfbdData)) {
      if (value === null || value === undefined || value === "") continue;
      entries.push({
        key: `cfbd_${key}`,
        label: fieldLabels[key] || key,
        value,
        source: "cfbd",
      });
    }

    if (Object.keys(cfbdData).length > 0 && !srcList.includes("CFBD")) {
      srcList.push("CFBD");
    }

    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined || value === "") continue;

      let source: FieldSource = "firecrawl";
      if (srcList.includes("247Sports") && [
        "transferStars247", "transferRating247", "transferOvrRank247", "transferPositionRank247",
        "prospectStars247", "prospectRating247", "prospectNatlRank247", "prospectPositionRank247", "prospectStateRank247",
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
      // CFBD entries are already applied — auto-select for display
      if (entry.key.startsWith("cfbd_")) {
        autoSelected.add(entry.key);
        continue;
      }
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

    try {
      setStatus("resolving");
      setErrorMessage("");
      setEnrichedFields([]);
      setSources([]);
      setConfirmCandidate(null);
      setLocalMissingFields([]);

      const diagParts: string[] = [];
      let espnId: string | null = null;

      let cfbdDataResult: Record<string, unknown> = {};
      let cfbdRosterFound = false;
      let cfbdRecruitFound = false;
      let cfbdRosterReached = true;
      let cfbdRecruitReached = true;

      // CFBD phase — only if firstName and school are set
      if (firstName && school) {
        try {
          const cfbdResult = await runCfbdPhase();
          espnId = cfbdResult.espnId;
          cfbdDataResult = cfbdResult.cfbdData;
          cfbdRosterFound = !!cfbdDataResult.height || !!cfbdDataResult.position;
          cfbdRecruitFound = !!cfbdDataResult.starRating || !!cfbdDataResult.recruitingRating;
          if (cfbdResult.errors.length > 0) {
            diagParts.push(`CFBD: ${cfbdResult.errors.join(", ")}`);
            // "Source not reached" = the API call itself failed (network error, no CFBD team match)
            // "Player not matched" = API returned data but player wasn't in results
            // Check for team resolution failure or actual HTTP errors — not just "✗" in player-match messages
            const hasTeamFailure = cfbdResult.errors.some((e) => e.includes("team ✗"));
            const hasRosterApiFailure = cfbdResult.errors.some((e) => e.match(/roster \d+ ✗/) != null);
            const hasRecruitApiFailure = cfbdResult.errors.some((e) => e.startsWith("recruiting ✗") && e.includes("(") && !e.includes("recruits"));
            cfbdRosterReached = !hasTeamFailure && !hasRosterApiFailure;
            cfbdRecruitReached = !hasTeamFailure && !hasRecruitApiFailure;
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          diagParts.push(`CFBD crashed: ${msg}`);
          cfbdRosterReached = false;
          cfbdRecruitReached = false;
        }
      }

      // Firecrawl — always runs regardless of CFBD outcome
      try {
        await runFirecrawlPhase(espnId, cfbdDataResult);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        diagParts.push(`Firecrawl crashed: ${msg}`);
      }

      // ── Missing field tracking ──
      const missingFields: MissingField[] = [];
      const storeAfter = useAthleteStore.getState();
      const pos = storeAfter.position || position || "";

      // CFBD roster fields
      const cfbdRosterFields = ["Height", "Weight", "Position", "Number", "Class"];
      if (!cfbdRosterReached) {
        cfbdRosterFields.forEach((f) => missingFields.push({ field: f, source: "CFBD", reason: "Source not reached" }));
      } else if (!cfbdRosterFound) {
        cfbdRosterFields.forEach((f) => missingFields.push({ field: f, source: "CFBD", reason: "Player not matched" }));
      } else {
        if (!storeAfter.height) missingFields.push({ field: "Height", source: "CFBD", reason: "Field not in response" });
        if (!storeAfter.weight) missingFields.push({ field: "Weight", source: "CFBD", reason: "Field not in response" });
        if (!storeAfter.position) missingFields.push({ field: "Position", source: "CFBD", reason: "Field not in response" });
        if (!storeAfter.number) missingFields.push({ field: "Number", source: "CFBD", reason: "Field not in response" });
        if (!storeAfter.classYear) missingFields.push({ field: "Class", source: "CFBD", reason: "Field not in response" });
      }

      // CFBD recruiting fields
      if (!cfbdRecruitReached) {
        ["Stars (CFBD)", "Recruiting Rating"].forEach((f) =>
          missingFields.push({ field: f, source: "CFBD", reason: "Source not reached" }),
        );
      } else if (!cfbdRecruitFound) {
        ["Stars (CFBD)", "Recruiting Rating"].forEach((f) =>
          missingFields.push({ field: f, source: "CFBD", reason: "Player not matched" }),
        );
      } else {
        if (!storeAfter.starRating) missingFields.push({ field: "Stars (CFBD)", source: "CFBD", reason: "Field not in response" });
        if (!storeAfter.recruitingRating) missingFields.push({ field: "Recruiting Rating", source: "CFBD", reason: "Field not in response" });
      }

      // High School — sourced from 247
      if (!storeAfter.highSchool) missingFields.push({ field: "High School", source: "247", reason: "Field not in response" });

      // 247Sports fields — check store for enriched values (transfer + prospect)
      const has247Transfer = storeAfter.transferStars247 != null || storeAfter.transferRating247 != null;
      const has247Prospect = storeAfter.prospectStars247 != null || storeAfter.prospectRating247 != null;
      const has247Data = has247Transfer || has247Prospect;
      if (!has247Data) {
        ["Stars (Transfer)", "Rating (Transfer)", "OVR Rank", `${pos} Rank (Transfer)`,
          "Stars (Prospect)", "Rating (Prospect)", "NATL. Rank",
          `${pos} Rank (Prospect)`, "State Rank (Prospect)",
        ].forEach((f) => missingFields.push({ field: f, source: "247T", reason: "Player not matched" }));
      } else {
        // Transfer fields
        if (storeAfter.transferStars247 == null) missingFields.push({ field: "Stars (Transfer)", source: "247T", reason: "Parsing failed" });
        if (storeAfter.transferRating247 == null) missingFields.push({ field: "Rating (Transfer)", source: "247T", reason: "Parsing failed" });
        if (storeAfter.transferOvrRank247 == null) missingFields.push({ field: "OVR Rank", source: "247T", reason: "Parsing failed" });
        if (storeAfter.transferPositionRank247 == null) missingFields.push({ field: `${pos} Rank (Transfer)`, source: "247T", reason: "Parsing failed" });
        // Prospect fields
        if (storeAfter.prospectStars247 == null) missingFields.push({ field: "Stars (Prospect)", source: "247P", reason: "Parsing failed" });
        if (storeAfter.prospectRating247 == null) missingFields.push({ field: "Rating (Prospect)", source: "247P", reason: "Parsing failed" });
        if (storeAfter.prospectNatlRank247 == null) missingFields.push({ field: "NATL. Rank", source: "247P", reason: "Parsing failed" });
        if (storeAfter.prospectPositionRank247 == null) missingFields.push({ field: `${pos} Rank (Prospect)`, source: "247P", reason: "Parsing failed" });
        if (storeAfter.prospectStateRank247 == null) missingFields.push({ field: "State Rank (Prospect)", source: "247P", reason: "Parsing failed" });
      }

      // On3 fields
      const hasOn3Data = storeAfter.on3Rating != null || storeAfter.on3NationalRank != null;
      if (!hasOn3Data) {
        // On3 is always attempted — if no data came back, player wasn't matched
        ["On3 Rating", "On3 National Rank", "On3 Position Rank", "NIL Valuation"].forEach((f) =>
          missingFields.push({ field: f, source: "ON3", reason: "Player not matched" }),
        );
      } else {
        if (storeAfter.on3Rating == null) missingFields.push({ field: "On3 Rating", source: "ON3", reason: "Field not in response" });
        if (storeAfter.on3NationalRank == null) missingFields.push({ field: "On3 National Rank", source: "ON3", reason: "Field not in response" });
        if (storeAfter.on3PositionRank == null) missingFields.push({ field: "On3 Position Rank", source: "ON3", reason: "Field not in response" });
        if (storeAfter.nilValuation == null) missingFields.push({ field: "NIL Valuation", source: "ON3", reason: "Field not in response" });
      }

      // Action photo
      if (!storeAfter.actionPhotoUrl) {
        missingFields.push({ field: "Action Photo", source: "FIRECRAWL", reason: "Source not reached" });
      }

      // Transfer fields
      if (storeAfter.commitmentStatus === "portal") {
        if (!storeAfter.transferFrom) missingFields.push({ field: "Transfer From", source: "CFBD", reason: "Field not in response" });
        if (!storeAfter.transferStars) missingFields.push({ field: "Transfer Stars", source: "CFBD", reason: "Field not in response" });
      }

      setLocalMissingFields(missingFields);
      useAthleteStore.getState().setMissingFields(missingFields);

      if (diagParts.length > 0) {
        setErrorMessage(diagParts.join(" | "));
      }

      // If we have missing fields to show, ensure results view is visible
      if (missingFields.length > 0) {
        setStatus("results");
      }

      // Only show error status if absolutely nothing was written and no missing fields to display
      const anyDataWritten = !!(storeAfter.height || storeAfter.weight || storeAfter.hometown);
      if (!anyDataWritten && diagParts.length > 0 && missingFields.length === 0) {
        setStatus("error");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMessage(`Auto-fill failed: ${msg}`);
      setStatus("error");
    }
  }, [canScrape, firstName, school, position, runCfbdPhase, runFirecrawlPhase]);

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
      // CFBD entries are already applied to store — skip
      if (entry.key.startsWith("cfbd_")) continue;

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
    missingFields: localMissingFields,
  };
}
