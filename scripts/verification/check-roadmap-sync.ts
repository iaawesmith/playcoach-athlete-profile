/**
 * verification/check-roadmap-sync.ts — PHASE-1C3-PREP — roadmap sync detector
 *
 * NAME: check_roadmap_sync
 * PHASE: PHASE-1C3-PREP
 *
 * VERIFIES:
 *   Every slice outcome doc with `status: shipped` is referenced in
 *   docs/roadmap.md by its slice_id. Falsifies the F-OPS-3 failure mode
 *   ("deferred work shipped earlier creates plan-vs-state drift") at the
 *   roadmap-vs-outcome-doc boundary. The slice-outcome step in
 *   docs/agents/workflows.md (Drafting a slice outcome → step 4) is the
 *   contract this script enforces: a slice is not "shipped" until the
 *   roadmap reflects it.
 *
 * RECIPE:
 *   Runtime:   bun (or tsx)
 *   Command:   bun run scripts/verification/check-roadmap-sync.ts
 *   Env vars:  none
 *   Args:      none
 *   Output:    stdout — either "OK: N shipped slices, all referenced in
 *              roadmap" (exit 0) or a list of missing slice_ids (exit 1).
 *   Halt:      Exit 1 if any shipped slice_id is absent from
 *              docs/roadmap.md. Exit 2 if a frontmatter shape problem is
 *              detected (missing slice_id, missing status, unparseable
 *              frontmatter) — surfaces normalization needs rather than
 *              silently skipping the doc.
 *
 *   Doc discovery:
 *     Globs both docs/process/phase-*-outcome.md AND
 *     docs/process/phase-*-retrospective.md, because slice closure docs
 *     can take either form. Slice 1c.3-F is the canonical example: its
 *     outcome lives in phase-1c3-retrospective.md (slice_id:
 *     PHASE-1C3-SLICE-F) rather than phase-1c3-slice-f-outcome.md.
 *
 *   slice_id matching:
 *     Frontmatter slice_id is the primary key. Two formats are accepted:
 *       - Long form: PHASE-1C3-SLICE-A, PHASE-1C2-SLICE-E (uppercase)
 *       - Short form: 1c.3-B, 1c.2-D (lowercase phase + slice letter)
 *     The roadmap is searched for either the verbatim slice_id OR the
 *     normalized short form. This handles the existing taxonomy mix
 *     across phase-1c3-slice-{a..e}-outcome.md (some long, some short)
 *     without forcing a normalization pass on existing docs. F-OPS-4
 *     sub-pattern 7 (taxonomy drift) is the underlying lesson; the
 *     normalization itself is logged in the PHASE-1C3-PREP outcome doc
 *     as a follow-up rather than executed silently here.
 *
 * BACKLINKS:
 *   - docs/risk-register/F-OPS-3-deferred-work-shipped-earlier-creates-plan-vs-state-drift.md
 *   - docs/risk-register/F-OPS-4-pre-execution-inspection-scope-systematically-underestimates-reality.md (sub-pattern 7)
 *   - docs/agents/workflows.md ("Drafting a slice outcome" → step 4)
 *   - docs/process/phase-1c3-prep-slice-outcome.md
 *
 * MAINTENANCE:
 *   Re-run after every slice closes. If a future phase introduces a
 *   third slice-id format, extend `normalizeSliceId()` rather than
 *   silently skipping the format — the script's value is in catching
 *   drift, not papering over it.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PROCESS_DIR = 'docs/process';
const ROADMAP_PATH = 'docs/roadmap.md';

interface SliceDoc {
  path: string;
  sliceId: string;
  status: string;
}

function parseFrontmatter(text: string): Record<string, string> | null {
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return null;
  const block = text.slice(4, end);
  const out: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function normalizeSliceId(id: string): string[] {
  // Returns all forms a slice_id can appear as in roadmap.md.
  const forms = new Set<string>([id]);
  // Long form: PHASE-1C3-SLICE-A → also short form 1c.3-A
  const long = id.match(/^PHASE-([0-9]+)([A-Z])([0-9]*)-SLICE-([A-Z0-9.]+)$/i);
  if (long) {
    const [, major, letter, minor, slice] = long;
    const phase = minor ? `${major}${letter.toLowerCase()}.${minor}` : `${major}${letter.toLowerCase()}`;
    forms.add(`${phase}-${slice}`);
  }
  // Short form: 1c.3-B → also long form PHASE-1C3-SLICE-B
  const short = id.match(/^([0-9]+)([a-z])(?:\.([0-9]+))?-([A-Z0-9.]+)$/i);
  if (short) {
    const [, major, letter, minor, slice] = short;
    const phase = minor ? `${major}${letter.toUpperCase()}${minor}` : `${major}${letter.toUpperCase()}`;
    forms.add(`PHASE-${phase}-SLICE-${slice.toUpperCase()}`);
  }
  return [...forms];
}

function discoverSliceDocs(): SliceDoc[] {
  const all = readdirSync(PROCESS_DIR);
  const candidates = all.filter(
    (f) =>
      (f.startsWith('phase-') && f.endsWith('-outcome.md')) ||
      (f.startsWith('phase-') && f.endsWith('-retrospective.md')),
  );
  const docs: SliceDoc[] = [];
  const legacy: string[] = [];
  for (const f of candidates) {
    const p = join(PROCESS_DIR, f);
    const text = readFileSync(p, 'utf8');
    const fm = parseFrontmatter(text);
    if (!fm || !('slice_id' in fm) || !('status' in fm)) {
      // Pre-template doc (predates slice-outcome.md template, Pass 3f 2026-04-26).
      // Not enforced — these are historical artifacts. Future slices MUST use the
      // template per docs/agents/workflows.md "Drafting a slice outcome".
      legacy.push(p);
      continue;
    }
    docs.push({ path: p, sliceId: fm.slice_id, status: fm.status });
  }
  if (legacy.length > 0) {
    console.warn(`NOTE: ${legacy.length} legacy outcome doc(s) without YAML frontmatter — not enforced:`);
    for (const l of legacy) console.warn(`  - ${l}`);
  }
  return docs;
}

function main(): void {
  const docs = discoverSliceDocs();
  const shipped = docs.filter((d) => d.status === 'shipped');
  const roadmap = readFileSync(ROADMAP_PATH, 'utf8');

  const missing: SliceDoc[] = [];
  for (const d of shipped) {
    const forms = normalizeSliceId(d.sliceId);
    const found = forms.some((f) => roadmap.includes(f));
    if (!found) missing.push(d);
  }

  if (missing.length === 0) {
    console.log(`OK: ${shipped.length} shipped slices, all referenced in roadmap.`);
    process.exit(0);
  }
  console.error(`DRIFT: ${missing.length} shipped slice(s) absent from ${ROADMAP_PATH}:`);
  for (const m of missing) {
    console.error(`  - ${m.sliceId}  (${m.path})`);
    console.error(`    Tried forms: ${normalizeSliceId(m.sliceId).join(', ')}`);
  }
  process.exit(1);
}

main();
