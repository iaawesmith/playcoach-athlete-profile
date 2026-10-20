import type { CalibrationClip } from "./calibrationLibrary";

export interface LibraryContextValues {
  camera_angle: string;
  people_in_video: string;
  route_direction: string;
  catch_status: string;
  athlete_level: string;
  athlete_height: number | null;
  athlete_height_unit: string;
  athlete_wingspan: number | null;
  athlete_wingspan_unit: string;
  performance_description: string;
  focus_area: string;
  end_seconds: number | null;
}

export interface LibraryContextOverride {
  field: keyof LibraryContextValues;
  clip_value: LibraryContextValues[keyof LibraryContextValues];
  run_value: LibraryContextValues[keyof LibraryContextValues];
}

export const LIBRARY_CONTEXT_LABELS: Record<keyof LibraryContextValues, string> = {
  camera_angle: "Camera angle", people_in_video: "People in video", route_direction: "Break direction",
  catch_status: "Catch status", athlete_level: "Athlete level", athlete_height: "Height",
  athlete_height_unit: "Height unit", athlete_wingspan: "Wingspan", athlete_wingspan_unit: "Wingspan unit",
  performance_description: "Performance description", focus_area: "Focus area", end_seconds: "Clip end seconds",
};

export function libraryClipValues(clip: CalibrationClip): LibraryContextValues {
  return {
    camera_angle: clip.camera_angle, people_in_video: clip.people_in_video,
    route_direction: clip.route_direction, catch_status: clip.catch_status, athlete_level: clip.athlete_level,
    athlete_height: clip.athlete_height, athlete_height_unit: clip.athlete_height_unit,
    athlete_wingspan: clip.athlete_wingspan, athlete_wingspan_unit: clip.athlete_wingspan_unit,
    // Clips have no separate performance-description or focus-area column.
    performance_description: clip.notes, focus_area: "",
    end_seconds: typeof clip.duration_seconds === "number" && Number.isFinite(clip.duration_seconds) && clip.duration_seconds > 0
      ? Math.min(clip.duration_seconds, 3) : null,
  };
}

export function libraryContextDifferences(clip: CalibrationClip, run: LibraryContextValues): LibraryContextOverride[] {
  const stored = libraryClipValues(clip);
  return (Object.keys(stored) as Array<keyof LibraryContextValues>)
    .filter((field) => stored[field] !== run[field])
    .map((field) => ({ field, clip_value: stored[field], run_value: run[field] }));
}

export function libraryAnalysisContext(values: LibraryContextValues): Record<string, unknown> {
  return {
    ...values,
    start_seconds: 0,
    catch_included: values.catch_status !== "no",
    athlete_height: values.athlete_height === null ? null : { value: values.athlete_height, unit: values.athlete_height_unit },
    athlete_wingspan: values.athlete_wingspan === null ? null : { value: values.athlete_wingspan, unit: values.athlete_wingspan_unit },
  };
}

export function contextDisplayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "object" && "value" in value) return contextDisplayValue(value.value);
  return typeof value === "string" || typeof value === "number" ? String(value) : "—";
}