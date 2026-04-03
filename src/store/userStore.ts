import { create } from "zustand";

type Role = "athlete" | "coach" | "trainer" | "agency" | "brand";
type AthleteTier = "youth" | "high-school" | "college" | "pro";
type AgencyType = "nil" | "sports" | "both";

interface UserState {
  role: Role | null;
  athleteTier: AthleteTier | null;
  sport: string | null;
  agencyType: AgencyType | null;
  onboardingComplete: boolean;
  onboardingStep: number;
  setRole: (role: Role) => void;
  setAthleteTier: (tier: AthleteTier) => void;
  setSport: (sport: string) => void;
  setAgencyType: (type: AgencyType) => void;
  completeOnboarding: () => void;
  setOnboardingStep: (step: number) => void;
  reset: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  role: null,
  athleteTier: null,
  sport: null,
  agencyType: null,
  onboardingComplete: false,
  onboardingStep: 0,
  setRole: (role) => set({ role }),
  setAthleteTier: (tier) => set({ athleteTier: tier }),
  setSport: (sport) => set({ sport }),
  setAgencyType: (type) => set({ agencyType: type }),
  completeOnboarding: () => set({ onboardingComplete: true }),
  setOnboardingStep: (step) => set({ onboardingStep: step }),
  reset: () =>
    set({
      role: null,
      athleteTier: null,
      sport: null,
      agencyType: null,
      onboardingComplete: false,
      onboardingStep: 0,
    }),
}));
