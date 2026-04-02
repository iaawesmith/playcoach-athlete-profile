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
  transferEligible: boolean;
  redshirtStatus: string;
  starRating: number;
  nationalRank: number | null;
  positionRank: number | null;
  commitmentStatus: "committed" | "uncommitted" | "portal";
  upcomingGame: UpcomingGame | null;
  profileStatus: "draft" | "live";
  hasBeenPublished: boolean;
  activeSection: ActiveSection;
  setAthlete: (data: Partial<AthleteData>) => void;
  publishProfile: () => void;
  markDirty: () => void;
  resetToDefaults: () => void;
  setActiveSection: (section: ActiveSection) => void;
}

type AthleteData = Omit<AthleteState, "setAthlete" | "publishProfile" | "markDirty" | "resetToDefaults" | "profileStatus" | "hasBeenPublished" | "activeSection" | "setActiveSection">;

const defaults: AthleteData = {
  firstName: "Marcus",
  lastName: "Sterling",
  position: "WR",
  number: "84",
  school: "University of Georgia",
  schoolAbbrev: "UGA",
  classYear: "2025",
  teamColor: "#CC0000",
  bio: "Elite wide receiver specializing in deep vertical routes. 3-year varsity starter with elite separation and explosive release.",
  quote: "Every rep is a rep toward the league.",
  hometown: "Athens, GA",
  highSchool: "",
  height: "6'2\"",
  weight: "195 lbs",
  fortyTime: "4.42",
  vertical: "38.5\"",
  wingspan: "6'8\"",
  handSize: "9.5\"",
  actionPhotoUrl: null,
  schoolLogoUrl: null,
  eligibilityYears: 3,
  transferEligible: false,
  redshirtStatus: "None",
  starRating: 4,
  nationalRank: null,
  positionRank: null,
  commitmentStatus: "committed",
  upcomingGame: null,
};

export const useAthleteStore = create<AthleteState>((set) => ({
  ...defaults,
  profileStatus: "draft",
  hasBeenPublished: false,
  activeSection: "identity",
  setAthlete: (data) =>
    set((state) => ({
      ...state,
      ...data,
      profileStatus: state.profileStatus === "live" ? "draft" : state.profileStatus,
    })),
  publishProfile: () => set({ profileStatus: "live", hasBeenPublished: true }),
  markDirty: () => set({ profileStatus: "draft" }),
  resetToDefaults: () => set({ ...defaults, profileStatus: "draft" }),
  setActiveSection: (section) => set({ activeSection: section }),
}));
