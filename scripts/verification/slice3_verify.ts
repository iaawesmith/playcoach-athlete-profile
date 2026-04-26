/**
 * slice3_verify.ts
 *
 * NAME:  slice3_verify
 * PHASE: PHASE-1C1 (Slice 3 — Position Field UI)
 *
 * VERIFIES:
 *   The Position Field UI round-trips correctly through the
 *   athlete_lab_nodes table and is consumed by the analyze edge function
 *   exactly as the Save button writes it. Uses the Supabase JS client
 *   (RLS = Allow All on athlete_lab_nodes) for V1 writes and psql for
 *   reads — mirrors the round-trip a real Save click does. Cross-checks
 *   the {{position}} substitution lives in the production analyze pipeline,
 *   not the (now-deleted) athlete-lab-analyze test edge function.
 *
 * RECIPE:
 *   Runtime:   tsx (Node)
 *   Command:   npx tsx scripts/verification/slice3_verify.ts
 *   Env vars:  VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
 *              PG* env (PGHOST/PGPORT/PGUSER/PGDATABASE/PGPASSWORD) for psql
 *   Args:      none
 *   Output:    stdout — pass/fail per assertion in V1..Vn ordering
 *   Halt:      exit 1 on first FAIL (assertion bail), exit 2 on missing env
 *
 * BACKLINKS:
 *   - docs/process/phase-1c1-slice3-outcome.md
 *   - docs/architecture/athlete-lab-tab-inventory.md (BASICS tab section)
 *
 * MAINTENANCE:
 *   This script reads NodeEditor.tsx and types.ts as source-of-truth for
 *   the position field set. If those file paths change, update the
 *   readFileSync calls below in the same commit.
 */
import { readFileSync } from "fs";
import { execSync } from "child_process";
import { createClient } from "@supabase/supabase-js";

const SLANT_ID = "75ed4b18-8a22-440e-9a23-b86204956056";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY env");
  process.exit(2);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const NodeEditor = readFileSync(
  "src/features/athlete-lab/components/NodeEditor.tsx",
  "utf8"
);
const types = readFileSync("src/features/athlete-lab/types.ts", "utf8");
// The {{position}} substitution lives in the production analyze pipeline,
// not the athlete-lab-analyze test edge function. (Slice 1 verified this.)
const edgeFn = readFileSync(
  "supabase/functions/analyze-athlete-video/index.ts",
  "utf8"
);

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function psqlRead(sql: string): string {
  return execSync(`psql -tA -c ${JSON.stringify(sql)}`, {
    encoding: "utf8",
  }).trim();
}

async function setPosition(value: string | null) {
  const { error } = await supabase
    .from("athlete_lab_nodes")
    .update({ position: value })
    .eq("id", SLANT_ID);
  if (error) throw new Error(`setPosition(${value}) failed: ${error.message}`);
}

// ─────── V1 ───────
console.log("\nV1 — Round-trip persistence");

const originalPosition = psqlRead(
  `select coalesce(position, 'NULL') from athlete_lab_nodes where id = '${SLANT_ID}'`
);
console.log(`    [snapshot] Slant.position = ${originalPosition}`);

await setPosition("TE");
const afterTE = psqlRead(
  `select position from athlete_lab_nodes where id = '${SLANT_ID}'`
);
assert("V1.1 set position='TE' persists and reads back", afterTE === "TE", `got ${afterTE}`);

await setPosition(null);
const afterNull = psqlRead(
  `select coalesce(position, 'NULL') from athlete_lab_nodes where id = '${SLANT_ID}'`
);
assert("V1.2 set position=NULL persists and reads back", afterNull === "NULL", `got ${afterNull}`);

const positionWriteSites = NodeEditor.match(/position:\s*draft\.position/g) ?? [];
assert(
  "V1.3 position writes only via save() payload (single source-level write site)",
  positionWriteSites.length === 1,
  `found ${positionWriteSites.length} write sites`
);

// Restore original
if (originalPosition === "NULL") await setPosition(null);
else await setPosition(originalPosition);
console.log(`    [restore] Slant.position → ${originalPosition}`);

// ─────── V2 ───────
console.log("\nV2 — Dirty state integration");

assert(
  "V2.1 position onChange routes through update('position', ...)",
  /update\("position",\s*v ===\s*""\s*\?\s*null\s*:\s*\(v as PositionValue\)\)/.test(NodeEditor)
);

assert(
  "V2.2 update callback flips dirty=true",
  /const update = useCallback[\s\S]{0,400}setDirty\(true\)/.test(NodeEditor)
);

assert(
  "V2.3 Save button disabled gating uses !dirty",
  /disabled=\{saving \|\| !dirty\}/.test(NodeEditor)
);

const saveBlock = NodeEditor.match(
  /const save = async \(\) => \{[\s\S]+?const updated = await updateNode/
)?.[0] ?? "";
assert(
  "V2.4 position batched with name+others in single save() payload",
  /name:\s*draft\.name/.test(saveBlock) && /position:\s*draft\.position/.test(saveBlock)
);

// ─────── V3 ───────
console.log("\nV3 — Edge function consumption regression");

// The pipeline maps `nodeConfig.position` (loaded from athlete_lab_nodes)
// into the {{position}} template variable. Slice 1 confirmed end-to-end.
assert(
  "V3.1 pipeline wires nodeConfig.position into {{position}} template variable",
  /position:\s*nodeConfig\.position/.test(edgeFn) &&
    /\{\{position\}\}/.test(edgeFn),
  "expected `position: nodeConfig.position` and a {{position}} mention in the pipeline"
);

assert(
  "V3.2 TrainingNode.position widened to PositionValue | null",
  /position:\s*PositionValue \| null/.test(types)
);

// ─────── V4 ───────
console.log("\nV4 — UI smoke");

const positionOptionsMatch = types.match(
  /export const POSITION_OPTIONS = \[([\s\S]+?)\] as const;/
);
const positionCount = (positionOptionsMatch?.[1].match(/"/g)?.length ?? 0) / 2;
assert(
  "V4.1a POSITION_OPTIONS contains 11 entries",
  positionCount === 11,
  `got ${positionCount}`
);

assert(
  "V4.1b dropdown maps POSITION_OPTIONS + includes — None — option",
  /<option value="">— None —<\/option>/.test(NodeEditor) &&
    /POSITION_OPTIONS\.map\(\(pos\)/.test(NodeEditor)
);

assert(
  "V4.2 dropdown is controlled by draft.position (value={draft.position ?? ''})",
  /value=\{draft\.position \?\? ""\}/.test(NodeEditor)
);

console.log(`\n${"=".repeat(60)}`);
console.log(`Slice 3 verification: ${pass}/${pass + fail} passing`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
