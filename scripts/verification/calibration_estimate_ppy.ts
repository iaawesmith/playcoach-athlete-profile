/**
 * verification/calibration_estimate_ppy.ts — PHASE-2A-SLICE-A2
 *
 * NAME:  calibration_estimate_ppy
 * PHASE: PHASE-2A-SLICE-A2
 *
 * VERIFIES:
 *   Operator-facing estimator for true pixels-per-yard (ppy) on a new
 *   calibration clip. Supports the three scale-reference methodologies
 *   formalized in docs/process/calibration-clip-intake.md:
 *     - tape_measure   (known length placed on the ground in-frame)
 *     - yard_line      (known field-marking distance in-frame)
 *     - bbox_cross_check (athlete-height bbox against claimed real height)
 *
 *   Output is an append-ready YAML fragment for the `measurement_methodology`
 *   list in docs/reference/calibration/ground-truth.yaml. The script does
 *   NOT mutate the YAML — operator pastes the fragment per the
 *   `_schema.md § Append workflow` contract so numeric values are preserved
 *   verbatim and the schema's "do not round, do not reformat" rule is not
 *   silently broken by tooling.
 *
 *   This script falsifies the operational risk surfaced in F-SLICE-B-1 that
 *   "no decision-grade ground truth exists beyond n=1" by making n≥3 an
 *   intake-tooling problem rather than a per-clip improvisation problem.
 *
 * RECIPE:
 *   Runtime:   bun (or tsx)
 *   Command:   bun run scripts/verification/calibration_estimate_ppy.ts \
 *                --clip <file_identifier> \
 *                --method <tape_measure|yard_line|bbox_cross_check> \
 *                --inputs '<json>' \
 *                [--id <int>]
 *
 *   Env vars:  none
 *
 *   Inputs (per method):
 *     tape_measure:
 *       { "length_yd": <number>, "pixel_span_px": <number> }
 *       Convenience: { "length_ft": <number> } accepted; converted to yards
 *       internally as length_ft / 3.
 *
 *     yard_line:
 *       { "distance_yd": <number>, "pixel_span_px": <number>,
 *         "marking_pair": "<e.g. '30 to 35'>" }
 *
 *     bbox_cross_check:
 *       { "pixel_height_px": <number>,
 *         "real_height_ft": <number>,
 *         "posture": "<upright|leaning|cutting|jumping>",
 *         "posture_compression_pct_low":  <number, default 0 if upright>,
 *         "posture_compression_pct_high": <number, default 0 if upright> }
 *       Methodology: ppy_low = pixel_height_px / (real_height_yd * (1 - compression_high))
 *                    ppy_high = pixel_height_px / (real_height_yd * (1 - compression_low))
 *       Returns a range, not a point. Per the n=1 entry's precedent, this
 *       is the lowest-confidence method — operator should treat as
 *       cross-check, not primary, when (1) or (2) are also available.
 *
 *   Output:    Append-ready YAML fragment printed to stdout. Operator pastes
 *              under the `measurement_methodology:` list in the relevant
 *              entry in docs/reference/calibration/ground-truth.yaml.
 *
 *   Halt:      Exit 1 on unknown method, missing required input field, or
 *              non-positive numeric input where positivity is required.
 *              Exit 2 on malformed --inputs JSON.
 *
 * BACKLINKS:
 *   - docs/process/calibration-clip-intake.md (Step 3 — runs this script)
 *   - docs/reference/calibration/_schema.md (Append workflow contract)
 *   - docs/reference/calibration/ground-truth.yaml (target dataset)
 *   - docs/risk-register/F-SLICE-B-1-both-calibration-paths-produce-2-6-distance-errors-static-only.md
 *   - docs/adr/0004-calibration-defer-b2-decision.md
 *   - docs/process/phase-2a-slice-a2-outcome.md
 *
 * MAINTENANCE:
 *   If a fourth methodology becomes necessary (e.g. AR-tag based scale
 *   reference), add it as a new `case` in `estimate()` and a new section in
 *   calibration-clip-intake.md § Scale-reference methodologies supported,
 *   in the same commit. The runbook table is the source of truth for which
 *   methodologies are first-class.
 */

