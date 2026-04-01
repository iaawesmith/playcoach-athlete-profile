const stats = [
  { label: "REC", value: "67" },
  { label: "YDS", value: "1,124" },
  { label: "TD", value: "12" },
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
  return (
    <div className="flex flex-col items-center">
      {/* Live Label + Your Card Heading */}
      <div className="w-full mb-6">
        <div className="flex items-center justify-center gap-2">
          <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">
            Live
          </span>
          <h2 className="text-on-surface font-black uppercase text-lg tracking-wide">
            Your Card
          </h2>
        </div>
      </div>

      {/* Card */}
      <div className="team-glow w-full max-w-sm aspect-[3/4] rounded-[12px] overflow-hidden bg-surface-container-high relative group">
        {/* Silhouette Placeholder */}
        <AthleteSilhouette />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />

        {/* School color banner */}
        <div
          className="absolute top-0 left-0 right-0 h-8 z-10 flex items-center justify-center"
          style={{ backgroundColor: "var(--team-color)" }}
        >
          <span className="text-[9px] font-black tracking-[0.25em] uppercase text-white/90">
            University of Georgia
          </span>
        </div>

        {/* Bottom-left — School logo slot */}
        <div className="absolute bottom-3 left-3 z-10 w-10 h-10 glass-card rounded-lg flex items-center justify-center">
          <ShieldPlaceholder />
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pl-16 z-10">
          <h3 className="font-black italic uppercase tracking-tighter text-on-surface text-2xl leading-none">
            Marcus Sterling
          </h3>
          <p
            className="font-bold uppercase tracking-widest text-sm mt-1"
            style={{ color: "var(--team-color)" }}
          >
            Wide Receiver / #84
          </p>

          {/* Stats */}
          <div className="flex gap-4 mt-3">
            {stats.map((stat) => (
              <div key={stat.label}>
                <span className="text-[10px] uppercase tracking-widest text-on-surface-variant block">
                  {stat.label}
                </span>
                <span className="text-on-surface font-black text-lg">{stat.value}</span>
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
        <button className="flex-1 kinetic-gradient text-[#00460a] rounded-full font-black uppercase tracking-[0.2em] text-xs h-11 active:scale-95 transition-all duration-150">
          Publish Profile
        </button>
        <button className="w-11 h-11 rounded-full glass-card flex items-center justify-center border border-outline-variant/20 active:scale-95 transition-all duration-150">
          <span className="material-symbols-outlined text-on-surface text-lg">share</span>
        </button>
      </div>
    </div>
  );
};
