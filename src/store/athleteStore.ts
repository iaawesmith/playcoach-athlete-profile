import { create } from "zustand";

type ActiveSection = "identity" | "performance" | "develop" | "pulse" | "connect";

export type FieldSource = "manual" | "cfbd" | "247" | "on3" | "firecrawl";

export type MissingField = {
  field: string;
  source: "CFBD" | "247" | "ON3" | "247T" | "247P" | "FIRECRAWL";
  reason:
    | "Source not reached"
    | "Player not matched"
    | "Field not in response"
    | "Parsing failed"
    | "Not applicable";
};

interface UpcomingGame {
  opponent: string;
  date: string;
  time: string;
  network: string;
  location: string;
}

interface AthleteState {
  firstName: string;
  lastName: string;
  position: string;
  number: string;
  school: string;
  schoolAbbrev: string;
  classYear: string;
  teamColor: string;
  teamColorAlt: string;
  bio: string;
  quote: string;
  hometown: string;
  highSchool: string;
  height: string;
  weight: string;
  fortyTime: string;
  vertical: string;
  wingspan: string;
  handSize: string;
  actionPhotoUrl: string | null;
  profilePictureUrl: string | null;
  schoolLogoUrl: string | null;
  eligibilityYears: number;
  transferEligible: string;
  redshirtStatus: string;
  starRating: number;
  nationalRank: number | null;
  positionRank: number | null;
  stateRank: number | null;
  recruitingRating: number | null;
  ratingOn3: string;
  ratingComposite: string;
  on3Rating: number | null;
  on3NationalRank: number | null;
  on3PositionRank: number | null;
  on3StateRank: number | null;
  offersCount: number | null;
  nilValuation: string | null;
  commitmentStatus: "" | "committed" | "uncommitted" | "portal";
  transferStars247: number | null;
  transferRating247: number | null;
  transferOvrRank247: number | null;
  transferPositionRank247: number | null;
  prospectStars247: number | null;
  prospectRating247: number | null;
  prospectNatlRank247: number | null;
  prospectPositionRank247: number | null;
  prospectStateRank247: number | null;
  recruitingClassYear: string | null;
  transferFrom: string | null;
  transferStars: number | null;
  transferRating: number | null;
  upcomingGame: UpcomingGame | null;
  profileStatus: "draft" | "live";
  hasBeenPublished: boolean;
  lastPublishedAt: number | null;
  hasUnpublishedChanges: boolean;
  activeSection: ActiveSection;

  /** Tracks the source of each field value */
  fieldSources: Record<string, FieldSource>;

  /** Tracks fields that couldn't be populated during auto-fill */
  missingFields: MissingField[];

  setAthlete: (data: Partial<AthleteData>) => void;
  setAthleteFromSource: (data: Partial<AthleteData>, source: FieldSource) => void;
  getFieldSource: (field: string) => FieldSource | undefined;
  setMissingFields: (fields: MissingField[]) => void;
  publishProfile: () => void;
  markDirty: () => void;
  resetToDefaults: () => void;
  setActiveSection: (section: ActiveSection) => void;
}

type AthleteData = Omit<AthleteState, "setAthlete" | "setAthleteFromSource" | "getFieldSource" | "setMissingFields" | "publishProfile" | "markDirty" | "resetToDefaults" | "profileStatus" | "hasBeenPublished" | "lastPublishedAt" | "hasUnpublishedChanges" | "activeSection" | "setActiveSection" | "fieldSources" | "missingFields">;

/** Fields set during onboarding or by the user — never overwritten by pipelines */
const MANUAL_FIELDS = new Set(["firstName", "lastName", "school", "position", "classYear", "number"]);

const defaults: AthleteData = {
  firstName: "",
  lastName: "",
  position: "",
  number: "",
  school: "",
  schoolAbbrev: "",
  classYear: "",
  teamColor: "#50C4CA",
  teamColorAlt: "",
  bio: "",
  quote: "",
  hometown: "",
  highSchool: "",
  height: "",
  weight: "",
  fortyTime: "",
  vertical: "",
  wingspan: "",
  handSize: "",
  actionPhotoUrl: null,
  profilePictureUrl: null,
  schoolLogoUrl: null,
  eligibilityYears: 0,
  transferEligible: "",
  redshirtStatus: "",
  starRating: 0,
  nationalRank: null,
  positionRank: null,
  stateRank: null,
  recruitingRating: null,
  ratingOn3: "",
  ratingComposite: "",
  on3Rating: null,
  on3NationalRank: null,
  on3PositionRank: null,
  on3StateRank: null,
  offersCount: null,
  nilValuation: null,
  commitmentStatus: "",
  transferStars247: null,
  transferRating247: null,
  transferOvrRank247: null,
  transferPositionRank247: null,
  prospectStars247: null,
  prospectRating247: null,
  prospectNatlRank247: null,
  prospectPositionRank247: null,
  prospectStateRank247: null,
  recruitingClassYear: null,
  transferFrom: null,
  transferStars: null,
  transferRating: null,
  upcomingGame: null,
};

export const useAthleteStore = create<AthleteState>((set, get) => ({
  ...defaults,
  profileStatus: "draft",
  hasBeenPublished: false,
  lastPublishedAt: null,
  hasUnpublishedChanges: false,
  activeSection: "identity",
  fieldSources: {},
  missingFields: [],

  setAthlete: (data) =>
    set((state) => {
      // Direct setAthlete always tags as manual
      const newSources = { ...state.fieldSources };
      for (const key of Object.keys(data)) {
        newSources[key] = "manual";
      }
      return {
        ...state,
        ...data,
        fieldSources: newSources,
        hasUnpublishedChanges: true,
        profileStatus: state.profileStatus === "live" ? "draft" : state.profileStatus,
      };
    }),

  setAthleteFromSource: (data, source) =>
    set((state) => {
      const update: Record<string, unknown> = {};
      const newSources = { ...state.fieldSources };

      for (const [key, value] of Object.entries(data)) {
        const currentValue = state[key as keyof AthleteState];
        const isCurrentValueEmpty = currentValue === "" || currentValue === null || currentValue === undefined;
        // Allow pipeline data to fill blank identity fields, but never overwrite entered values
        if (MANUAL_FIELDS.has(key) && source !== "manual" && !isCurrentValueEmpty) continue;
        // Never overwrite a field already tagged as manual
        if (state.fieldSources[key] === "manual" && source !== "manual") continue;
        // Skip null/undefined/empty values
        if (value === null || value === undefined || value === "") continue;

        update[key] = value;
        newSources[key] = source;
      }

      if (Object.keys(update).length === 0) return state;

      return {
        ...state,
        ...update,
        fieldSources: newSources,
        hasUnpublishedChanges: true,
        profileStatus: state.profileStatus === "live" ? "draft" : state.profileStatus,
      };
    }),

  getFieldSource: (field) => get().fieldSources[field],
  setMissingFields: (fields) => set({ missingFields: fields }),

  publishProfile: () => set({ profileStatus: "live", hasBeenPublished: true, lastPublishedAt: Date.now(), hasUnpublishedChanges: false }),
  markDirty: () => set({ profileStatus: "draft" }),
  resetToDefaults: () => set({ ...defaults, fieldSources: {}, missingFields: [], profileStatus: "draft", lastPublishedAt: null, hasUnpublishedChanges: false }),
  setActiveSection: (section) => set({ activeSection: section }),
}));
