import { create } from "zustand";
import type { CalibrationClip } from "@/services/calibrationLibrary";

export interface PendingLibraryRun {
  clip: CalibrationClip;
  signedUrl: string;
}

interface CalibrationLibraryState {
  pending: PendingLibraryRun | null;
  setPending: (pending: PendingLibraryRun) => void;
  clearPending: () => void;
}

export const useCalibrationLibraryStore = create<CalibrationLibraryState>((set) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
  clearPending: () => set({ pending: null }),
}));
