import { useAthleteStore } from "@/store/athleteStore";

const navItems = [
  { key: "identity" as const, icon: "fingerprint", label: "Identity" },
  { key: "performance" as const, icon: "sports_score", label: "Performance" },
  { key: "develop" as const, icon: "trending_up", label: "Develop" },
  { key: "pulse" as const, icon: "monitoring", label: "Pulse" },
  { key: "connect" as const, icon: "handshake", label: "Connect" },
];

const strengthSegments = 10;

const computeProfileStrength = (state: ReturnType<typeof useAthleteStore.getState>): number => {
  let score = 0;
  if (state.actionPhotoUrl) score += 25;
  if (state.schoolLogoUrl) score += 15;
  if (state.bio && state.bio.length > 0) score += 15;
  if (state.firstName && state.lastName) score += 10;
  if (state.position) score += 10;
  if (state.school) score += 10;
  if (state.teamColor && state.teamColor !== "#00e639") score += 5;
  if (state.classYear) score += 5;
  if (state.number) score += 3;
  // socialLinks not yet in store → 2% reserved
  return score;
};

export const SideNav = () => {
  const activeSection = useAthleteStore((s) => s.activeSection);
  const setActiveSection = useAthleteStore((s) => s.setActiveSection);
  const state = useAthleteStore();
  const profileStrength = computeProfileStrength(state);
  const filledSegments = Math.round((profileStrength / 100) * strengthSegments);

  return (
    <aside className="hidden lg:flex fixed left-0 top-16 bottom-0 w-64 bg-surface flex-col z-40">
      {/* Profile Header */}
      <div className="p-6 space-y-4">
        <div>
          <h2 className="text-on-surface font-extrabold uppercase text-sm tracking-wide">
            Brand HQ
          </h2>
        </div>

        {/* Strength Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.4em]">
              Profile Strength
            </span>
            <span className="text-on-surface text-[10px] font-bold">{profileStrength}%</span>
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
        {navItems.map((item) => {
          const isActive = item.key === activeSection;
          return (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium uppercase tracking-wide transition-colors duration-200 ${
                isActive
                  ? "text-on-surface bg-surface-container-high"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
              }`}
              style={
                isActive
                  ? { borderLeft: "2px solid var(--team-color)" }
                  : undefined
              }
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
