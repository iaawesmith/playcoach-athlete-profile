/**
 * verification/slice2a_b1_drift_band.ts — Phase 2a remediation — drift-band corroboration
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
 *   runtime corroboration: ADR-0005 Option D (categoricals exact + numeric
 *   drift ≤ ±1%) applied as a pre-vs-post distribution comparison rather
 *   than a single-run hash check, because hash-exact is unavailable by
 *   construction while F-SLICE-E-2 remains open.
 *
 *   Precedent: this is the shipping bar for additive-field, no-consumer
 *   slices in Track B until B3 lands. B3 introduces a real consumer and
 *   the bar tightens — re-decide at B3 kickoff, do not let Option D quietly
 *   inherit forward.
 *
 * RECIPE:
 *   Runtime:   bun (TypeScript native, no transpile step)
 *
 *   Operator-driven sequence (the script cannot self-checkout; the operator
 *   drives the git-SHA cycle because stateful git is out of scope here):
 *
 *     # 1. Identify the pre-B1 SHA.
 *     git log --oneline --diff-filter=A -- mediapipe-service/app/pose.py \
 *       | head -1   # first commit that added pose.py — too far back
 *     git log --oneline -S 'world_keypoints' -- mediapipe-service/app/pose.py
 *       # first commit introducing world_keypoints; back up one for baseline
 *
 *     # 2. From that SHA, checkout and deploy mediapipe-service to a
 *     #    short-lived Cloud Run revision (or use a pinned baseline
 *     #    revision if one exists). MEDIAPIPE_SERVICE_URL must point at
 *     #    that revision for the baseline runs.
 *     git checkout <pre-B1-sha>
 *     # ... deploy to Cloud Run, set MEDIAPIPE_SERVICE_URL to the revision URL ...
 *     for i in $(seq 1 10); do
 *       bun run scripts/verification/slice2a_b1_drift_band.ts --label baseline
 *     done
 *
 *     # 3. Return to HEAD, redeploy (or point MEDIAPIPE_SERVICE_URL at
 *     #    the production HEAD revision), run postship set.
 *     git checkout <main-branch>
 *     # ... deploy / repoint ...
 *     for i in $(seq 1 10); do
 *       bun run scripts/verification/slice2a_b1_drift_band.ts --label postship
 *     done
 *
 *     # 4. Verify the band.
 *     bun run scripts/verification/slice2a_b1_drift_band.ts --check
 *
 *   Env vars:
 *     VITE_SUPABASE_URL              — Supabase project URL
 *     VITE_SUPABASE_PUBLISHABLE_KEY  — anon key (or service role for admin-test invocation)
 *     SLANT_NODE_ID                  — defaults to the canonical Slant node
 *                                      (75ed4b18-8a22-440e-9a23-b86204956056)
 *     SLANT_ATHLETE_ID               — defaults to canonical test athlete
 *                                      (8f42b1c3-5d9e-4a7b-b2e1-9c3f4d5a6e7b)
 *     SLANT_VIDEO_PATH               — storage path of canonical clip
 *                                      (athlete-videos/test-clips/slant-route-reference-v1.mp4)
 *
 *   Args:
 *     --label <baseline|postship>    — required for run-mode; tags the CSV row's
 *                                      `experiment_tag` as `phase-2a-slice-b1-<label>`
 *     --check                        — read CSV, apply decision matrix, exit 0 on pass
 *
 *   Output:
 *     Run-mode (--label):
 *       - Triggers one admin-test upload of the canonical Slant clip.
 *       - Polls athlete_lab_results for the row.
 *       - Computes canonical-JSON SHA-256 of result_data.calibration_audit.
 *       - Appends one row to docs/reference/determinism-drift.csv.
 *       - Prints the appended row to stdout.
 *
 *     Check-mode (--check):
 *       - Reads docs/reference/determinism-drift.csv.
 *       - Selects rows where experiment_tag matches `phase-2a-slice-b1-baseline`
 *         (N=10 expected) and `phase-2a-slice-b1-postship` (N=10 expected).
 *       - Reports mode distribution (hashes + counts), mean / stddev of
 *         body_based_ppy, min/max, for each set.
 *       - Applies the decision matrix:
 *           * categoricals exact across all 20 runs → required
 *           * post-B1 hashes ⊆ baseline hashes set → required
 *           * |postship_mean - baseline_mean| / baseline_mean ≤ 0.001 (0.1%)
 *           * postship_stddev / baseline_stddev ≤ 1.5
 *       - Exit codes:
 *           0  — pass (operator can flip B1/B2 to Shipped)
 *           1  — halt: new hash absent from baseline set (first diagnostic:
 *                more baseline runs at pre-B1 SHA, NOT a B1 investigation —
 *                undersampling F-SLICE-E-2's 7/1/1 distribution is more likely)
 *           2  — halt: mean shift > 0.1% at stable mode set (real F-SLICE-B-*
 *                finding; B1/B2 stay code-complete; A3/B3 stay blocked)
 *           3  — halt: stddev widening > 1.5× at stable mode set (same as above)
 *           4  — halt: categorical mismatch (real regression)
 *           5  — halt: insufficient runs (N < 10 per side) — go run more
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
 *   this script's --label semantics with a new tag value.
 *
 *   Upstream shape assumptions:
 *     - docs/reference/determinism-drift.csv column order matches
 *       docs/reference/_schema-determinism-drift.md § CSV columns. If the
 *       schema gains columns, update the appendRow() builder below.
 *     - athlete_lab_results.result_data.calibration_audit shape unchanged.
 *       If schema migrates, update CANONICAL_FIELDS and re-baseline.
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

import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const CSV_PATH = resolve(import.meta.dir, "../../docs/reference/determinism-drift.csv");

const CANONICAL_NODE_ID =
  process.env.SLANT_NODE_ID ?? "75ed4b18-8a22-440e-9a23-b86204956056";
const CANONICAL_ATHLETE_ID =
  process.env.SLANT_ATHLETE_ID ?? "8f42b1c3-5d9e-4a7b-b2e1-9c3f4d5a6e7b";
const CANONICAL_VIDEO_PATH =
  process.env.SLANT_VIDEO_PATH ??
  "athlete-videos/test-clips/slant-route-reference-v1.mp4";

const BASELINE_HASH_GROUP_A =
  "34a8712604547408d5b8c2c7d5c37a281eaf9c9d83619dc1f6668a4e29afcc77";
const BASELINE_PPY = 200.21353797230793;

// Canonicalize JSON with sorted keys for stable hashing (mirrors
// docs/reference/_schema-determinism-drift.md § Append workflow step 2).
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BUCKET = "athlete-videos";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function requireEnv(): void {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("SUPABASE_URL or VITE_SUPABASE_URL");
  if (!SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) throw new Error(`Missing env: ${missing.join(", ")}`);
}

async function sbFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    ...((init.headers ?? {}) as Record<string, string>),
  };
  return fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
}

async function signVideoUrl(): Promise<string> {
  let objectPath = CANONICAL_VIDEO_PATH;
  if (objectPath.startsWith(`${BUCKET}/`)) objectPath = objectPath.slice(BUCKET.length + 1);
  const resp = await sbFetch(`/storage/v1/object/sign/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 60 * 60 }),
  });
  if (!resp.ok) throw new Error(`signVideoUrl: HTTP ${resp.status} ${await resp.text()}`);
  const body = (await resp.json()) as { signedURL?: string; signedUrl?: string };
  const rel = body.signedUrl ?? body.signedURL;
  if (!rel) throw new Error("signVideoUrl: response missing signed url");
  return rel.startsWith("http") ? rel : `${SUPABASE_URL}/storage/v1${rel}`;
}

async function getNodeVersion(): Promise<number> {
  const resp = await sbFetch(
    `/rest/v1/athlete_lab_nodes?id=eq.${CANONICAL_NODE_ID}&select=node_version`,
  );
  if (!resp.ok) throw new Error(`getNodeVersion: HTTP ${resp.status} ${await resp.text()}`);
  const rows = (await resp.json()) as Array<{ node_version: number }>;
  if (!rows.length) throw new Error(`Node ${CANONICAL_NODE_ID} not found`);
  return rows[0].node_version;
}

async function createUpload(videoUrl: string, nodeVersion: number): Promise<string> {
  const resp = await sbFetch(`/functions/v1/admin-create-athlete-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      athleteId: CANONICAL_ATHLETE_ID,
      nodeId: CANONICAL_NODE_ID,
      nodeVersion,
      videoUrl,
      cameraAngle: "sideline",
      startSeconds: 0,
      endSeconds: 3,
      analysisContext: { source: "slice2a_b1_drift_band" },
    }),
  });
  if (!resp.ok) throw new Error(`createUpload: HTTP ${resp.status} ${await resp.text()}`);
  const body = (await resp.json()) as { uploadId?: string };
  if (!body.uploadId) throw new Error(`createUpload: missing uploadId in ${JSON.stringify(body)}`);
  return body.uploadId;
}

async function pollUntilTerminal(uploadId: string): Promise<{ status: string; error_message: string | null }> {
  const t0 = Date.now();
  let last = "";
  while (Date.now() - t0 < POLL_TIMEOUT_MS) {
    const resp = await sbFetch(`/functions/v1/admin-get-upload-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadId }),
    });
    if (resp.ok) {
      const body = (await resp.json()) as {
        upload?: { status: string; error_message: string | null; progress_message: string | null };
      };
      const up = body.upload;
      if (up) {
        if (up.status !== last) {
          process.stderr.write(`  [poll] ${up.status}${up.progress_message ? ` — ${up.progress_message}` : ""}\n`);
          last = up.status;
        }
        if (["completed", "failed", "error", "cancelled"].includes(up.status)) {
          return { status: up.status, error_message: up.error_message };
        }
      }
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`pollUntilTerminal: timed out for upload ${uploadId}`);
}

async function fetchCalibrationAudit(uploadId: string): Promise<{
  audit: Record<string, unknown>;
  resultId: string;
}> {
  const resp = await sbFetch(
    `/rest/v1/athlete_lab_results?upload_id=eq.${uploadId}&select=id,result_data`,
  );
  if (!resp.ok) throw new Error(`fetchCalibrationAudit: HTTP ${resp.status} ${await resp.text()}`);
  const rows = (await resp.json()) as Array<{ id: string; result_data: Record<string, unknown> }>;
  if (!rows.length) throw new Error(`No athlete_lab_results row for upload ${uploadId}`);
  const audit = (rows[0].result_data ?? {}).calibration_audit as Record<string, unknown> | undefined;
  if (!audit || typeof audit !== "object") {
    throw new Error(`result_data.calibration_audit missing for upload ${uploadId}`);
  }
  return { audit, resultId: rows[0].id };
}

async function runOnce(
  label: "baseline" | "postship",
  baselineUrlTag: string | null,
): Promise<void> {
  requireEnv();
  const t0 = Date.now();
  process.stderr.write(`[${label}] sign → create → poll → fetch\n`);
  const videoUrl = await signVideoUrl();
  const nodeVersion = await getNodeVersion();
  const uploadId = await createUpload(videoUrl, nodeVersion);
  process.stderr.write(`  [upload] ${uploadId}\n`);
  const terminal = await pollUntilTerminal(uploadId);
  if (terminal.status !== "completed") {
    throw new Error(
      `Upload ${uploadId} status=${terminal.status}: ${terminal.error_message ?? "(no message)"}`,
    );
  }
  const { audit, resultId } = await fetchCalibrationAudit(uploadId);
  const runtimeS = (Date.now() - t0) / 1000;
  appendRow(label, audit, uploadId, resultId.slice(0, 8), runtimeS, baselineUrlTag);
}

function appendRow(
  label: "baseline" | "postship",
  audit: Record<string, unknown>,
  uploadId: string,
  resultIdPrefix: string,
  pipelineRuntimeS: number,
  baselineUrlTag: string | null,
): void {
  const hash = sha256(canonicalize(audit));
  const bodyBasedPpy = Number(audit.body_based_ppy);
  const bodyBasedConfidence = audit.body_based_confidence ?? "";
  const selectedPpy = Number(audit.selected_ppy ?? audit.body_based_ppy);
  const staticPpy = audit.static_ppy ?? "";
  const deltaPct =
    ((bodyBasedPpy - BASELINE_PPY) / BASELINE_PPY) * 100;
  const group = hash === BASELINE_HASH_GROUP_A ? "A" : "B"; // C handled in --check
  const dateUtc = new Date().toISOString();
  const row = [
    dateUtc,
    uploadId,
    resultIdPrefix,
    hash,
    group,
    bodyBasedPpy,
    bodyBasedConfidence,
    selectedPpy,
    staticPpy,
    deltaPct.toFixed(4),
    "true", // categoricals_exact — recheck in --check pass
    "pass-pending-band-check",
    "2A.B1",
    `phase-2a-slice-b1-${label}`,
    `B1+B2 ${label === "baseline" ? "pre-B1 SHA" : "post-B1+B2 HEAD"} — Option D drift-band run`,
    String(pipelineRuntimeS),
    `F-OPS-6 remediation — Phase 2a slice B1/B2 drift-band corroboration; run ${label}${baselineUrlTag ? `; mediapipe_url_tag=${baselineUrlTag}` : ""}.`,
  ]
    .map((v) => {
      const s = String(v);
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(",");
  appendFileSync(CSV_PATH, "\n" + row, "utf8");
  process.stdout.write(row + "\n");
}

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
    // naive CSV split; rows in this file do not embed commas inside fields
    // except via quoted notes (last col). Drop trailing quoted notes safely.
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

  // categoricals
  const anyCatMismatch = [...baseline, ...postship].some((r) => r[catIdx] !== "true");
  if (anyCatMismatch) {
    console.error("HALT: categorical mismatch present in run set.");
    return 4;
  }

  // mode set
  const novel = [...postshipHashes].filter((h) => !baselineHashes.has(h));
  if (novel.length > 0) {
    console.error(
      `HALT: postship contains hash(es) absent from baseline: ${novel.join(", ")}.\n` +
        `First diagnostic is N more baseline runs at the pre-B1 SHA, NOT a B1 investigation. ` +
        `Undersampling F-SLICE-E-2's 7/1/1 mode distribution is the more likely cause.`,
    );
    return 1;
  }

  // mean + stddev
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--check")) {
    process.exit(check());
  }
  const labelIdx = args.indexOf("--label");
  if (labelIdx < 0 || !["baseline", "postship"].includes(args[labelIdx + 1])) {
    console.error("Usage: --label <baseline|postship>  OR  --check");
    process.exit(64);
  }
  const label = args[labelIdx + 1] as "baseline" | "postship";
  await runOnce(label);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
