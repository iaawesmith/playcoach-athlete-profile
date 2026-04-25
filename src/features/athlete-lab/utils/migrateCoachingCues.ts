/**
 * Phase 1c.1 Slice 2 — Mechanics → Phases coaching cues reconciliation.
 *
 * Pure functions only. No React, no Supabase, no I/O. Every function in this
 * module is deterministic and testable in isolation against synthetic inputs.
 *
 * The job: given a node's existing `pro_mechanics` text (a JSON-encoded array
 * of `{id, phase_id, content}` sections) and its `phase_breakdown` (which may
 * carry inline cues after a `— Coaching cues —` separator inside `description`),
 * classify each phase into one of five reconciliation patterns and produce a
 * proposed `coaching_cues` value plus a clean `description` (separator stripped).
 *
 * Five patterns (per phase):
 *   1. BOTH_IDENTICAL  — both sources have content and they match (after normalization)
 *   2. DIFFERS         — both sources have content but they don't match → pro_mechanics wins by default
 *   3. MECHANICS_ONLY  — only pro_mechanics has content
 *   4. INLINE_ONLY     — only the inline separator block has content
 *   5. EMPTY           — neither source has content
 *
 * Slice 2 is purely additive: this module does not delete `pro_mechanics`,
 * does not strip the inline separator from the live row, and does not write
 * to the database. It produces *proposed* values that the admin UI presents
 * for per-phase confirmation. The actual write happens at confirmation time.
 *
 * Scale principle: nothing here is Slant-specific. The helpers work for any
 * node with any phase count, any combination of source patterns, and any
 * cue length.
 */

import type { CoachingCuesMigrationStatus, PhaseNote } from "../types";

/** Marker used historically to embed coaching cues inside `phase_breakdown[].description`. */
export const INLINE_CUES_SEPARATOR = "— Coaching cues —";

/** A single section parsed out of the legacy `pro_mechanics` JSON text. */
export interface MechanicsSectionParsed {
  id: string;
  phase_id: string | null;
  content: string;
}

/** Reconciliation classification for a single phase. */
export type ReconciliationPattern =
  | "BOTH_IDENTICAL"
  | "DIFFERS"
  | "MECHANICS_ONLY"
  | "INLINE_ONLY"
  | "EMPTY";

/** Per-phase reconciliation result. */
export interface PhaseReconciliation {
  /** Phase id from `phase_breakdown[].id` (may be missing on legacy data). */
  phase_id: string | undefined;
  /** Phase name (for admin UI display). */
  phase_name: string;
  pattern: ReconciliationPattern;
  /** Cue text sourced from `pro_mechanics` for this phase, or "" if none. */
  mechanics_cues: string;
  /** Cue text extracted from the inline separator block, or "" if none. */
  inline_cues: string;
  /** Description with the inline `— Coaching cues —` block stripped (always safe to use). */
  cleaned_description: string;
  /**
   * The cue text that will be written into `phase_breakdown[].coaching_cues`
   * if the admin confirms this phase as-is. Default conflict resolution:
   * pro_mechanics wins on DIFFERS.
   */
  proposed_coaching_cues: string;
}

/** Whole-node reconciliation summary. */
export interface NodeReconciliation {
  phases: PhaseReconciliation[];
  /** True iff every phase classifies as IDENTICAL or EMPTY (eligible for "Confirm all" shortcut). */
  all_identical_or_empty: boolean;
  /** Counts by pattern for admin UI summary. */
  pattern_counts: Record<ReconciliationPattern, number>;
}

/**
 * Pattern 1 source parser. Tolerates malformed or empty input.
 * Returns [] on any parse failure rather than throwing — the migration UI
 * must always be able to render even if `pro_mechanics` is corrupt.
 */
