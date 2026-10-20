import { create } from "zustand";
import type { CalibrationClip } from "@/services/calibrationLibrary";

export interface PendingLibraryRun {
  clip: CalibrationClip;
  signedUrl: string;
}

interface CalibrationLibraryState {
  editClip: CalibrationClip | null;
  openClipEditor: (clip: CalibrationClip) => void;
  clearClipEditor: () => void;
  pending: PendingLibraryRun | null;
  setPending: (pending: PendingLibraryRun) => void;
  clearPending: () => void;
}

export const useCalibrationLibraryStore = create<CalibrationLibraryState>((set) => ({
  editClip: null,
  openClipEditor: (editClip) => set({ editClip }),
  clearClipEditor: () => set({ editClip: null }),
  pending: null,
  setPending: (pending) => set({ pending }),
  clearPending: () => set({ pending: null }),
}));
