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
  schoolLogoUrl: string | null;
  eligibilityYears: number;
  transferEligible: string;
  redshirtStatus: string;
  starRating: number;
  nationalRank: number | null;
  positionRank: number | null;
  commitmentStatus: "" | "committed" | "uncommitted" | "portal";
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

type AthleteData = Omit<AthleteState, "setAthlete" | "publishProfile" | "markDirty" | "resetToDefaults" | "profileStatus" | "hasBeenPublished" | "activeSection" | "setActiveSection">;

const defaults: AthleteData = {
  firstName: "",
  lastName: "",
  position: "",
  number: "",
  school: "",
  schoolAbbrev: "",
  classYear: "",
  teamColor: "#50C4CA",
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
  schoolLogoUrl: null,
  eligibilityYears: 0,
  transferEligible: "",
  redshirtStatus: "",
  starRating: 0,
  nationalRank: null,
  positionRank: null,
  commitmentStatus: "",
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
