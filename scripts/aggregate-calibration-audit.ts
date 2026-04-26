// scripts/aggregate-calibration-audit.ts
//
// Pass 5e-bis (Phase 1c.2 cleanup) — calibration-audit aggregator.
//
// Purpose
// -------
// For every clip registered in `docs/reference/calibration/*.yaml` (currently
// just `ground-truth.yaml`), find every `athlete_lab_results` row whose
// upstream `athlete_uploads.video_url` resolves to the clip's `bucket_path`,
// pull `result_data.calibration_audit`, and emit a single deterministic CSV
// at `docs/reference/calibration-audit-rollup.csv`.
//
// Output schema (header line, fixed order, do NOT reorder without bumping
// the schema doc):
//
//   clip_id, upload_id, result_id, analyzed_at,
//   body_based_ppy, body_based_confidence, selected_ppy, static_ppy,
//   calibration_audit_hash, group, delta_pct_vs_baseline, notes
//
// Determinism / idempotency contract
// ----------------------------------
//   - Rows sorted by (clip_id, analyzed_at ASC, upload_id) — stable.
//   - Numeric values written verbatim from the JSON (no rounding); JSON
//     `null` -> empty string.
//   - Hash is SHA-256 of the canonicalized calibration_audit object (keys
//     sorted, no whitespace).
//   - `delta_pct_vs_baseline` is `(body_based_ppy / baseline - 1) * 100`,
//     where `baseline` is the `body_based_ppy` of the earliest row per
//     `clip_id`. Baseline row is `0.0000`. Deltas formatted to 4 dp.
//   - `group` is `A` for rows whose `calibration_audit_hash` matches the
//     baseline hash exactly, otherwise `B`, `C`, ... in first-seen order.
//   - Re-running the script with no DB changes overwrites the file with
//     byte-identical content.
//
// Halt conditions
// ---------------
//   - If any registered clip resolves to zero uploads, exit non-zero with
//     `F-SLICE-1C2-CLEANUP-1` in the error message.
//   - If a result row's `calibration_audit` is missing or non-object, log
//     to stderr and skip the row (counted in the summary).
//
// Risk-register backlinks
// -----------------------
// This script informs:
//   - F-SLICE-B-1   (both calibration paths produce 2.6× distance errors)
//   - F-SLICE-B1-2  (release-speed metric correctness on slant route)
//   - F-SLICE-E-2   (~0.78% non-deterministic drift on identical input)
//
// Convention: re-run after each ground-truth clip addition. See
// `docs/agents/conventions.md` § "Calibration audit rollup."
//
// Usage
// -----
//   deno run --allow-env --allow-net --allow-read --allow-write \
//     scripts/aggregate-calibration-audit.ts
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (read from process env).

import { parse as parseYaml } from "jsr:@std/yaml@1.0.5";
import { encodeHex } from "jsr:@std/encoding@1.0.5/hex";

// ---------- types ----------

type CalibrationAudit = {
  body_based_ppy?: number | null;
  body_based_confidence?: number | null;
  selected_ppy?: number | null;
  static_ppy?: number | null;
  [k: string]: unknown;
};

type ResultRow = {
  id: string;
  upload_id: string | null;
  analyzed_at: string;
  result_data: { calibration_audit?: CalibrationAudit } | null;
};

type UploadRow = { id: string; video_url: string | null };

type ClipEntry = {
  file_identifier: string;
  bucket_path: string;
};

type GroundTruth = {
  entries: ClipEntry[];
};

// ---------- helpers ----------

const repoRoot = new URL("..", import.meta.url);
const calibrationDir = new URL("docs/reference/calibration/", repoRoot);
const outputCsv = new URL("docs/reference/calibration-audit-rollup.csv", repoRoot);

function env(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`missing env: ${key}`);
  return v;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(",")}}`;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return encodeHex(new Uint8Array(buf));
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replaceAll("\"", "\"\"")}"`;
  }
  return s;
}

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function fmtDelta(v: number): string {
  return v.toFixed(4);
}

// Match a video_url to a bucket_path by suffix (URL has signing token query
// string and host prefix; bucket_path is the canonical "athlete-videos/..."
// component). We test for "/{bucket_path}?" or "/{bucket_path}$".
function urlMatchesBucket(videoUrl: string | null, bucketPath: string): boolean {
  if (!videoUrl) return false;
  const idx = videoUrl.indexOf(bucketPath);
  if (idx === -1) return false;
  const after = videoUrl.charAt(idx + bucketPath.length);
  return after === "" || after === "?" || after === "&";
}

// ---------- main ----------

