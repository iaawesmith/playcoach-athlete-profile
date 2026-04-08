import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { BuilderLayout } from "./features/builder/BuilderLayout";
import { OnboardingLayout } from "./features/onboarding/OnboardingLayout";
import { RoleSelection } from "./features/onboarding/steps/RoleSelection";
import { AthleteTier } from "./features/onboarding/steps/AthleteTier";
import { SportSelection } from "./features/onboarding/steps/SportSelection";
import { CoreSetup } from "./features/onboarding/steps/CoreSetup";
import { ProfilePreview } from "./features/onboarding/steps/ProfilePreview";
import { AgencySetup } from "./features/onboarding/steps/AgencySetup";
import { AgencyDashboard } from "./pages/AgencyDashboard";
import { CoachDashboard } from "./pages/CoachDashboard";
import { AthleteLab } from "./features/athlete-lab/AthleteLab";
import NotFound from "./pages/NotFound.tsx";
import { useUserStore } from "./store/userStore";

const queryClient = new QueryClient();

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { onboardingComplete } = useUserStore();
  const location = useLocation();
  const path = location.pathname;

  if (!onboardingComplete && (path === "/" || path === "/builder")) {
    return <Navigate to="/onboarding" replace />;
  }

  if (onboardingComplete && path === "/") {
    return <Navigate to="/builder" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <OnboardingGuard>
        <Routes>
          <Route path="/onboarding" element={<OnboardingLayout />}>
            <Route index element={<Navigate to="/onboarding/role" replace />} />
            <Route path="role" element={<RoleSelection />} />
            <Route path="tier" element={<AthleteTier />} />
            <Route path="sport" element={<SportSelection />} />
            <Route path="setup" element={<CoreSetup />} />
            <Route path="preview" element={<ProfilePreview />} />
            <Route path="agency-setup" element={<AgencySetup />} />
          </Route>
          <Route path="/builder" element={<BuilderLayout />} />
          <Route path="/agency-dashboard" element={<AgencyDashboard />} />
          <Route path="/coach-dashboard" element={<CoachDashboard />} />
          <Route path="/athlete-lab" element={<AthleteLab />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </OnboardingGuard>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
