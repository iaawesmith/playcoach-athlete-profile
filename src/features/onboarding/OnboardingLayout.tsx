import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";
import { useAthleteStore } from "@/store/athleteStore";
import playcoachLogo from "@/assets/playcoach-logo.png";

const STEP_MAP: Record<string, number> = {
  "/onboarding/role": 1,
  "/onboarding/tier": 2,
  "/onboarding/sport": 3,
  "/onboarding/setup": 4,
  "/onboarding/preview": 5,
  "/onboarding/agency-setup": 3,
};

function getTotalSteps(role: string | null): number {
  if (role === "agency" || role === "brand") return 4;
  if (role === "coach" || role === "trainer") return 4;
  return 5;
}

export function OnboardingLayout() {
  const { role } = useUserStore();
  const { teamColor } = useAthleteStore();
  const location = useLocation();
  const navigate = useNavigate();

  const currentStep = STEP_MAP[location.pathname] ?? 1;
  const totalSteps = getTotalSteps(role);
  const progress = (currentStep / totalSteps) * 100;
  const showBack = location.pathname !== "/onboarding/role";

  return (
    <div
      className="min-h-screen relative"
      style={{
        "--team-color": teamColor,
        background: "linear-gradient(180deg, #12161A 0%, #0D1014 100%)",
      } as React.CSSProperties}
    >
      {/* Subtle radial depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,_#1E242B_0%,_transparent_60%)] pointer-events-none" />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            {showBack && (
              <button
                onClick={() => navigate(-1)}
                className="mr-2 w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-200 active:scale-95"
                style={{ backgroundColor: "#2A2E33", border: "1px solid #3D434A" }}
              >
                <span className="material-symbols-outlined text-white/80 text-lg">arrow_back</span>
              </button>
            )}
            <img src={playcoachLogo} alt="PlayCoach" className="h-5 w-auto" />
          </div>

          <span className="text-white/50 text-sm font-medium tracking-wide">
            Step {currentStep} of {totalSteps}
          </span>
        </div>

        {/* Progress bar */}
        <div className="px-6">
          <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: "#1E242B" }}>
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                backgroundColor: "#4DC9C9",
                boxShadow: "0 0 12px rgba(77, 201, 201, 0.5)",
              }}
            />
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div
            className="w-full max-w-2xl rounded-xl p-8 md:p-12 animate-[fade-in_0.2s_ease-out]"
            style={{ backgroundColor: "#1A1E23", border: "1px solid #2A2E33" }}
          >
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
