const stats = [
  { label: "REC", value: "67" },
  { label: "YDS", value: "1,124" },
  { label: "TD", value: "12" },
];

const AthleteSilhouette = () => (
  <div className="absolute inset-0 flex items-center justify-center">
    <svg
      viewBox="0 0 100 160"
      className="w-32 h-32 opacity-[0.07]"
      fill="white"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Head */}
      <circle cx="50" cy="22" r="14" />
      {/* Neck */}
      <rect x="44" y="34" width="12" height="10" rx="4" />
      {/* Jersey body */}
      <path d="M20 55 L28 42 Q38 36 50 36 Q62 36 72 42 L80 55 L76 100 L24 100 Z" />
      {/* Left arm */}
      <path d="M28 42 L10 80 L18 83 L32 52" />
      {/* Right arm */}
      <path d="M72 42 L90 80 L82 83 L68 52" />
      {/* Left leg */}
      <path d="M32 100 L26 145 L38 145 L50 112" />
      {/* Right leg */}
      <path d="M68 100 L74 145 L62 145 L50 112" />
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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">
              Live
            </span>
          </div>
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

      {/* Below Card — CTAs */}
      <div className="flex items-center gap-3 mt-6 w-full max-w-sm">
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
