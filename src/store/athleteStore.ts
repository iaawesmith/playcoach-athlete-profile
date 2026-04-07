import { create } from "zustand";

type ActiveSection = "identity" | "performance" | "develop" | "pulse" | "connect";

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
  rating247: string;
  ratingOn3: string;
  ratingComposite: string;
  on3Rating: number | null;
  on3NationalRank: number | null;
  on3PositionRank: number | null;
  offersCount: number | null;
  nilValuation: string | null;
  commitmentStatus: "" | "committed" | "uncommitted" | "portal";
  transferFrom: string | null;
  transferStars: number | null;
  transferRating: number | null;
  upcomingGame: UpcomingGame | null;
  profileStatus: "draft" | "live";
  hasBeenPublished: boolean;
  lastPublishedAt: number | null;
  hasUnpublishedChanges: boolean;
  activeSection: ActiveSection;
  setAthlete: (data: Partial<AthleteData>) => void;
  publishProfile: () => void;
  markDirty: () => void;
  resetToDefaults: () => void;
  setActiveSection: (section: ActiveSection) => void;
}

type AthleteData = Omit<AthleteState, "setAthlete" | "publishProfile" | "markDirty" | "resetToDefaults" | "profileStatus" | "hasBeenPublished" | "lastPublishedAt" | "hasUnpublishedChanges" | "activeSection" | "setActiveSection">;

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
  rating247: "",
  ratingOn3: "",
  ratingComposite: "",
  on3Rating: null,
  on3NationalRank: null,
  on3PositionRank: null,
  offersCount: null,
  nilValuation: null,
  commitmentStatus: "",
  transferFrom: null,
  transferStars: null,
  transferRating: null,
  upcomingGame: null,
};

export const useAthleteStore = create<AthleteState>((set) => ({
  ...defaults,
  profileStatus: "draft",
  hasBeenPublished: false,
  lastPublishedAt: null,
  hasUnpublishedChanges: false,
  activeSection: "identity",
  setAthlete: (data) =>
    set((state) => ({
      ...state,
      ...data,
      hasUnpublishedChanges: true,
      profileStatus: state.profileStatus === "live" ? "draft" : state.profileStatus,
    })),
  publishProfile: () => set({ profileStatus: "live", hasBeenPublished: true, lastPublishedAt: Date.now(), hasUnpublishedChanges: false }),
  markDirty: () => set({ profileStatus: "draft" }),
  resetToDefaults: () => set({ ...defaults, profileStatus: "draft", lastPublishedAt: null, hasUnpublishedChanges: false }),
  setActiveSection: (section) => set({ activeSection: section }),
}));