type ToolMethod = "tape_measure" | "yard_line" | "bbox_cross_check";

interface CliArgs {
  clip: string;
  method: ToolMethod;
  inputs: Record<string, unknown>;
  id: number | string;
}

function parseArgs(argv: string[]): CliArgs {
  const out: Partial<Record<string, string>> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    const v = argv[i + 1];
    if (!k?.startsWith("--") || v === undefined) {
      console.error(`Bad arg pair near "${k}". Expected --flag value pairs.`);
      process.exit(1);
    }
    out[k.slice(2)] = v;
  }
  for (const required of ["clip", "method", "inputs"]) {
    if (!out[required]) {
      console.error(`Missing required --${required}`);
      process.exit(1);
    }
  }
  let inputs: Record<string, unknown>;
  try {
    inputs = JSON.parse(out.inputs!);
  } catch (e) {
    console.error(`--inputs is not valid JSON: ${(e as Error).message}`);
    process.exit(2);
  }
  const method = out.method as ToolMethod;
  if (!["tape_measure", "yard_line", "bbox_cross_check"].includes(method)) {
    console.error(
      `Unknown --method "${method}". Use one of: tape_measure | yard_line | bbox_cross_check`,
    );
    process.exit(1);
  }
  return {
    clip: out.clip!,
    method,
    inputs,
    id: out.id ?? autoIdForMethod(method),
  };
}

function autoIdForMethod(method: ToolMethod): string {
  // Stable, human-readable defaults so operators don't have to think about
  // numbering before they've decided how many methods they're combining.
  return method;
}

function requirePositive(o: Record<string, unknown>, k: string): number {
  const v = o[k];
  if (typeof v !== "number" || !isFinite(v) || v <= 0) {
    console.error(`Input "${k}" must be a positive finite number; got ${JSON.stringify(v)}`);
    process.exit(1);
  }
  return v;
}

function optionalNumber(o: Record<string, unknown>, k: string, fallback: number): number {
  const v = o[k];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "number" || !isFinite(v)) {
    console.error(`Input "${k}" must be a finite number when provided; got ${JSON.stringify(v)}`);
    process.exit(1);
  }
  return v;
}

interface YamlMethod {
  id: string | number;
  name: string;
  inputs: Record<string, unknown>;
  derived_value: Record<string, number>;
  notes: string;
}

