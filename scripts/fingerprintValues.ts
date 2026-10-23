import { createHash } from "node:crypto";

export type MetricFingerprintInput = { name: string; value?: number | null; score?: number | null; status: string };

const round = (value: number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) throw new Error("Fingerprint numbers must be finite");
  return Number(value.toFixed(4));
};

export function fingerprintValues(metrics: MetricFingerprintInput[], aggregate: number | null) {
  const sorted = [...metrics].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  if (new Set(sorted.map(m => m.name)).size !== sorted.length) throw new Error("Duplicate metric names");
  // Every object is constructed in lexical key order; metric names are stable identities,
  // not values being scored. No diagnostic, configuration or phase details enter the hash.
  const canonical = {
    aggregate: round(aggregate),
    metrics: Object.fromEntries(sorted.map(m => [m.name, { score: round(m.score), status: m.status, value: round(m.value) }])),
  };
  const canonicalJson = JSON.stringify(canonical);
  return { canonical, canonicalJson, fingerprint: createHash("sha256").update(canonicalJson).digest("hex") };
}