import { TopNav } from "./components/TopNav";
import { SideNav } from "./components/SideNav";
import { ProCard } from "./components/ProCard";
import { IdentityForm } from "./components/IdentityForm";
import { IdentityPreview } from "./components/IdentityPreview";
import { PulseForm } from "./components/PulseForm";
import { MobileNav } from "./components/MobileNav";
import { useAthleteStore } from "@/store/athleteStore";

const sectionLabels: Record<string, string> = {
  identity: "Identity Live Preview",
  performance: "Performance Live Preview",
  develop: "Develop Live Preview",
  pulse: "Pulse Live Preview",
  connect: "Connect Live Preview",
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
  const hasBeenPublished = useAthleteStore((s) => s.hasBeenPublished);
  const hasUnpublishedChanges = useAthleteStore((s) => s.hasUnpublishedChanges);

  return (
    <div
      className="min-h-screen bg-background"
      style={{ "--team-color": teamColor } as React.CSSProperties}
    >
      <TopNav />
      <SideNav />

      {/* Main Content Area */}
      <main className="pt-16 lg:pl-64">
        <div className="grid grid-cols-1 lg:grid-cols-12 h-[calc(100vh-4rem)]">
          {/* Left Column — Preview */}
          <div className="hidden lg:flex flex-col lg:col-span-5 relative bg-surface-container-low overflow-hidden">
            {/* Sticky Preview Header Bar */}
            <div className="h-14 px-5 py-3 border-b border-white/10 shrink-0 flex items-center z-10" style={{ backgroundColor: "var(--team-color)" }}>
              <div className="flex flex-col justify-center min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#FFFFFF" }}>visibility</span>
                  <span className="text-white font-bold uppercase text-xs tracking-widest">{sectionLabels[activeSection]}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {hasBeenPublished && !hasUnpublishedChanges ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span className="text-[0.65rem] italic text-white">Live</span>
                    </>
                  ) : (
                    <>
                       <span className="text-[0.65rem] italic text-white">Publish changes via the icon above</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable Preview Content */}
            <div className="flex-1 overflow-y-auto relative">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(39,45,50,0.4)_0%,_rgba(11,15,18,0)_70%)] z-0" />
            <div className="relative z-10 px-8 pb-8 pt-6">
              {activeSection === "identity" ? (
                <>
                  <ProCard />
                  <IdentityPreview />
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center rounded-xl bg-surface-container border border-white/5 min-h-[400px]">
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
            </div>
          </div>

          {/* Right Column — Editor */}
          <div className="lg:col-span-7 flex flex-col overflow-hidden">
            {/* Sticky Editor Header */}
            <div className="h-14 px-5 py-3 bg-surface-container-high border-b border-white/10 shrink-0 flex flex-col justify-center">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#FFFFFF" }}>edit</span>
                <span className="text-on-surface font-bold uppercase tracking-widest text-xs">
                  Editing {activeSection === "identity" ? "Identity" : activeSection === "performance" ? "Performance" : activeSection === "develop" ? "Develop" : activeSection === "pulse" ? "Pulse" : "Connect"}
                </span>
              </div>
              <p className="text-on-surface-variant text-[0.65rem] italic mt-0.5">
                Changes reflect instantly in preview
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-6 md:p-10">
              {activeSection === "pulse" ? <PulseForm /> : <IdentityForm />}
            </div>
          </div>
        </div>
      </main>

      <MobileNav />
    </div>
  );
};