async function main(): Promise<void> {
  const supabaseUrl = env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

  // 1. Load every yaml registry under docs/reference/calibration/.
  const clips: ClipEntry[] = [];
  for await (const f of Deno.readDir(calibrationDir)) {
    if (!f.isFile || !f.name.endsWith(".yaml")) continue;
    const text = await Deno.readTextFile(new URL(f.name, calibrationDir));
    const parsed = parseYaml(text) as GroundTruth;
    for (const e of parsed.entries ?? []) {
      if (!e.file_identifier || !e.bucket_path) continue;
      clips.push({ file_identifier: e.file_identifier, bucket_path: e.bucket_path });
    }
  }
  if (clips.length === 0) {
    console.error("no clips registered in docs/reference/calibration/*.yaml — nothing to do");
    Deno.exit(2);
  }

  // 2. Pull all uploads + all results in one shot. Volumes are tiny (<1k rows).
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  const uploadsResp = await fetch(
    `${supabaseUrl}/rest/v1/athlete_uploads?select=id,video_url`,
    { headers },
  );
  if (!uploadsResp.ok) throw new Error(`uploads fetch ${uploadsResp.status}: ${await uploadsResp.text()}`);
  const uploads = (await uploadsResp.json()) as UploadRow[];

  const resultsResp = await fetch(
    `${supabaseUrl}/rest/v1/athlete_lab_results?select=id,upload_id,analyzed_at,result_data&order=analyzed_at.asc`,
    { headers },
  );
  if (!resultsResp.ok) throw new Error(`results fetch ${resultsResp.status}: ${await resultsResp.text()}`);
  const results = (await resultsResp.json()) as ResultRow[];

  // 3. Build per-clip row sets and check halt condition.
  type Built = {
    clip_id: string;
    upload_id: string;
    result_id: string;
    analyzed_at: string;
    body_based_ppy: number | null;
    body_based_confidence: number | null;
    selected_ppy: number | null;
    static_ppy: number | null;
    calibration_audit_hash: string;
  };
  const built: Built[] = [];
  let skippedNoAudit = 0;

  for (const clip of clips) {
    const matchedUploadIds = new Set(
      uploads.filter((u) => urlMatchesBucket(u.video_url, clip.bucket_path)).map((u) => u.id),
    );
    if (matchedUploadIds.size === 0) {
      console.error(
        `HALT: clip "${clip.file_identifier}" (${clip.bucket_path}) resolves to zero uploads. ` +
          `Log F-SLICE-1C2-CLEANUP-1 finding.`,
      );
      Deno.exit(3);
    }
    const clipResults = results.filter((r) => r.upload_id && matchedUploadIds.has(r.upload_id));
    for (const r of clipResults) {
      const ca = r.result_data?.calibration_audit;
      if (!ca || typeof ca !== "object") {
        skippedNoAudit++;
        console.error(`skip result ${r.id}: missing or non-object calibration_audit`);
        continue;
      }
      const hash = await sha256Hex(canonicalize(ca));
      built.push({
        clip_id: clip.file_identifier,
        upload_id: r.upload_id!,
        result_id: r.id,
        analyzed_at: r.analyzed_at,
        body_based_ppy: ca.body_based_ppy ?? null,
        body_based_confidence: ca.body_based_confidence ?? null,
        selected_ppy: ca.selected_ppy ?? null,
        static_ppy: ca.static_ppy ?? null,
        calibration_audit_hash: hash,
      });
    }
  }

  // 4. Per-clip: pick baseline (earliest analyzed_at), assign group letters
  //    by hash in first-seen order, compute delta vs baseline ppy.
  built.sort((a, b) => {
    if (a.clip_id !== b.clip_id) return a.clip_id < b.clip_id ? -1 : 1;
    if (a.analyzed_at !== b.analyzed_at) return a.analyzed_at < b.analyzed_at ? -1 : 1;
    return a.upload_id < b.upload_id ? -1 : 1;
  });

  type Final = Built & { group: string; delta_pct_vs_baseline: string; notes: string };
  const final: Final[] = [];
  const baselineByClip = new Map<string, { hash: string; ppy: number | null }>();
  const groupMapByClip = new Map<string, Map<string, string>>();

  for (const row of built) {
    if (!baselineByClip.has(row.clip_id)) {
      baselineByClip.set(row.clip_id, { hash: row.calibration_audit_hash, ppy: row.body_based_ppy });
      groupMapByClip.set(row.clip_id, new Map([[row.calibration_audit_hash, "A"]]));
    }
    const groups = groupMapByClip.get(row.clip_id)!;
    if (!groups.has(row.calibration_audit_hash)) {
      const nextLetter = String.fromCharCode("A".charCodeAt(0) + groups.size);
      groups.set(row.calibration_audit_hash, nextLetter);
    }
    const group = groups.get(row.calibration_audit_hash)!;
    const baseline = baselineByClip.get(row.clip_id)!;
    let deltaStr = "";
    if (row.body_based_ppy !== null && baseline.ppy !== null && baseline.ppy !== 0) {
      const delta = (row.body_based_ppy / baseline.ppy - 1) * 100;
      deltaStr = fmtDelta(delta);
    }
    final.push({ ...row, group, delta_pct_vs_baseline: deltaStr, notes: "" });
  }

  // 5. Write CSV (deterministic, idempotent, LF line endings).
  const header = [
    "clip_id",
    "upload_id",
    "result_id",
    "analyzed_at",
    "body_based_ppy",
    "body_based_confidence",
    "selected_ppy",
    "static_ppy",
    "calibration_audit_hash",
    "group",
    "delta_pct_vs_baseline",
    "notes",
  ];
  const lines = [header.join(",")];
  for (const r of final) {
    lines.push(
      [
        csvEscape(r.clip_id),
        csvEscape(r.upload_id),
        csvEscape(r.result_id),
        csvEscape(r.analyzed_at),
        csvEscape(fmtNum(r.body_based_ppy)),
        csvEscape(fmtNum(r.body_based_confidence)),
        csvEscape(fmtNum(r.selected_ppy)),
        csvEscape(fmtNum(r.static_ppy)),
        csvEscape(r.calibration_audit_hash),
        csvEscape(r.group),
        csvEscape(r.delta_pct_vs_baseline),
        csvEscape(r.notes),
      ].join(","),
    );
  }
  const csv = lines.join("\n") + "\n";
  await Deno.writeTextFile(outputCsv, csv);

  console.log(
    JSON.stringify(
      {
        clips: clips.length,
        rows_written: final.length,
        skipped_no_audit: skippedNoAudit,
        output: outputCsv.pathname,
      },
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  await main();
}
