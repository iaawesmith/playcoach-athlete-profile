import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";

export function AthleteTier() {
  const navigate = useNavigate();
  const { setAthleteTier, setOnboardingStep } = useUserStore();

  const handleSelect = (tier: "youth" | "high-school" | "college" | "pro") => {
    if (tier !== "college") return;
    setAthleteTier(tier);
    setOnboardingStep(2);
    navigate("/onboarding/sport");
  };

  return (
    <div>
      <div>Tier Selection</div>
      <button disabled>Youth — Coming Soon</button>
      <button disabled>High School — Coming Soon</button>
      <button onClick={() => handleSelect("college")}>College</button>
      <button disabled>Pro — Coming Soon</button>
    </div>
  );
}
