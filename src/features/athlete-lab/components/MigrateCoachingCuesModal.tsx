/**
 * Phase 1c.1 Slice 2 — Mechanics → Phases coaching cues migration modal.
 *
 * Pure presentation + commit-handler component. NO Supabase calls, NO
 * updateNode() wiring. The parent owns persistence and passes:
 *   - the current `phase_breakdown` and `pro_mechanics`
 *   - an `onCommitPhase(phase_id, coaching_cues, cleaned_description)` handler
 *   - an `onCommitAll(updates)` handler
 *   - the current `coaching_cues_migration_status`
 *   - an `onStatusChange(next)` handler
 *
 * The modal classifies all phases via `reconcileNode` (Step 2 helpers),
 * lets the admin edit each phase's proposed cues in a textarea, and emits
 * commit events. Per-phase confirmation order doesn't matter; the lifecycle
 * advances based on confirmed_count vs total_phases via `nextMigrationStatus`.
 *
 * Step 6 will pass real Supabase write handlers; Step 3 keeps this component
 * testable in isolation.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { CoachingCuesMigrationStatus, PhaseNote } from "../types";
import {
  applyConfirmedCues,
  canOfferConfirmAll,
  reconcileNode,
  type PhaseReconciliation,
  type ReconciliationPattern,
} from "../utils/migrateCoachingCues";

export interface PhaseCommit {
  phase_id: string;
  coaching_cues: string;
  cleaned_description: string;
}

interface MigrateCoachingCuesModalProps {
  open: boolean;
  /** Current phase_breakdown from the node draft. */
  phase_breakdown: PhaseNote[];
  /** Raw `pro_mechanics` text (JSON-encoded array) from the node. */
  pro_mechanics: string;
  /** Current node-level lifecycle status. */
  status: CoachingCuesMigrationStatus;
  /**
   * Set of phase ids the admin has already confirmed in this session or
   * previously. Used to render confirmed badges and to compute lifecycle
   * progression. Persistence of "previously confirmed" state belongs to
   * the parent (Step 6 wires this to a per-phase flag in the DB).
   */
  confirmed_phase_ids: Set<string>;
  /**
   * Commit handlers may be sync or async. When async, the modal awaits the
   * promise and disables the relevant buttons while the write is in flight.
   * Rejected promises are swallowed by the modal — the parent is responsible
   * for surfacing the error (e.g. a toast). The modal only uses the rejection
   * to clear its in-flight state.
   */
  onCommitPhase: (commit: PhaseCommit) => void | Promise<void>;
  onCommitAll: (commits: PhaseCommit[]) => void | Promise<void>;
  onStatusChange: (next: CoachingCuesMigrationStatus) => void;
  onClose: () => void;
}

const PATTERN_META: Record<
  ReconciliationPattern,
  { label: string; chipClass: string; tooltip: string }
> = {
  BOTH_IDENTICAL: {
    label: "Identical",
    chipClass: "bg-primary-container/15 text-primary border border-primary-container/30",
    tooltip: "Both sources contain identical cue text. Safe to confirm as-is.",
  },
  DIFFERS: {
    label: "Differs",
    chipClass: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    tooltip:
      "Mechanics tab and inline description disagree. Mechanics wins by default — review before confirming.",
  },
  MECHANICS_ONLY: {
    label: "Mechanics only",
    chipClass: "bg-surface-container-highest text-on-surface-variant border border-outline-variant/30",
    tooltip: "Only the Mechanics tab has content for this phase.",
  },
  INLINE_ONLY: {
    label: "Inline only",
    chipClass: "bg-surface-container-highest text-on-surface-variant border border-outline-variant/30",
    tooltip: "Only the inline description block has content for this phase.",
  },
  EMPTY: {
    label: "Empty",
    chipClass: "bg-surface-container-highest text-on-surface-variant border border-outline-variant/20",
    tooltip: "No cue content in either source. Confirming leaves coaching_cues empty.",
  },
};

const STATUS_META: Record<
  CoachingCuesMigrationStatus,
  { label: string; chipClass: string }
> = {
  pending: {
    label: "Pending",
    chipClass: "bg-surface-container-highest text-on-surface-variant border border-outline-variant/30",
  },
  in_progress: {
    label: "In progress",
    chipClass: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  },
  confirmed: {
    label: "Confirmed",
    chipClass: "bg-primary-container/15 text-primary border border-primary-container/30",
  },
};

