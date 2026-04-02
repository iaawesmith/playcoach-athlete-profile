import { useAthleteStore } from "@/store/athleteStore";

const mobileNavItems = [
  { key: "identity" as const, icon: "fingerprint", label: "Identity" },
  { key: "pulse" as const, icon: "monitoring", label: "Pulse" },
  { key: "connect" as const, icon: "handshake", label: "Connect" },
];

export const MobileNav = () => {
  const activeSection = useAthleteStore((s) => s.activeSection);
  const setActiveSection = useAthleteStore((s) => s.setActiveSection);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass-card border-t border-white/10 h-16 flex items-center justify-around px-4">
      {mobileNavItems.map((item) => {
        const isActive = item.key === activeSection;
        return (
          <button
            key={item.key}
            onClick={() => setActiveSection(item.key)}
            className={`flex flex-col items-center gap-1 transition-colors duration-200 ${
              isActive ? "text-on-surface" : "text-on-surface-variant"
            }`}
          >
            <span
              className="material-symbols-outlined text-xl"
              style={isActive ? { color: "var(--team-color)" } : undefined}
            >
              {item.icon}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-widest">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
