import playcoachLogo from "@/assets/playcoach-logo.png";
import { useAthleteStore } from "@/store/athleteStore";

export const TopNav = () => {
  const firstName = useAthleteStore((s) => s.firstName);
  const lastName = useAthleteStore((s) => s.lastName);
  const hasBeenPublished = useAthleteStore((s) => s.hasBeenPublished);
  const hasUnpublishedChanges = useAthleteStore((s) => s.hasUnpublishedChanges);
  const publishProfile = useAthleteStore((s) => s.publishProfile);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 glass-card border-b border-white/10 flex items-center justify-between px-6">
      {/* Left */}
      <div className="flex items-center">
        <img src={playcoachLogo} alt="PlayCoach" className="h-6 w-auto" />
        <div className="w-px h-5 bg-white/20 mx-4" />
        {firstName || lastName ? (
          <span className="text-on-surface font-bold text-sm tracking-tight">{firstName} {lastName}</span>
        ) : (
          <span className="text-on-surface/40 font-bold text-sm tracking-tight">Your Name</span>
        )}
        <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors duration-200 ml-2">
          <span className="material-symbols-outlined text-on-surface-variant text-lg">link</span>
        </button>

        {(!hasBeenPublished || hasUnpublishedChanges) ? (
          <button
            onClick={publishProfile}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors duration-200"
          >
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: "20px" }}>publish</span>
          </button>
        ) : (
          <div className="w-8 h-8 flex items-center justify-center rounded-full">
            <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#00e639" }}>cell_tower</span>
          </div>
        )}
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
