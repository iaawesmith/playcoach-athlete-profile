// Phase 1c.2 Slice B1 — Live Browser Smoke comparison harness.
//
// Usage (after a fresh Slant analysis completes):
//   deno run --allow-env --allow-net scripts/slice1c2_b1_smoke_compare.ts
//
// What it does:
//   1. Pulls the most-recent athlete_lab_results row for the Slant node.
//   2. Compares its 4 metric values + aggregate + phase_scores to the
//      d1b3ab23 baseline (athlete_lab_results.id = 43931849-a10b-4a25-93cf-4b9b3ec10eb3,
//      analyzed_at 2026-04-25 01:37:45, captured in
//      docs/phase-1c2-baseline-slant-analysis.md).
//   3. Applies the verification protocol thresholds:
//        - angle metrics (degrees): ±5%
//        - distance/velocity metrics (yards, mph): ±50%
//        - phase_scores / aggregate_score: report delta, no hard threshold
//          (calibration source is *expected* to flip in B2; B1 should be
//          identical because B1 makes no calibration changes).
//   4. Prints PASS / WARN / FAIL per metric and an overall verdict.
//
// IMPORTANT (B1 vs B2 framing):
//   B1 only trims the MediaPipe payload, collapses det_frequency, deletes
//   the dead athlete-lab-analyze function, and removes runAnalysis(). It
//   does NOT touch calibration. Therefore on B1 we expect:
//     - calibration_source still 'body_based'
//     - all 4 metric values within byte-equal-ish noise of baseline
//     - mediapipe_request_payload log line shows exactly 4 keys
//   The ±5%/±50% thresholds exist for B2 (calibration deletion). For B1,
//   anything beyond ±0.5% on metric values is suspicious and should halt.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SLANT_NODE_ID = "75ed4b18-8a22-440e-9a23-b86204956056";
const BASELINE_RESULT_ID = "43931849-a10b-4a25-93cf-4b9b3ec10eb3";

// Frozen baseline values (from docs/phase-1c2-baseline-slant-analysis.md).
const BASELINE = {
  aggregate_score: 27,
  phase_scores: {
    Release: 0,
    Stem: 0,
    Break: 56.19,
    "Catch Window": 0,
    "YAC (After Catch)": 0,
  },
  metrics: {
    "Plant Leg Extension": { value: 103.37, unit: "degrees", kind: "angle" },
    "Hip Stability":       { value: 0.09,   unit: "yards",   kind: "distance" },
    "Release Speed":       { value: 158.94, unit: "mph",     kind: "velocity" },
    "Hands Extension at Catch": { value: 1.74, unit: "yards", kind: "distance" },
  },
  calibration_source: "body_based",
  mediapipe_payload_keys: ["video_url", "start_seconds", "end_seconds", "det_frequency"],
};

// B1 thresholds (tighter than B2's ±5/±50): B1 should not move metrics.
const B1_TOLERANCE_PCT = 0.5;

// B2 thresholds (used post-calibration deletion).
const B2_ANGLE_TOLERANCE_PCT = 5;
const B2_DISTANCE_TOLERANCE_PCT = 50;

const args = new Set(Deno.args);
const mode = args.has("--b2") ? "B2" : "B1";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: latest, error } = await supabase
  .from("athlete_lab_results")
  .select("id, upload_id, analyzed_at, aggregate_score, phase_scores, metric_results, result_data")
  .eq("node_id", SLANT_NODE_ID)
  .order("analyzed_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (error) throw error;
if (!latest) {
  console.error("No Slant results in athlete_lab_results.");
  Deno.exit(2);
}

console.log(`\n=== Slice B1 Smoke Compare (mode=${mode}) ===`);
console.log(`Latest result.id: ${latest.id}`);
console.log(`Baseline    .id: ${BASELINE_RESULT_ID}`);
console.log(`Analyzed at:     ${latest.analyzed_at}`);
if (latest.id === BASELINE_RESULT_ID) {
  console.log("\n⚠️  Latest row IS the baseline. No new analysis has run yet.");
  console.log("    Trigger a Slant analysis in the admin UI, then re-run this script.");
  Deno.exit(0);
}

const tolerance = mode === "B1" ? B1_TOLERANCE_PCT : null;

let fails = 0;
let warns = 0;

function pct(actual: number, base: number): number {
  if (base === 0) return actual === 0 ? 0 : Infinity;
  return ((actual - base) / base) * 100;
}

function thresholdFor(kind: string): number {
  if (mode === "B1") return B1_TOLERANCE_PCT;
  return kind === "angle" ? B2_ANGLE_TOLERANCE_PCT : B2_DISTANCE_TOLERANCE_PCT;
}

console.log("\n--- Metric values ---");
const metricResults = (latest.metric_results ?? []) as Array<Record<string, unknown>>;
for (const [name, base] of Object.entries(BASELINE.metrics)) {
  const row = metricResults.find((m) => m.name === name);
  if (!row) {
    console.log(`  FAIL  ${name}: missing from result`);
    fails++;
    continue;
  }
  const value = Number(row.value);
  const delta = pct(value, base.value);
  const limit = thresholdFor(base.kind);
  const verdict = Math.abs(delta) <= limit ? "PASS"
                : Math.abs(delta) <= limit * 2 ? "WARN" : "FAIL";
  if (verdict === "FAIL") fails++;
  if (verdict === "WARN") warns++;
  console.log(
    `  ${verdict.padEnd(5)} ${name.padEnd(28)} ` +
    `actual=${value.toFixed(2)} ${base.unit.padEnd(7)} ` +
    `baseline=${base.value} ` +
    `Δ=${delta.toFixed(2)}% (limit ±${limit}%, ${base.kind})`
  );
}

console.log("\n--- Aggregate / phase scores ---");
console.log(`  aggregate_score  actual=${latest.aggregate_score}  baseline=${BASELINE.aggregate_score}`);
const phaseScores = (latest.phase_scores ?? {}) as Record<string, number>;
for (const [phase, baseScore] of Object.entries(BASELINE.phase_scores)) {
  const actual = phaseScores[phase];
  console.log(`  phase ${phase.padEnd(20)} actual=${actual ?? "missing"}  baseline=${baseScore}`);
}

console.log("\n--- Calibration source (informational; B1 expects body_based, B2 expects static/pixel_warning) ---");
const rtmlibSummary = (latest.result_data as Record<string, unknown> | null)?.rtmlibSummary as
  Record<string, unknown> | undefined;
const calSource = rtmlibSummary?.calibration_source ?? "(unknown)";
const calConf = rtmlibSummary?.calibration_confidence ?? "(unknown)";
console.log(`  calibration_source     = ${calSource}`);
console.log(`  calibration_confidence = ${calConf}`);
if (mode === "B1" && calSource !== "body_based") {
  console.log(`  ⚠️  B1 should not change calibration. Source flipped → halt and investigate.`);
  fails++;
}

console.log("\n--- Verdict ---");
console.log(`  FAILs: ${fails}   WARNs: ${warns}`);
console.log(`  R-08 reminder: confirm \`mediapipe_request_payload\` log shows keys = ${JSON.stringify(BASELINE.mediapipe_payload_keys)}`);
if (fails > 0) {
  console.log("  ❌ HALT — surface findings before proceeding.");
  Deno.exit(1);
}
console.log("  ✅ PASS — within tolerances. Proceed to next slice gate.");