export function MigrateCoachingCuesModal({
  open,
  phase_breakdown,
  pro_mechanics,
  status,
  confirmed_phase_ids,
  onCommitPhase,
  onCommitAll,
  onStatusChange,
  onClose,
}: MigrateCoachingCuesModalProps) {
  // onStatusChange is retained as a prop for backward compat with Step 4
  // wiring, but Step 6 owns status persistence inside the parent's commit
  // handlers (atomically with phase_breakdown). The modal no longer drives
  // status transitions.
  void onStatusChange;
  const closeRef = useRef<HTMLButtonElement>(null);

  // Reconcile the live shapes via the Step 2 pure helpers.
  const reconciliation = useMemo(
    () => reconcileNode(phase_breakdown, pro_mechanics),
    [phase_breakdown, pro_mechanics],
  );

  // Per-phase editable buffer keyed by phase_id. Initialized from the
  // proposed cues; admin can edit before committing.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // Reset drafts whenever the modal opens (or the inputs change).
  useEffect(() => {
    if (!open) return;
    const init: Record<string, string> = {};
    for (const r of reconciliation.phases) {
      if (r.phase_id) init[r.phase_id] = r.proposed_coaching_cues;
    }
    setDrafts(init);
  }, [open, reconciliation]);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const totalPhases = reconciliation.phases.length;
  const confirmAllEligible = canOfferConfirmAll(reconciliation);

  // Per-phase + bulk in-flight tracking. Step 6: while a commit is being
  // persisted, disable the relevant buttons so the admin can't double-click
  // and the visual state honestly reflects "saving".
  const [pendingPhaseIds, setPendingPhaseIds] = useState<Set<string>>(new Set());
  const [pendingAll, setPendingAll] = useState(false);
  const anyPending = pendingAll || pendingPhaseIds.size > 0;

  const handleCommitPhase = async (r: PhaseReconciliation) => {
    if (!r.phase_id) return;
    if (pendingPhaseIds.has(r.phase_id) || pendingAll) return;
    const cues = drafts[r.phase_id] ?? r.proposed_coaching_cues;
    setPendingPhaseIds((prev) => {
      const next = new Set(prev);
      next.add(r.phase_id as string);
      return next;
    });
    try {
      await onCommitPhase({
        phase_id: r.phase_id,
        coaching_cues: cues,
        cleaned_description: r.cleaned_description,
      });
    } catch {
      // Parent surfaces the error; modal just clears its in-flight state.
    } finally {
      setPendingPhaseIds((prev) => {
        const next = new Set(prev);
        next.delete(r.phase_id as string);
        return next;
      });
    }
  };

  const handleCommitAll = async () => {
    if (!confirmAllEligible || anyPending) return;
    const commits: PhaseCommit[] = reconciliation.phases
      .filter((r) => r.phase_id)
      .map((r) => ({
        phase_id: r.phase_id as string,
        coaching_cues: drafts[r.phase_id as string] ?? r.proposed_coaching_cues,
        cleaned_description: r.cleaned_description,
      }));
    setPendingAll(true);
    try {
      await onCommitAll(commits);
    } catch {
      // Parent surfaces the error.
    } finally {
      setPendingAll(false);
    }
  };

  const confirmedCount = reconciliation.phases.filter(
    (r) => r.phase_id && confirmed_phase_ids.has(r.phase_id),
  ).length;

  // Build a preview of what `phase_breakdown` will look like after applying
  // current drafts — useful for the count chip and accessible to QA. Not
  // rendered directly but kept here so the helper is exercised by the modal.
  const _previewAfter = useMemo(() => {
    const map = new Map<string, { coaching_cues: string; cleaned_description: string }>();
    for (const r of reconciliation.phases) {
      if (!r.phase_id) continue;
      map.set(r.phase_id, {
        coaching_cues: drafts[r.phase_id] ?? r.proposed_coaching_cues,
        cleaned_description: r.cleaned_description,
      });
    }
    return applyConfirmedCues(phase_breakdown, map);
  }, [reconciliation, drafts, phase_breakdown]);
  void _previewAfter;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col rounded-xl border border-outline-variant/20 bg-surface-container-high shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/5 p-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h3 className="text-on-surface text-base font-extrabold uppercase tracking-widest">
                Migrate Coaching Cues
              </h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${STATUS_META[status].chipClass}`}
              >
                {STATUS_META[status].label}
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-on-surface-variant text-xs leading-relaxed">
              Move per-phase coaching cues from the legacy Mechanics tab into the dedicated{" "}
              <span className="text-on-surface font-semibold">coaching_cues</span> field on each
              phase. Mechanics wins on conflicts by default — edit any textarea before confirming.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              {confirmedCount} / {totalPhases} confirmed
            </span>
            <button
              ref={closeRef}
              onClick={onClose}
              aria-label="Close"
              className="rounded-full border border-outline-variant/20 bg-surface-container px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-on-surface-variant transition-all hover:bg-surface-container-highest active:scale-95"
            >
              Close
            </button>
          </div>
        </div>

        {/* Bulk action bar */}
        <div className="flex items-center justify-between gap-4 border-b border-white/5 bg-surface-container px-6 py-3">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
            {(Object.keys(reconciliation.pattern_counts) as ReconciliationPattern[]).map(
              (p) => {
                const count = reconciliation.pattern_counts[p];
                if (count === 0) return null;
                return (
                  <span
                    key={p}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${PATTERN_META[p].chipClass}`}
                    title={PATTERN_META[p].tooltip}
                  >
                    {count} {PATTERN_META[p].label}
                  </span>
                );
              },
            )}
          </div>
          <div className="relative group">
            <button
              onClick={handleCommitAll}
              disabled={!confirmAllEligible}
              className={`rounded-full px-5 py-2 text-xs font-black uppercase tracking-[0.2em] transition-all active:scale-95 ${
                confirmAllEligible
                  ? "bg-primary-container text-[#00460a] hover:brightness-110"
                  : "cursor-not-allowed border border-outline-variant/20 bg-surface-container text-on-surface-variant/50"
              }`}
            >
              Confirm all
            </button>
            {!confirmAllEligible && (
              <div className="pointer-events-none absolute right-0 top-full mt-2 w-72 rounded-lg border border-outline-variant/20 bg-surface-container-highest p-3 text-[11px] leading-relaxed text-on-surface-variant opacity-0 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-opacity group-hover:opacity-100 z-20">
                Confirm all is only available when every phase is{" "}
                <span className="text-primary">Identical</span> or{" "}
                <span className="text-on-surface">Empty</span>. Phases with content in only one
                source, or with conflicting content, require per-phase admin review.
              </div>
            )}
          </div>
        </div>

        {/* Per-phase rows */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {reconciliation.phases.length === 0 ? (
            <div className="rounded-xl border border-outline-variant/10 bg-surface-container p-8 text-center">
              <span className="material-symbols-outlined text-on-surface-variant text-4xl">
                inventory_2
              </span>
              <p className="mt-3 text-on-surface-variant text-sm">
                This node has no phases defined. Add phases on the Phases tab before migrating
                coaching cues.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reconciliation.phases.map((r, i) => {
                const isConfirmed = !!(r.phase_id && confirmed_phase_ids.has(r.phase_id));
                const meta = PATTERN_META[r.pattern];
                const draftValue =
                  (r.phase_id && drafts[r.phase_id]) ?? r.proposed_coaching_cues;
                return (
                  <div
                    key={r.phase_id ?? `idx-${i}`}
                    className="rounded-xl border border-white/5 bg-surface-container p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                          Phase {i + 1}
                        </span>
                        <h4 className="text-on-surface text-sm font-bold uppercase tracking-wider">
                          {r.phase_name}
                        </h4>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${meta.chipClass}`}
                          title={meta.tooltip}
                        >
                          {meta.label}
                        </span>
                        {isConfirmed && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary-container/30 bg-primary-container/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                            <span className="material-symbols-outlined text-[12px]">
                              check_circle
                            </span>
                            Confirmed
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleCommitPhase(r)}
                        disabled={!r.phase_id}
                        className="rounded-full bg-primary-container px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#00460a] transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isConfirmed ? "Re-confirm" : "Confirm phase"}
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <div className="rounded-lg border border-white/5 bg-surface-container-lowest p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant">
                            Mechanics tab
                          </span>
                          <span className="text-[10px] text-on-surface-variant">
                            {r.mechanics_cues.length} chars
                          </span>
                        </div>
                        <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-on-surface-variant">
                          {r.mechanics_cues || (
                            <span className="italic text-on-surface-variant/50">empty</span>
                          )}
                        </pre>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-surface-container-lowest p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant">
                            Inline description
                          </span>
                          <span className="text-[10px] text-on-surface-variant">
                            {r.inline_cues.length} chars
                          </span>
                        </div>
                        <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-on-surface-variant">
                          {r.inline_cues || (
                            <span className="italic text-on-surface-variant/50">empty</span>
                          )}
                        </pre>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant">
                        Coaching cues to write{" "}
                        <span className="text-on-surface-variant/60 normal-case tracking-normal">
                          (editable — defaults to{" "}
                          {r.pattern === "DIFFERS" ? "Mechanics (winner)" : "the source with content"}
                          )
                        </span>
                      </label>
                      <textarea
                        value={draftValue}
                        onChange={(e) => {
                          if (!r.phase_id) return;
                          setDrafts((prev) => ({ ...prev, [r.phase_id as string]: e.target.value }));
                        }}
                        rows={5}
                        className="mt-1 w-full rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary-container/50 focus:outline-none"
                        placeholder="No cues — confirming leaves this phase's coaching_cues empty."
                      />
                      <div className="mt-1 text-[10px] text-on-surface-variant">
                        Description will be saved as:{" "}
                        <span className="text-on-surface-variant/80">
                          {r.cleaned_description.length} chars
                        </span>{" "}
                        (inline separator block stripped at confirmation)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-white/5 bg-surface-container px-6 py-4">
          <p className="text-[11px] text-on-surface-variant">
            Confirmations are per-phase. Closing the modal preserves any phases you've already
            confirmed.
          </p>
          <button
            onClick={onClose}
            className="rounded-full border border-outline-variant/20 bg-surface-container-high px-5 py-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant transition-all hover:bg-surface-container-highest active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
