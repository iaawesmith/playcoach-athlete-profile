import { create } from "zustand";

interface AthleteState {
  name: string;
  position: string;
  number: string;
  school: string;
  classYear: string;
  teamColor: string;
  setAthlete: (data: Partial<Omit<AthleteState, "setAthlete">>) => void;
}

export const useAthleteStore = create<AthleteState>((set) => ({
  name: "Marcus Sterling",
  position: "WR",
  number: "84",
  school: "University of Georgia",
  classYear: "2025",
  teamColor: "#50C4CA",
  setAthlete: (data) => set((state) => ({ ...state, ...data })),
}));
