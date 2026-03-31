const stats = [
  { label: "Speed", value: 98 },
  { label: "Agility", value: 94 },
  { label: "Power", value: 88 },
];

const AthleteSilhouette = () => (
  <svg
    viewBox="0 0 200 300"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-32 h-48 text-surface-container-highest opacity-30"
  >
    {/* Head */}
    <circle cx="100" cy="60" r="28" fill="currentColor" />
    {/* Neck */}
    <rect x="90" y="88" width="20" height="16" rx="4" fill="currentColor" />
    {/* Torso / Jersey */}
    <path
      d="M60 104 C60 104 70 100 100 100 C130 100 140 104 140 104 L150 120 L145 130 L130 125 L130 190 L70 190 L70 125 L55 130 L50 120 Z"
      fill="currentColor"
    />
    {/* Shorts */}
    <path
      d="M72 190 L128 190 L132 230 L108 230 L100 220 L92 230 L68 230 Z"
      fill="currentColor"
    />
    {/* Left Leg */}
    <rect x="72" y="230" width="18" height="50" rx="6" fill="currentColor" />
    {/* Right Leg */}
    <rect x="110" y="230" width="18" height="50" rx="6" fill="currentColor" />
  </svg>
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
        {/* Silhouette Placeholder — top 2/3 */}
        <div className="absolute inset-0 bottom-1/3 flex items-center justify-center">
          <AthleteSilhouette />
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />

        {/* Top-right badge — School abbreviation */}
        <div className="absolute top-3 right-3 z-10">
          <span
            className="text-[10px] font-black uppercase italic tracking-widest text-white px-2.5 py-1 rounded"
            style={{ backgroundColor: "var(--team-color)" }}
          >
            UGA
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
