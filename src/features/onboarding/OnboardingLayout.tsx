import { Outlet } from "react-router-dom";
import { useUserStore } from "@/store/userStore";

export function OnboardingLayout() {
  const { onboardingStep } = useUserStore();

  return (
    <div>
      <div>Onboarding — Step {onboardingStep}</div>
      <Outlet />
    </div>
  );
}
