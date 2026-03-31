import { TopNav } from "./components/TopNav";
import { SideNav } from "./components/SideNav";
import { ProCard } from "./components/ProCard";
import { IdentityForm } from "./components/IdentityForm";
import { MobileNav } from "./components/MobileNav";

export const BuilderLayout = () => {
  return (
    <div
      className="min-h-screen bg-background"
      style={{ "--team-color": "#00e639" } as React.CSSProperties}
    >
      <TopNav />
      <SideNav />

      {/* Main Content Area */}
      <main className="pt-16 lg:pl-64">
        <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)]">
          {/* Left Column — ProCard Preview */}
          <div className="hidden lg:flex flex-col w-[360px] flex-shrink-0 bg-surface-container-low p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(39,45,50,0.4)_0%,_rgba(11,15,18,0)_70%)]" />
            <ProCard />
          </div>

          {/* Right Column — Editor */}
          <div className="flex-1 p-6 md:p-10 overflow-y-auto">
            <IdentityForm />
          </div>
        </div>
      </main>

      <MobileNav />
    </div>
  );
};
