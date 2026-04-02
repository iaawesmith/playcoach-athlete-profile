import { TopNav } from "./components/TopNav";
import { SideNav } from "./components/SideNav";
import { ProCard } from "./components/ProCard";
import { IdentityForm } from "./components/IdentityForm";
import { MobileNav } from "./components/MobileNav";
import { useAthleteStore } from "@/store/athleteStore";

const statusIndicator = (profileStatus: "draft" | "live") => {
  const isDraft = profileStatus === "draft";
  return (
    <div className="flex items-center gap-1.5">
      {isDraft ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">
            Draft
          </span>
        </>
      ) : (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">
            Live
          </span>
        </>
      )}
    </div>
  );
};

const sectionLabels: Record<string, string> = {
  identity: "Identity Preview",
  performance: "Performance Preview",
  develop: "Develop Preview",
  pulse: "Pulse Preview",
  connect: "Connect Preview",
};

const sectionIcons: Record<string, string> = {
  performance: "sports_score",
  develop: "trending_up",
  pulse: "monitoring",
  connect: "handshake",
};

export const BuilderLayout = () => {
  const teamColor = useAthleteStore((s) => s.teamColor);
  const activeSection = useAthleteStore((s) => s.activeSection);
  const profileStatus = useAthleteStore((s) => s.profileStatus);

  return (
    <div
      className="min-h-screen bg-background"
      style={{ "--team-color": teamColor } as React.CSSProperties}
    >
      <TopNav />
      <SideNav />

      {/* Main Content Area */}
      <main className="pt-16 lg:pl-64">
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-4rem)]">
          {/* Left Column — Preview */}
          <div className="hidden lg:flex flex-col lg:col-span-5 relative bg-surface-container-low p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(39,45,50,0.4)_0%,_rgba(11,15,18,0)_70%)]" />
            <div className="relative z-10 w-full max-w-sm mx-auto mb-6">
              <span className="text-base font-bold uppercase tracking-widest text-on-surface-variant">
                {sectionLabels[activeSection]}
              </span>
              <div className="mt-1.5">
                {statusIndicator(profileStatus)}
              </div>
            </div>
            {activeSection === "identity" ? (
              <ProCard />
            ) : (
              <div className="relative z-10 flex-1 flex flex-col items-center justify-center rounded-xl bg-surface-container border border-white/5">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4">
                  {sectionIcons[activeSection]}
                </span>
                <span className="text-on-surface-variant text-sm font-medium uppercase tracking-widest">
                  {sectionLabels[activeSection]?.replace(" Preview", "")} Preview
                </span>
                <span className="text-on-surface-variant/50 text-xs uppercase tracking-widest mt-1">
                  Coming Soon
                </span>
              </div>
            )}
          </div>

          {/* Right Column — Editor */}
          <div className="lg:col-span-7 p-6 md:p-10 overflow-y-auto">
            <IdentityForm />
          </div>
        </div>
      </main>

      <MobileNav />
    </div>
  );
};
