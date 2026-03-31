import playcoachLogo from "@/assets/playcoach-logo.png";

export const TopNav = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 glass-card border-b border-white/10 flex items-center justify-between px-6">
      {/* Left */}
      <div className="flex items-center gap-4">
        <img src={playcoachLogo} alt="PlayCoach" className="h-6 w-auto" />
        <div className="hidden md:flex items-center gap-2">
          <span className="bg-surface-container-high text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.4em] px-3 py-1 rounded">
            Performance
          </span>
          <span className="bg-surface-container-high text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.4em] px-3 py-1 rounded">
            Editorial
          </span>
        </div>
      </div>

      {/* Center — Section Tabs */}
      <div className="flex items-center gap-8">
        <button
          className="relative text-on-surface text-sm font-medium uppercase tracking-wide pb-1"
        >
          Identity
          <span
            className="absolute bottom-0 left-0 right-0 h-[2px]"
            style={{ backgroundColor: "var(--team-color)" }}
          />
        </button>
        <button className="text-on-surface-variant text-sm font-medium uppercase tracking-wide">
          Stats
        </button>
        <button className="text-on-surface-variant text-sm font-medium uppercase tracking-wide">
          Media
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors duration-200">
          <span className="material-symbols-outlined text-on-surface-variant text-xl">notifications</span>
        </button>
        <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors duration-200">
          <span className="material-symbols-outlined text-on-surface-variant text-xl">account_circle</span>
        </button>
      </div>
    </nav>
  );
};
