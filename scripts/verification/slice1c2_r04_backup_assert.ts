/**
 * R-04 Backup Completeness Assertion — Phase 1c.2 Slice A
 *
 * Verifies that for every (node × deletion-target field) pair, the
 * backup row in `athlete_lab_nodes_phase1c_backup` is present and its
 * content is byte-equal to the live source value in `athlete_lab_nodes`.
 *
 * Per pre-Slice-A scope (Slant-only, n=1 node):
 *  - 10 root columns scheduled for Slice E drops
 *  - 4 JSONB-related sources (full camera_guidelines, full reference_calibrations,
 *    camera_guidelines.skill_specific_filming_notes, camera_guidelines.metadata_thresholds bundle)
 *
 * Failure record shape:
 *   { node_id, field_path, reason, source_len, backup_len, first_diff_offset,
 *     source_preview, backup_preview }
 *
 * Outputs a structured log to docs/phase-1c2-slice-a-r04-assertion.md.
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const SLANT_NODE_ID = "75ed4b18-8a22-440e-9a23-b86204956056";

type FieldSpec = {
  source_column: string;
  // Function returning the canonical live value as a string (or null).
  resolveLive: (row: Record<string, unknown>) => string | null;
  // If true, comparison is semantic-deep-equal of parsed JSON rather than byte-equal.
  // PG's ::text on JSONB normalizes whitespace and key order in a way that differs
  // from JS JSON.stringify, so byte-equal is the wrong invariant for JSONB sources.
  jsonSemantic?: boolean;
};

const FIELD_SPECS: FieldSpec[] = [
  // Slice E root-column targets (10)
  { source_column: "pro_mechanics", resolveLive: (r) => stringifyMaybeJson(r.pro_mechanics), jsonSemantic: true },
  { source_column: "llm_tone", resolveLive: (r) => stringifyScalar(r.llm_tone) },
  { source_column: "det_frequency", resolveLive: (r) => stringifyScalar(r.det_frequency) },
  { source_column: "solution_class", resolveLive: (r) => stringifyScalar(r.solution_class) },
  { source_column: "performance_mode", resolveLive: (r) => stringifyScalar(r.performance_mode) },
  { source_column: "tracking_enabled", resolveLive: (r) => stringifyScalar(r.tracking_enabled) },
  { source_column: "det_frequency_defender", resolveLive: (r) => stringifyScalar(r.det_frequency_defender) },
  { source_column: "det_frequency_multiple", resolveLive: (r) => stringifyScalar(r.det_frequency_multiple) },
  { source_column: "reference_object", resolveLive: (r) => stringifyScalar(r.reference_object) },
  { source_column: "reference_filming_instructions", resolveLive: (r) => stringifyScalar(r.reference_filming_instructions) },
  // Slice D JSON sources (4)
  { source_column: "camera_guidelines", resolveLive: (r) => stringifyMaybeJson(r.camera_guidelines), jsonSemantic: true },
  {
    source_column: "camera_guidelines.skill_specific_filming_notes",
    resolveLive: (r) => {
      const cg = parseJsonish(r.camera_guidelines);
      if (!cg || typeof cg !== "object") return null;
      const v = (cg as Record<string, unknown>).skill_specific_filming_notes;
      return v == null ? "" : String(v);
    },
  },
  { source_column: "reference_calibrations", resolveLive: (r) => stringifyMaybeJson(r.reference_calibrations), jsonSemantic: true },
  {
    source_column: "camera_guidelines.metadata_thresholds",
    resolveLive: (r) => {
      const cg = parseJsonish(r.camera_guidelines);
      if (!cg || typeof cg !== "object") return null;
      const o = cg as Record<string, unknown>;
      const bundle = {
        camera_min_fps: o.camera_min_fps ?? null,
        camera_min_resolution: o.camera_min_resolution ?? null,
        camera_min_distance: o.camera_min_distance ?? null,
        camera_max_distance: o.camera_max_distance ?? null,
        auto_reject_athlete_too_small: o.auto_reject_athlete_too_small ?? null,
        auto_reject_athlete_too_small_threshold: o.auto_reject_athlete_too_small_threshold ?? null,
        auto_reject_duration_out_of_range: o.auto_reject_duration_out_of_range ?? null,
        auto_reject_resolution_below_min: o.auto_reject_resolution_below_min ?? null,
        auto_reject_keypoint_confidence_low: o.auto_reject_keypoint_confidence_low ?? null,
        auto_reject_keypoint_confidence_threshold: o.auto_reject_keypoint_confidence_threshold ?? null,
      };
      return JSON.stringify(bundle);
    },
    jsonSemantic: true,
  },
];

function stringifyScalar(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

function stringifyMaybeJson(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function parseJsonish(v: unknown): unknown {
  if (v == null) return null;
  if (typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return null;
}

function firstDiffOffset(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a.charCodeAt(i) !== b.charCodeAt(i)) return i;
  }
  return a.length === b.length ? -1 : n;
}

function deepEqualJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqualJson(a[i], b[i])) return false;
    return true;
  }
  if (typeof a === "object" && typeof b === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const ak = Object.keys(ao);
    const bk = Object.keys(bo);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (!Object.prototype.hasOwnProperty.call(bo, k)) return false;
      if (!deepEqualJson(ao[k], bo[k])) return false;
    }
    return true;
  }
  return false;
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}
function preview(s: string | null, around: number, span = 60): string {
  if (s == null) return "<null>";
  const start = Math.max(0, around - span);
  const end = Math.min(s.length, around + span);
  return JSON.stringify(s.slice(start, end));
}

type FailRec = {
  node_id: string;
  field_path: string;
  reason: string;
  source_len: number | null;
  backup_len: number | null;
  first_diff_offset: number;
  source_preview: string;
  backup_preview: string;
};

async function main() {
  const { data: nodeRow, error: nodeErr } = await supabase
    .from("athlete_lab_nodes")
    .select("*")
    .eq("id", SLANT_NODE_ID)
    .single();
  if (nodeErr || !nodeRow) {
    console.error("Failed to load Slant node:", nodeErr);
    process.exit(2);
  }

  const { data: backupRows, error: bErr } = await supabase
    .from("athlete_lab_nodes_phase1c_backup")
    .select("source_column, content")
    .eq("node_id", SLANT_NODE_ID);
  if (bErr || !backupRows) {
    console.error("Failed to load backup rows:", bErr);
    process.exit(2);
  }

  const backupByCol = new Map<string, string | null>();
  for (const r of backupRows) backupByCol.set(r.source_column, r.content);

  const failures: FailRec[] = [];
  const passes: { field_path: string; len: number }[] = [];

  for (const spec of FIELD_SPECS) {
    const live = spec.resolveLive(nodeRow as Record<string, unknown>);
    const has = backupByCol.has(spec.source_column);
    const backup = has ? backupByCol.get(spec.source_column) ?? null : null;

    if (!has) {
      failures.push({
        node_id: SLANT_NODE_ID,
        field_path: spec.source_column,
        reason: "missing_backup_row",
        source_len: live?.length ?? null,
        backup_len: null,
        first_diff_offset: 0,
        source_preview: preview(live, 0),
        backup_preview: "<missing>",
      });
      continue;
    }

    let mismatch = false;
    let mismatchReason: "byte_mismatch" | "null_mismatch" | "json_semantic_mismatch" = "byte_mismatch";

    if (spec.jsonSemantic) {
      // Semantic deep-equal of parsed JSON. Required because PG ::text on
      // JSONB normalizes whitespace and key order differently from JS
      // JSON.stringify, so byte-equal is the wrong invariant for JSONB sources.
      const liveParsed = live == null ? null : safeParse(live);
      const backupParsed = backup == null ? null : safeParse(backup);
      if (!deepEqualJson(liveParsed, backupParsed)) {
        mismatch = true;
        mismatchReason = live == null || backup == null ? "null_mismatch" : "json_semantic_mismatch";
      }
    } else if ((live ?? "") !== (backup ?? "")) {
      mismatch = true;
      mismatchReason = live == null || backup == null ? "null_mismatch" : "byte_mismatch";
    }

    if (mismatch) {
      const a = live ?? "";
      const b = backup ?? "";
      const off = firstDiffOffset(a, b);
      failures.push({
        node_id: SLANT_NODE_ID,
        field_path: spec.source_column,
        reason: mismatchReason,
        source_len: live?.length ?? null,
        backup_len: backup?.length ?? null,
        first_diff_offset: off,
        source_preview: preview(live, off),
        backup_preview: preview(backup, off),
      });
      continue;
    }

    passes.push({ field_path: spec.source_column, len: (live ?? "").length });
  }

  const status = failures.length === 0 ? "PASS" : "FAIL";
  const lines: string[] = [];
  lines.push(`# R-04 Backup Completeness Assertion — Phase 1c.2 Slice A`);
  lines.push("");
  lines.push(`**Status:** ${status}`);
  lines.push(`**Run at:** ${new Date().toISOString()}`);
  lines.push(`**Scope:** Slant node (\`${SLANT_NODE_ID}\`), 14 deletion-target fields`);
  lines.push(`**Passes:** ${passes.length}/${FIELD_SPECS.length}`);
  lines.push(`**Failures:** ${failures.length}`);
  lines.push("");
  lines.push("## Pass detail");
  lines.push("");
  lines.push("| field_path | content_len |");
  lines.push("|---|---|");
  for (const p of passes) lines.push(`| \`${p.field_path}\` | ${p.len} |`);
  lines.push("");
  if (failures.length > 0) {
    lines.push("## Failure detail");
    lines.push("");
    for (const f of failures) {
      lines.push(`### \`${f.field_path}\``);
      lines.push("");
      lines.push("```json");
      lines.push(JSON.stringify(f, null, 2));
      lines.push("```");
      lines.push("");
    }
  }

  const outPath = "docs/phase-1c2-slice-a-r04-assertion.md";
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, lines.join("\n"));

  console.log(JSON.stringify({
    status,
    passes: passes.length,
    failures: failures.length,
    log_path: outPath,
    failure_records: failures,
  }, null, 2));

  process.exit(status === "PASS" ? 0 : 1);
}

main().catch((e) => {
  console.error("R-04 assertion script crashed:", e);
  process.exit(2);
});