function estimate(method: ToolMethod, raw: Record<string, unknown>): YamlMethod {
  switch (method) {
    case "tape_measure": {
      let lengthYd: number;
      if (raw.length_yd !== undefined) {
        lengthYd = requirePositive(raw, "length_yd");
      } else if (raw.length_ft !== undefined) {
        lengthYd = requirePositive(raw, "length_ft") / 3;
      } else {
        console.error(`tape_measure requires "length_yd" or "length_ft"`);
        process.exit(1);
      }
      const pixelSpan = requirePositive(raw, "pixel_span_px");
      const ppy = pixelSpan / lengthYd;
      return {
        id: "tape_measure",
        name: "Tape measure (known length on ground)",
        inputs: {
          length_yd: round4(lengthYd),
          pixel_span_px: pixelSpan,
          ...(raw.length_ft !== undefined ? { length_ft: raw.length_ft } : {}),
        },
        derived_value: { ppy: round4(ppy) },
        notes:
          "Direct geometric: ppy = pixel_span_px / length_yd. Highest-confidence single-method estimate when tape is laid flat in the camera's principal plane and both endpoints are unambiguously identifiable.",
      };
    }

    case "yard_line": {
      const distanceYd = requirePositive(raw, "distance_yd");
      const pixelSpan = requirePositive(raw, "pixel_span_px");
      const markingPair = typeof raw.marking_pair === "string" ? raw.marking_pair : null;
      const ppy = pixelSpan / distanceYd;
      return {
        id: "yard_line",
        name: "Yard-line marker pair (known field distance)",
        inputs: {
          distance_yd: distanceYd,
          pixel_span_px: pixelSpan,
          ...(markingPair ? { marking_pair: markingPair } : {}),
        },
        derived_value: { ppy: round4(ppy) },
        notes:
          "Direct geometric: ppy = pixel_span_px / distance_yd. Trust depends on marking identification; record the marking_pair so the choice is auditable (e.g., '30 to 35' for football yard lines, 'center-circle diameter = 20 yd' for soccer).",
      };
    }

    case "bbox_cross_check": {
      const pixelHeight = requirePositive(raw, "pixel_height_px");
      const realHeightFt = requirePositive(raw, "real_height_ft");
      const realHeightYd = realHeightFt / 3;
      const posture = typeof raw.posture === "string" ? raw.posture : "upright";
      const defaultLow = posture === "upright" ? 0 : 15;
      const defaultHigh = posture === "upright" ? 0 : 25;
      const compLowPct = optionalNumber(raw, "posture_compression_pct_low", defaultLow);
      const compHighPct = optionalNumber(raw, "posture_compression_pct_high", defaultHigh);
      if (compLowPct < 0 || compHighPct < 0 || compHighPct < compLowPct) {
        console.error(
          `posture_compression_pct_low/high must be non-negative and low <= high; got low=${compLowPct} high=${compHighPct}`,
        );
        process.exit(1);
      }
      // pixel_height = real_height_yd * (1 - compression) * ppy
      // → ppy = pixel_height / (real_height_yd * (1 - compression))
      // High compression → small denominator → high ppy. Low compression → low ppy.
      const ppyLow = pixelHeight / (realHeightYd * (1 - compHighPct / 100));
      const ppyHigh = pixelHeight / (realHeightYd * (1 - compLowPct / 100));
      return {
        id: "bbox_cross_check",
        name: "Athlete-height bbox cross-check",
        inputs: {
          pixel_height_px: pixelHeight,
          real_height_ft: realHeightFt,
          posture,
          posture_compression_pct_low: compLowPct,
          posture_compression_pct_high: compHighPct,
        },
        derived_value: {
          ppy_low: round4(ppyLow),
          ppy_high: round4(ppyHigh),
        },
        notes:
          "Lowest-confidence single-method estimate. Range, not point. Use as cross-check against tape_measure or yard_line when possible. If used alone, pin measurement_confidence: low per the n=1 precedent.",
      };
    }
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function toYaml(method: ToolMethod, m: YamlMethod, clip: string, id: number | string): string {
  const lines: string[] = [];
  lines.push(`# Append under entries[<entry-for-${clip}>].measurement_methodology:`);
  lines.push(`# Method: ${method}`);
  lines.push(`# Generated by scripts/verification/calibration_estimate_ppy.ts (PHASE-2A-SLICE-A2)`);
  lines.push(`- id: ${JSON.stringify(id)}`);
  lines.push(`  name: ${JSON.stringify(m.name)}`);
  lines.push(`  inputs:`);
  for (const [k, v] of Object.entries(m.inputs)) {
    lines.push(`    ${k}: ${formatScalar(v)}`);
  }
  lines.push(`  derived_value:`);
  for (const [k, v] of Object.entries(m.derived_value)) {
    lines.push(`    ${k}: ${formatScalar(v)}`);
  }
  lines.push(`  notes: |`);
  for (const line of m.notes.split("\n")) {
    lines.push(`    ${line}`);
  }
  return lines.join("\n");
}

function formatScalar(v: unknown): string {
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = estimate(args.method, args.inputs);
  const yaml = toYaml(args.method, result, args.clip, args.id);
  process.stdout.write(yaml + "\n");
}

main();
