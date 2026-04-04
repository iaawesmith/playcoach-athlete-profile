import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";
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
  const location = useLocation();
  const navigate = useNavigate();

  const currentStep = STEP_MAP[location.pathname] ?? 1;
  const totalSteps = getTotalSteps(role);
  const progress = (currentStep / totalSteps) * 100;
  const showBack = location.pathname !== "/onboarding/role";

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background texture */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(39,45,50,0.4)_0%,_rgba(11,15,18,0)_70%)] pointer-events-none" />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            {showBack && (
              <button
                onClick={() => navigate(-1)}
                className="mr-2 w-9 h-9 rounded-full flex items-center justify-center bg-surface-container-high hover:bg-surface-container-highest transition-colors duration-200 active:scale-95"
              >
                <span className="material-symbols-outlined text-on-surface text-lg">arrow_back</span>
              </button>
            )}
            <span className="text-on-surface font-black text-lg tracking-tight uppercase">PlayCoach</span>
          </div>

          {/* Step counter */}
          <span className="text-on-surface-variant text-sm font-medium tracking-wide">
            Step {currentStep} of {totalSteps}
          </span>
        </div>

        {/* Progress bar */}
        <div className="px-6">
          <div className="w-full h-1 bg-surface-container-high rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%`, backgroundColor: "#50C4CA" }}
            />
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-2xl bg-surface-container rounded-xl p-8 md:p-12 animate-[fade-in_0.2s_ease-out]">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
