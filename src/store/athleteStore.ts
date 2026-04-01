import { create } from "zustand";

interface AthleteState {
  name: string;
  position: string;
  number: string;
  school: string;
  classYear: string;
  teamColor: string;
  profileStatus: "draft" | "live";
  hasBeenPublished: boolean;
  setAthlete: (data: Partial<Omit<AthleteState, "setAthlete" | "publishProfile" | "markDirty" | "profileStatus" | "hasBeenPublished">>) => void;
  publishProfile: () => void;
  markDirty: () => void;
}

export const useAthleteStore = create<AthleteState>((set) => ({
  name: "Marcus Sterling",
  position: "WR",
  number: "84",
  school: "University of Georgia",
  classYear: "2025",
  teamColor: "#CC0000",
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
}));
