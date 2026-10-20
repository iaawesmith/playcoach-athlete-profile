import type { PipelineDetectedError, PipelineMetricResult } from "../types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export type PhaseLookup = Array<{ id?: string | null; name: string }>;

export function parseMetricResults(value: unknown, phases: PhaseLookup = []): PipelineMetricResult[] {
  if (!Array.isArray(value)) return [];
  const phaseNames = new Map(phases.filter((p) => p.id).map((p) => [p.id as string, p.name]));

  return value.map((entry, index) => {
    const record = asRecord(entry);
    const mapping = asRecord(record.keypoint_mapping);
    const phaseId = asString(record.phase_id) ?? asString(mapping.phase_id);
    const eliteRaw = record.elite_target ?? record.eliteTarget;
    const elite = typeof eliteRaw === "number" && Number.isFinite(eliteRaw)
      ? String(eliteRaw)
      : typeof eliteRaw === "string" ? eliteRaw : "";
    const detail = asRecord(record.detail);
    return {
      name: asString(record.name) ?? `Metric ${index + 1}`,
      unit: typeof record.unit === "string" ? record.unit : "",
      value: asNumber(record.value),
      elite_target: elite,
      tolerance: asNumber(record.tolerance),
      deviation: asNumber(record.deviation),
      score: asNumber(record.score),
      weight: asNumber(record.weight) ?? 0,
      status: typeof record.status === "string" ? (record.status as PipelineMetricResult["status"]) : "failed",
      reason: typeof record.reason === "string" ? record.reason : undefined,
      detail: Object.keys(detail).length > 0 ? detail : undefined,
      phase_id: phaseId,
      phase_name: asString(record.phase_name) ?? (phaseId ? phaseNames.get(phaseId) ?? null : null),
      calculation_type: asString(record.calculation_type) ?? asString(mapping.calculation_type),
    };
  });
}

/** Accepts the current object format and legacy string / null entries. */
export function parseDetectedErrors(value: unknown): PipelineDetectedError[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): PipelineDetectedError[] => {
    if (typeof entry === "string" && entry.trim()) {
      return [{ name: entry, condition: null, metric_value: null, severity: null }];
    }
    const record = asRecord(entry);
    const name = asString(record.name) ?? asString(record.error);
    if (!name) return [];
    return [{
      name,
      condition: asString(record.condition),
      metric_value: asNumber(record.metric_value),
      severity: asString(record.severity),
    }];
  });
}

export function roundScore(score: number | null | undefined): string {
  return typeof score === "number" && Number.isFinite(score) ? String(Math.round(score)) : "—";
}
