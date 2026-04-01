import playcoachLogo from "@/assets/playcoach-logo.png";
import { useAthleteStore } from "@/store/athleteStore";

export const TopNav = () => {
  const { firstName, lastName } = useAthleteStore();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 glass-card border-b border-white/10 flex items-center justify-between px-6">
      {/* Left */}
      <div className="flex items-center">
        <img src={playcoachLogo} alt="PlayCoach" className="h-6 w-auto" />
        <div className="w-px h-5 bg-white/20 mx-4" />
        <span className="text-on-surface font-bold text-sm tracking-tight">{firstName} {lastName}</span>
        <span className="text-sm font-black tracking-widest uppercase ml-2" style={{ color: 'var(--team-color)' }}>Brand HQ</span>
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
