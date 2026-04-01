import { create } from "zustand";

interface AthleteState {
  firstName: string;
  lastName: string;
  position: string;
  number: string;
  school: string;
  classYear: string;
  teamColor: string;
  bio: string;
  hometown: string;
  height: string;
  weight: string;
  actionPhotoUrl: string | null;
  schoolLogoUrl: string | null;
  profileStatus: "draft" | "live";
  hasBeenPublished: boolean;
  setAthlete: (data: Partial<AthleteData>) => void;
  publishProfile: () => void;
  markDirty: () => void;
  resetToDefaults: () => void;
}

type AthleteData = Omit<AthleteState, "setAthlete" | "publishProfile" | "markDirty" | "resetToDefaults" | "profileStatus" | "hasBeenPublished">;

const defaults: AthleteData = {
  firstName: "Marcus",
  lastName: "Sterling",
  position: "WR",
  number: "84",
  school: "University of Georgia",
  classYear: "2025",
  teamColor: "#CC0000",
  bio: "Elite wide receiver specializing in deep vertical routes. 3-year varsity starter with elite separation and explosive release.",
  hometown: "Athens, GA",
  height: "6'2\"",
  weight: "195 lbs",
  actionPhotoUrl: null,
  schoolLogoUrl: null,
};

export const useAthleteStore = create<AthleteState>((set) => ({
  ...defaults,
  profileStatus: "draft",
  hasBeenPublished: false,
  setAthlete: (data) =>
    set((state) => ({
      ...state,
      ...data,
      profileStatus: state.profileStatus === "live" ? "draft" : state.profileStatus,
    })),
  publishProfile: () => set({ profileStatus: "live", hasBeenPublished: true }),
  markDirty: () => set({ profileStatus: "draft" }),
  resetToDefaults: () => set({ ...defaults, profileStatus: "draft" }),
}));
