/**
 * verification/slice2a_b1_drift_band.ts — Phase 2a remediation — drift-band corroboration (--check only)
 *
 * NAME: slice2a_b1_drift_band
 * PHASE: PHASE-2A-SLICE-B1 (covers PHASE-2A-SLICE-B2 by extension)
 *
 * VERIFIES:
 *   B1 (add `pose_world_landmarks` to PoseFrame) + B2 (plumb `world_keypoints`
 *   through AnalyzeResponse) did not perturb the post-resolver numeric
 *   distribution beyond the established F-SLICE-E-2 noise floor.
 *
 *   The structural-check half of verification lives in B1's outcome doc
 *   (additive field cannot back-propagate into 2D landmarks; serialization
 *   order unchanged; no consumer reads the field). This script is the
 *   runtime corroboration half: ADR-0005 Option D (categoricals exact +
 *   numeric drift ≤ ±1%) applied as a pre-vs-post distribution comparison
 *   rather than a single-run hash check, because hash-exact is unavailable
 *   by construction while F-SLICE-E-2 remains open.
 *
 *   Precedent: this is the shipping bar for additive-field, no-consumer
 *   slices in Track B until B3 lands. B3 introduces a real consumer and
 *   the bar tightens — re-decide at B3 kickoff, do not let Option D quietly
 *   inherit forward.
 *
 * WIRING BOUNDARY (F-OPS-6 ruling, 2026-06-03):
 *   This script is `--check` only. It reads a finished
 *   `docs/reference/determinism-drift.csv` and applies the ratified
 *   decision matrix. It does NOT trigger uploads, poll status, or append
 *   rows to the CSV.
 *
 *   That split is deliberate. Any execution path this script can't
 *   exercise from a sandbox (live pipeline contact, Cloud Run revision
 *   routing, storage signing) is operator-owned, because wiring code
 *   against output shapes the script can't actually invoke is the exact
 *   F-OPS-6 failure mode that registered this remediation in the first
 *   place. The operator drives baseline×10 and postship×10 against
 *   parallel Cloud Run revisions, appends rows by hand per
 *   `docs/reference/_schema-determinism-drift.md § Append workflow`,
 *   then runs this script to clear the band.
 *
 * RECIPE:
 *   Runtime:   bun (TypeScript native, no transpile step)
 *
 *   Operator (live pipeline, not scripted here):
 *     1. Identify pre-B1 SHA:
 *          git log --oneline -S 'world_keypoints' -- mediapipe-service/app/pose.py
 *          # Pre-B1 baseline SHA: 2bcff8e (parent of world_keypoints introduction)
 *          # Post-B1+B2 HEAD SHA: 0e42a62
 *     2. Deploy mediapipe-service at the pre-B1 SHA to a parallel
 *        Cloud Run revision. Flip MEDIAPIPE_SERVICE_URL secret on
 *        analyze-athlete-video to point at that revision.
 *     3. Trigger 10 admin-test uploads of the canonical Slant clip
 *        (athlete-videos/test-clips/slant-route-reference-v1.mp4).
 *        Wait for each to reach `completed`.
 *     4. For each completed upload, append one row to
 *        docs/reference/determinism-drift.csv per `_schema-determinism-drift.md
 *        § Append workflow` with:
 *          experiment_tag = phase-2a-slice-b1-baseline
 *          phase          = 2A.B1
 *          change_under_test = "B1+B2 pre-B1 SHA — Option D drift-band baseline"
 *          notes          = "F-OPS-6 remediation; mediapipe_url_tag=<revision URL>"
 *     5. Flip MEDIAPIPE_SERVICE_URL back to the HEAD revision. Repeat
 *        the 10-run cycle with experiment_tag = phase-2a-slice-b1-postship.
 *     6. Hand the finished CSV back here.
 *
 *   This script (--check only):
 *     bun run scripts/verification/slice2a_b1_drift_band.ts --check
 *
 *   Args:
 *     --check    — the only mode. Read CSV, apply decision matrix.
 *
 *   Output:
 *     - Reads docs/reference/determinism-drift.csv.
 *     - Selects rows where experiment_tag matches `phase-2a-slice-b1-baseline`
 *       (N≥10 expected) and `phase-2a-slice-b1-postship` (N≥10 expected).
 *     - Reports mode distribution (hashes + counts), mean / stddev of
 *       body_based_ppy, min/max, for each set.
 *     - Applies the decision matrix:
 *         * categoricals exact across all 20 runs → required
 *         * post-B1 hashes ⊆ baseline hashes set → required
 *         * |postship_mean - baseline_mean| / baseline_mean ≤ 0.001 (0.1%)
 *         * postship_stddev / baseline_stddev ≤ 1.5
 *     - Exit codes:
 *         0  — pass (operator may flip B1/B2 to Shipped)
 *         1  — halt: new hash absent from baseline set (first diagnostic:
 *              more baseline runs at pre-B1 SHA, NOT a B1 investigation —
 *              undersampling F-SLICE-E-2's 7/1/1 distribution is more likely)
 *         2  — halt: mean shift > 0.1% at stable mode set (real F-SLICE-B-*
 *              finding; B1/B2 stay code-complete; A3/B3 stay blocked)
 *         3  — halt: stddev widening > 1.5× at stable mode set (same as above)
 *         4  — halt: categorical mismatch (real regression)
 *         5  — halt: insufficient runs (N < 10 per side) — go run more
 *
 *   Halt: see exit codes above. On any non-zero, do not flip status flags.
 *
 * BACKLINKS:
 *   - docs/risk-register/F-OPS-6-verification-deferral-across-slice-boundaries.md
 *   - docs/risk-register/F-SLICE-E-2-pipeline-calibration-audit-shows-0-78-non-deterministic-drift-on-identical.md
 *   - docs/adr/0005-determinism-tolerance-1pct.md
 *   - docs/process/phase-2a-slice-b1-outcome.md
 *   - docs/process/phase-2a-slice-b2-outcome.md
 *   - docs/reference/_schema-determinism-drift.md
 *
 * MAINTENANCE:
 *   This script is the precedent for additive-field, no-consumer slices in
 *   Track B. Re-evaluate the bar at PHASE-2A-SLICE-B3 kickoff (first real
 *   `world_keypoints` consumer; needs its own ground-truth check, not just
 *   band corroboration). Until then, future additive Track B slices reuse
 *   this script's experiment_tag convention with a new label suffix.
 *
 *   Wiring-boundary precedent: any future verification script in this
 *   family stays `--check`-only over a CSV the operator populates. Do NOT
 *   add upload/poll/append logic back into this script — that resurrects
 *   the F-OPS-6 failure mode (verification code that can't be exercised
 *   from sandbox and therefore can't be verified to be correct).
 *
 *   Upstream shape assumptions:
 *     - docs/reference/determinism-drift.csv column order matches
 *       docs/reference/_schema-determinism-drift.md § CSV columns. If the
 *       schema gains columns, update the column-index lookups in check().
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Process rationale (F-SLICE-E-3 + F-OPS-6 lesson, do not delete):
 *   B1 deferred its verification into B2. B2 inherited and skipped.
 *   This script exists so that next time, the verification cannot
 *   evaporate at a slice boundary — it lives in code with a backlink
 *   and the slice's outcome doc names the script explicitly. If you
 *   change what this script verifies, update VERIFIES, BACKLINKS, and
 *   the B1 / B2 outcome docs in the same commit.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const CSV_PATH = resolve(import.meta.dir, "../../docs/reference/determinism-drift.csv");

function check(): number {
  if (!existsSync(CSV_PATH)) {
    console.error(`CSV not found at ${CSV_PATH}`);
    return 5;
  }
  const lines = readFileSync(CSV_PATH, "utf8").trim().split("\n");
  const header = lines[0].split(",");
  const tagIdx = header.indexOf("experiment_tag");
  const hashIdx = header.indexOf("hash");
  const ppyIdx = header.indexOf("body_based_ppy");
  const catIdx = header.indexOf("categoricals_exact");

  const rows = lines.slice(1).map((l) => {
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of l) {
      if (ch === '"') inQ = !inQ;
      else if (ch === "," && !inQ) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    return cells;
  });

  const baseline = rows.filter((r) => r[tagIdx] === "phase-2a-slice-b1-baseline");
  const postship = rows.filter((r) => r[tagIdx] === "phase-2a-slice-b1-postship");

  if (baseline.length < 10 || postship.length < 10) {
    console.error(
      `Insufficient runs: baseline=${baseline.length}, postship=${postship.length} (need 10 each).`,
    );
    return 5;
  }

  const baselineHashes = new Set(baseline.map((r) => r[hashIdx]));
  const postshipHashes = new Set(postship.map((r) => r[hashIdx]));

  const anyCatMismatch = [...baseline, ...postship].some((r) => r[catIdx] !== "true");
  if (anyCatMismatch) {
    console.error("HALT: categorical mismatch present in run set.");
    return 4;
  }

  const novel = [...postshipHashes].filter((h) => !baselineHashes.has(h));
  if (novel.length > 0) {
    console.error(
      `HALT: postship contains hash(es) absent from baseline: ${novel.join(", ")}.\n` +
        `First diagnostic is N more baseline runs at the pre-B1 SHA, NOT a B1 investigation. ` +
        `Undersampling F-SLICE-E-2's 7/1/1 mode distribution is the more likely cause.`,
    );
    return 1;
  }

  const stats = (rs: string[][]) => {
    const xs = rs.map((r) => Number(r[ppyIdx]));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const variance =
      xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, xs.length - 1);
    return { mean, stddev: Math.sqrt(variance), n: xs.length };
  };
  const b = stats(baseline);
  const p = stats(postship);
  const meanShiftPct = Math.abs(p.mean - b.mean) / b.mean;
  const stddevRatio = p.stddev / Math.max(1e-12, b.stddev);

  console.log(`baseline: n=${b.n}, mean=${b.mean.toFixed(8)}, stddev=${b.stddev.toFixed(8)}`);
  console.log(`postship: n=${p.n}, mean=${p.mean.toFixed(8)}, stddev=${p.stddev.toFixed(8)}`);
  console.log(`mean shift: ${(meanShiftPct * 100).toFixed(4)}% (threshold 0.1%)`);
  console.log(`stddev ratio: ${stddevRatio.toFixed(3)} (threshold 1.5)`);
  console.log(`baseline hashes (${baselineHashes.size}): ${[...baselineHashes].join(", ")}`);
  console.log(`postship hashes (${postshipHashes.size}): ${[...postshipHashes].join(", ")}`);

  if (meanShiftPct > 0.001) {
    console.error("HALT: mean shift > 0.1% at stable mode set. Real F-SLICE-B-* finding.");
    return 2;
  }
  if (stddevRatio > 1.5) {
    console.error("HALT: stddev widening > 1.5× at stable mode set. Real F-SLICE-B-* finding.");
    return 3;
  }

  console.log("PASS — B1/B2 may be flipped to Shipped. Amend B1 outcome doc with these numbers.");
  return 0;
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes("--check")) {
    process.exit(check());
  }
  console.error(
    "Usage: bun run scripts/verification/slice2a_b1_drift_band.ts --check\n\n" +
      "This script is --check only. Live-pipeline runs (uploads, polling, CSV\n" +
      "append) are operator-owned per the F-OPS-6 wiring boundary — see the\n" +
      "RECIPE header for the operator sequence, and\n" +
      "docs/reference/_schema-determinism-drift.md § Append workflow for the\n" +
      "row-append contract.",
  );
  process.exit(2);
}

main();