export function parseProMechanicsText(raw: string | null | undefined): MechanicsSectionParsed[] {
  if (!raw || typeof raw !== "string" || raw.trim() === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: MechanicsSectionParsed[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id : "";
    const phase_id = typeof rec.phase_id === "string" ? rec.phase_id : null;
    const content = typeof rec.content === "string" ? rec.content : "";
    if (id === "" && phase_id === null && content === "") continue;
    out.push({ id, phase_id, content });
  }
  return out;
}

/**
 * Splits a description into `{ cleaned, inline_cues }`. The inline block is
 * everything *after* the first occurrence of the separator line. The cleaned
 * description is everything *before* it, with trailing whitespace trimmed.
 *
 * If no separator is present, `inline_cues` is "" and `cleaned` equals the
 * input description with trailing whitespace trimmed (idempotent).
 */
export function splitInlineCues(description: string | null | undefined): {
  cleaned: string;
  inline_cues: string;
} {
  if (!description || typeof description !== "string") {
    return { cleaned: "", inline_cues: "" };
  }
  const idx = description.indexOf(INLINE_CUES_SEPARATOR);
  if (idx === -1) {
    return { cleaned: description.trimEnd(), inline_cues: "" };
  }
  const before = description.slice(0, idx).trimEnd();
  const after = description.slice(idx + INLINE_CUES_SEPARATOR.length).trim();
  return { cleaned: before, inline_cues: after };
}

/**
 * Conservative equivalence check used to decide IDENTICAL vs DIFFERS.
 * Normalizes whitespace (collapses runs of whitespace to single spaces, trims
 * ends) so a trailing newline or double space doesn't trigger a false DIFFERS.
 * Comparison is case-sensitive — coaching cues are prose where casing is
 * meaningful.
 */
export function cuesEquivalent(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  return norm(a) === norm(b);
}

/** Classify one phase against its (possibly absent) mechanics section. */
export function classifyPhase(
  phase: PhaseNote,
  mechanics_section: MechanicsSectionParsed | undefined,
): PhaseReconciliation {
  const { cleaned, inline_cues } = splitInlineCues(phase.description);
  const mechanics_cues = (mechanics_section?.content ?? "").trim();
  const inline_trimmed = inline_cues.trim();

  const has_mech = mechanics_cues !== "";
  const has_inline = inline_trimmed !== "";

  let pattern: ReconciliationPattern;
  let proposed: string;

  if (!has_mech && !has_inline) {
    pattern = "EMPTY";
    proposed = "";
  } else if (has_mech && !has_inline) {
    pattern = "MECHANICS_ONLY";
    proposed = mechanics_cues;
  } else if (!has_mech && has_inline) {
    pattern = "INLINE_ONLY";
    proposed = inline_trimmed;
  } else if (cuesEquivalent(mechanics_cues, inline_trimmed)) {
    pattern = "BOTH_IDENTICAL";
    proposed = mechanics_cues; // either source is fine; pick mechanics for consistency
  } else {
    pattern = "DIFFERS";
    proposed = mechanics_cues; // pro_mechanics wins by default per slice 2 plan
  }

  return {
    phase_id: phase.id,
    phase_name: phase.name,
    pattern,
    mechanics_cues,
    inline_cues: inline_trimmed,
    cleaned_description: cleaned,
    proposed_coaching_cues: proposed,
  };
}

/**
 * Build a whole-node reconciliation. Matches mechanics sections to phases
 * by `phase_id`. A phase with no matching section is still classified
 * (it'll fall into INLINE_ONLY or EMPTY based on its description).
 */
export function reconcileNode(
  phase_breakdown: PhaseNote[] | null | undefined,
  pro_mechanics_raw: string | null | undefined,
): NodeReconciliation {
  const phases = Array.isArray(phase_breakdown) ? phase_breakdown : [];
  const sections = parseProMechanicsText(pro_mechanics_raw);

  const by_phase_id = new Map<string, MechanicsSectionParsed>();
  for (const s of sections) {
    if (s.phase_id) by_phase_id.set(s.phase_id, s);
  }

  const reconciled = phases.map((p) => {
    const match = p.id ? by_phase_id.get(p.id) : undefined;
    return classifyPhase(p, match);
  });

  const counts: Record<ReconciliationPattern, number> = {
    BOTH_IDENTICAL: 0,
    DIFFERS: 0,
    MECHANICS_ONLY: 0,
    INLINE_ONLY: 0,
    EMPTY: 0,
  };
  for (const r of reconciled) counts[r.pattern] += 1;

  const all_identical_or_empty = reconciled.every(
    (r) => r.pattern === "BOTH_IDENTICAL" || r.pattern === "EMPTY",
  );

  return { phases: reconciled, all_identical_or_empty, pattern_counts: counts };
}

/**
 * Pure lifecycle transition function. Given a current status and a count of
 * how many phases the admin has confirmed (out of total), returns the next
 * status. Post-confirmation edits keep `confirmed` (admin editing a confirmed
 * phase doesn't reset progress).
 *
 * Lifecycle:
 *   pending          (0 confirmed, current=pending)        → pending
 *   pending          (>=1 confirmed, <total)               → in_progress
 *   pending          (=total)                              → confirmed
 *   in_progress      (=0)                                  → pending  (only if explicitly reset)
 *   in_progress      (>=1, <total)                         → in_progress
 *   in_progress      (=total)                              → confirmed
 *   confirmed        (any)                                 → confirmed  (sticky — post-edit allowed)
 */
export function nextMigrationStatus(
  current: CoachingCuesMigrationStatus,
  confirmed_count: number,
  total_phases: number,
): CoachingCuesMigrationStatus {
  if (current === "confirmed") return "confirmed";
  if (total_phases <= 0) return current;
  if (confirmed_count >= total_phases) return "confirmed";
  if (confirmed_count >= 1) return "in_progress";
  return current === "in_progress" ? "pending" : "pending";
}

/**
 * Helper for the admin UI: should the "Confirm all" shortcut be offered?
 * Per slice 2 plan: only when every phase is IDENTICAL or EMPTY.
 */
export function canOfferConfirmAll(reconciliation: NodeReconciliation): boolean {
  return reconciliation.all_identical_or_empty && reconciliation.phases.length > 0;
}

/**
 * Apply confirmed coaching cues to a `phase_breakdown` array, returning a
 * NEW array (immutable). Each entry in `confirmed_cues_by_phase_id` overwrites
 * the matching phase's `coaching_cues` AND replaces its `description` with
 * `cleaned_description` from the reconciliation (so the inline separator
 * block is removed at confirmation time, not at deploy time).
 *
 * Phases not present in `confirmed_cues_by_phase_id` are returned unchanged.
 */
export function applyConfirmedCues(
  phase_breakdown: PhaseNote[],
  confirmed: Map<string, { coaching_cues: string; cleaned_description: string }>,
): PhaseNote[] {
  return phase_breakdown.map((p) => {
    if (!p.id) return p;
    const update = confirmed.get(p.id);
    if (!update) return p;
    return {
      ...p,
      coaching_cues: update.coaching_cues,
      description: update.cleaned_description,
    };
  });
}
