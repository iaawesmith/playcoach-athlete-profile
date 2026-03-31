const mobileNavItems = [
  { icon: "fingerprint", label: "Identity", active: true },
  { icon: "leaderboard", label: "Stats", active: false },
  { icon: "grid_view", label: "Media", active: false },
];

export const MobileNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass-card border-t border-white/10 h-16 flex items-center justify-around px-4">
      {mobileNavItems.map((item) => (
        <button
          key={item.label}
          className={`flex flex-col items-center gap-1 transition-colors duration-200 ${
            item.active ? "text-on-surface" : "text-on-surface-variant"
          }`}
        >
          <span
            className="material-symbols-outlined text-xl"
            style={item.active ? { color: "var(--team-color)" } : undefined}
          >
            {item.icon}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-widest">
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  );
};
