import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";

export function CoreSetup() {
  const navigate = useNavigate();
  const { role, athleteTier, setOnboardingStep } = useUserStore();

  const handleNext = () => {
    setOnboardingStep(4);
    navigate("/onboarding/preview");
  };

  return (
    <div>
      <div>Core Setup — fields vary by role ({role}) + tier ({athleteTier})</div>
      <button onClick={handleNext}>Next</button>
    </div>
  );
}
