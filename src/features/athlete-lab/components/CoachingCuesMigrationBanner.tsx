/**
 * Phase 1c.1 Slice 2 — Banner shown on Phases and Mechanics tabs to surface
 * the Mechanics → Phases coaching cues migration.
 *
 * Visibility & copy rules (per slice 2 plan):
 *   - status = 'pending' or 'in_progress':
 *       Both tabs render the banner with the action copy. Click opens the
 *       MigrateCoachingCuesModal. The only way to clear the banner is to
 *       complete the migration (no separate dismiss button — that would
 *       defeat R-01's mitigation purpose).
 *   - status = 'confirmed':
 *       Phases tab: banner is hidden entirely (no need to remind the admin
 *       on the destination tab once migration is done).
 *       Mechanics tab: neutral notice copy "This content has migrated to the
 *       Phases tab." — no click action, no chevron.
 */

import type { CoachingCuesMigrationStatus } from "../types";

export type BannerSurface = "phases" | "mechanics";

interface CoachingCuesMigrationBannerProps {
  surface: BannerSurface;
  status: CoachingCuesMigrationStatus;
  /** Confirmed phases / total — drives the progress indicator on action copy. */
  confirmed_count: number;
  total_phases: number;
  onOpenModal: () => void;
}

export function CoachingCuesMigrationBanner({
  surface,
  status,
  confirmed_count,
  total_phases,
  onOpenModal,
}: CoachingCuesMigrationBannerProps) {
  // Phases tab + confirmed = hidden entirely.
  if (status === "confirmed" && surface === "phases") return null;

  // Mechanics tab + confirmed = neutral notice, no action.
  if (status === "confirmed" && surface === "mechanics") {
    return (
      <div
        role="status"
        className="flex items-center gap-3 rounded-xl border border-white/5 bg-surface-container px-4 py-3"
      >
        <span
          className="material-symbols-outlined shrink-0 text-on-surface-variant text-[20px]"
          aria-hidden="true"
        >
          info
        </span>
        <p className="text-on-surface-variant text-xs leading-relaxed">
          This content has migrated to the{" "}
          <span className="text-on-surface font-semibold">Phases</span> tab.
        </p>
      </div>
    );
  }

  // Pending or in_progress — actionable banner on both tabs.
  const isInProgress = status === "in_progress";
  const progressLabel = total_phases > 0
    ? `${confirmed_count} / ${total_phases} phases confirmed`
    : "No phases defined";

  return (
    <button
      type="button"
      onClick={onOpenModal}
      className="group flex w-full items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-left transition-all hover:bg-amber-500/15 active:scale-[0.995]"
    >
      <span
        className="material-symbols-outlined shrink-0 text-amber-300 text-[22px]"
        aria-hidden="true"
      >
        sync_alt
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-amber-100 text-xs font-extrabold uppercase tracking-widest">
            Coaching cues migration
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
              isInProgress
                ? "border border-amber-500/40 bg-amber-500/20 text-amber-200"
                : "border border-outline-variant/30 bg-surface-container-highest text-on-surface-variant"
            }`}
          >
            {isInProgress ? "In progress" : "Pending"}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/70">
            {progressLabel}
          </span>
        </div>
        <p className="mt-1.5 text-on-surface text-sm leading-relaxed">
          Coaching cues now live on each phase. Review and confirm the migration before this
          node's cues reach Claude.
        </p>
      </div>
      <span
        className="material-symbols-outlined shrink-0 self-center text-amber-300 text-[20px] transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      >
        chevron_right
      </span>
    </button>
  );
}
