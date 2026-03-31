import playcoachLogo from "@/assets/playcoach-logo.png";

const TopNav = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 glass-card border-b border-border flex items-center px-4">
      <div className="flex items-center gap-2">
        <img
          src={playcoachLogo}
          alt="PlayCoach"
          className="h-6 w-auto"
        />
      </div>
    </nav>
  );
};

export default TopNav;
