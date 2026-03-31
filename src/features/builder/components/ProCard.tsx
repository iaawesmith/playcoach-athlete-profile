const stats = [
  { label: "Speed", value: 98 },
  { label: "Agility", value: 94 },
  { label: "Power", value: 88 },
];

export const ProCard = () => {
  return (
    <div className="flex flex-col items-center">
      {/* Live Rendering Label + Preview Deck Heading */}
      <div className="w-full mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: "var(--team-color)" }}
          />
          <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant">
            Live Rendering
          </span>
        </div>
        <h2 className="text-on-surface font-extrabold uppercase text-lg tracking-wide">
          Preview Deck
        </h2>
      </div>

      {/* Card */}
      <div className="team-glow w-full max-w-sm aspect-[3/4] rounded-[12px] overflow-hidden bg-surface-container-high relative group">
        {/* Empty State Photo Area */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl mb-2">photo_camera</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.4em]">
            Upload your action photo
          </span>
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

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
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
