const navItems = [
  { icon: "fingerprint", label: "Identity", route: "/builder/identity", active: true },
  { icon: "play_circle", label: "Highlights", route: "/builder/highlights", active: false },
  { icon: "trending_up", label: "Develop", route: "/builder/develop", active: false },
  { icon: "leaderboard", label: "Stats", route: "/builder/stats", active: false },
  { icon: "handshake", label: "Connect", route: "/builder/connect", active: false },
];

const strengthSegments = 10;
const filledSegments = 8;

export const SideNav = () => {
  return (
    <aside className="hidden lg:flex fixed left-0 top-16 bottom-0 w-64 bg-surface flex-col z-40">
      {/* Profile Header */}
      <div className="p-6 space-y-4">
        <div>
          <h2 className="text-on-surface font-extrabold uppercase text-sm tracking-wide">
            Athlete Profile
          </h2>
        </div>

        {/* Strength Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.4em]">
              Profile Strength
            </span>
            <span className="text-on-surface text-[10px] font-bold">84%</span>
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: strengthSegments }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  i < filledSegments ? "bg-primary-container" : "bg-surface-container-high"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium uppercase tracking-wide transition-colors duration-200 ${
              item.active
                ? "text-on-surface bg-surface-container-high"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
            }`}
            style={
              item.active
                ? { borderLeft: "2px solid var(--team-color)" }
                : undefined
            }
          >
            <span className="material-symbols-outlined text-xl">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
};
