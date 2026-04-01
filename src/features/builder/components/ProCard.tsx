import { useAthleteStore } from "@/store/athleteStore";

const physicals = [
  { label: "HEIGHT", value: "6'2\"" },
  { label: "WEIGHT", value: "195" },
  { label: "40-YD", value: "4.42" },
];

const AthleteSilhouette = () => (
  <div className="absolute inset-0 flex items-center justify-center">
    <svg
      viewBox="0 0 100 200"
      className="w-28 h-48 opacity-[0.09]"
      fill="white"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50" cy="17" r="13"/>
      <rect x="44" y="28" width="12" height="10" rx="4"/>
      <path d="M10 54 L20 37 Q33 31 50 31 Q67 31 80 37 L90 54 L84 94 L16 94 Z"/>
      <path d="M14 52 L3 93 L13 96 L24 61"/>
      <path d="M86 52 L97 93 L87 96 L76 61"/>
      <path d="M25 94 L18 162 L33 162 L50 111"/>
      <path d="M75 94 L82 162 L67 162 L50 111"/>
      <ellipse cx="26" cy="165" rx="11" ry="5"/>
      <ellipse cx="74" cy="165" rx="11" ry="5"/>
    </svg>
  </div>
);

const ShieldPlaceholder = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-5 h-5 text-on-surface-variant"
  >
    <path
      d="M12 2L4 6V12C4 17 7.6 21.5 12 22.5C16.4 21.5 20 17 20 12V6L12 2Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

export const ProCard = () => {
  const { profileStatus, publishProfile, hasBeenPublished } = useAthleteStore();
  const isDraft = profileStatus === "draft";

  return (
    <div className="flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-sm mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-on-surface font-black uppercase text-lg tracking-wide">
            Your Card
          </h2>
          <div className="flex items-center gap-1.5">
            {isDraft ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">
                  Draft
                </span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">
                  Live
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="team-glow w-full max-w-sm aspect-[3/4] rounded-[12px] overflow-hidden bg-surface-container-high relative group">
        {/* Photo placeholder prompt */}
        <div className="absolute top-8 bottom-[40%] left-0 right-0 flex items-center justify-center z-[1]">
          <span className="text-on-surface-variant/40 text-sm font-semibold uppercase tracking-widest">
            Add Your Action Photo
          </span>
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-transparent" />

        {/* School color banner */}
        <div
          className="absolute top-0 left-0 right-0 h-8 z-10 flex items-center justify-center"
          style={{ backgroundColor: "var(--team-color)" }}
        >
          <span className="text-[9px] font-black tracking-[0.25em] uppercase text-white/90">
            University of Georgia
          </span>
        </div>

        {/* School logo — lower right */}
        <div className="absolute bottom-3 right-3 z-10 w-10 h-10 rounded-lg flex items-center justify-center opacity-40">
          <ShieldPlaceholder />
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
          {/* Position + Class Year badges */}
          <div className="flex items-center gap-3 mb-3">
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-[2px]"
              style={{ backgroundColor: "var(--team-color)", color: "white" }}
            >
              Wide Receiver
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-[2px] border border-white/20 text-on-surface-variant">
              Class of 2025
            </span>
          </div>

          {/* Athlete name — two lines, uniform size */}
          <h3 className="font-black italic uppercase tracking-tighter text-on-surface text-5xl leading-[0.9]">
            Marcus
          </h3>
          <h3 className="font-black italic uppercase tracking-tighter text-on-surface text-5xl leading-[0.9] mt-0.5">
            Sterling
          </h3>


          {/* Physical attributes row */}
          <div className="flex gap-5 mt-3 border-t border-white/10 pt-3">
            {physicals.map((attr) => (
              <div key={attr.label}>
                <span className="text-[10px] uppercase tracking-widest text-on-surface-variant block">
                  {attr.label}
                </span>
                <span className="text-on-surface font-black text-xl">{attr.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Badge Strip */}
      <div className="w-full max-w-sm mt-4 mb-2">
        <p className="text-[9px] text-on-surface-variant uppercase tracking-widest text-center mb-1">
          Earned Badges
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {[{ icon: "star", label: "Deep Threat" }, { icon: "star", label: "Route Technician" }].map((badge) => (
            <div
              key={badge.label}
              className="glass-card border border-outline-variant/20 rounded-full px-3 py-1 flex items-center gap-1.5"
            >
              <span
                className="material-symbols-outlined text-[10px]"
                style={{ color: "var(--team-color)" }}
              >
                {badge.icon}
              </span>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                {badge.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Below Card — CTAs */}
      <div className="flex items-center gap-3 mt-2 w-full max-w-sm">
        {isDraft ? (
          <button
            onClick={publishProfile}
            className="flex-1 kinetic-gradient text-[#00460a] rounded-full font-black uppercase tracking-[0.2em] text-xs h-11 active:scale-95 transition-all duration-150"
          >
            {hasBeenPublished ? "Publish Changes" : "Go Live"}
          </button>
        ) : (
          <button
            disabled
            className="flex-1 glass-card border border-outline-variant/20 text-on-surface-variant rounded-full font-black uppercase tracking-[0.2em] text-xs h-11 flex items-center justify-center gap-2 cursor-default"
          >
            <span className="material-symbols-outlined text-sm">check_circle</span>
            Published
          </button>
        )}
        <button
          className={`w-11 h-11 rounded-full glass-card flex items-center justify-center border border-outline-variant/20 transition-all duration-150 ${
            isDraft ? "opacity-40 pointer-events-none" : "active:scale-95"
          }`}
        >
          <span className="material-symbols-outlined text-on-surface text-lg">share</span>
        </button>
      </div>
    </div>
  );
};
