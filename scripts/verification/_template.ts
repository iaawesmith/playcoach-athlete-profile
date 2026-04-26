/**
 * verification/_template.ts — Pass 6.3 — verification recipe template
 *
 * NAME: <short snake_case name matching the file>
 * PHASE: <PHASE-* ID from docs/reference/phases.md, e.g. PHASE-1C2-SLICE-E>
 *
 * VERIFIES:
 *   <Free prose: which finding / risk / ADR / behavior this script proves
 *    or falsifies. Be explicit about the assertion the script makes.>
 *
 * RECIPE:
 *   Runtime:   <deno|tsx|node>
 *   Command:   <exact invocation, including --allow-* flags for Deno>
 *   Env vars:  <list of required env vars, e.g. VITE_SUPABASE_URL,
 *              VITE_SUPABASE_PUBLISHABLE_KEY, PGHOST, …>
 *   Args:      <positional / flag args, default values, any --check mode>
 *   Output:    <stdout shape, files written (path + format), exit codes>
 *   Halt:      <conditions under which the script exits non-zero, what
 *              each non-zero exit code means>
 *
 * BACKLINKS:
 *   - docs/risk-register/<R-* or F-* file>.md
 *   - docs/adr/<NNNN-slug>.md
 *   - docs/process/<phase-*-outcome>.md
 *
 * MAINTENANCE:
 *   <Optional: when the script must be re-run (e.g. after each ground-truth
 *    clip addition; after every migration that touches the backup table);
 *    upstream shape assumptions that, if violated, require updating this
 *    script BEFORE the next regen — the F-SLICE-E-3 failure mode.>
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Process rationale (F-SLICE-E-3 lesson, do not delete):
 *   "Recipes that live in code with backlinks stay current."
 *   Verification scripts are documentation that runs. The header above is
 *   not optional — it is the contract that lets a future maintainer (human
 *   or agent) trust what this script proves without re-deriving it from
 *   the diff. If you change what the script verifies, update VERIFIES and
 *   BACKLINKS in the same commit.
 * ─────────────────────────────────────────────────────────────────────────
 */

// Implementation goes here. Keep imports below the header block.
export {};
