import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";

export function RoleSelection() {
  const navigate = useNavigate();
  const { setRole, setOnboardingStep } = useUserStore();

  const handleSelect = (role: "athlete" | "coach" | "trainer" | "agency" | "brand") => {
    setRole(role);
    setOnboardingStep(1);

    if (role === "athlete") {
      navigate("/onboarding/tier");
    } else if (role === "coach" || role === "trainer") {
      navigate("/onboarding/sport");
    } else {
      navigate("/onboarding/agency-setup");
    }
  };

  return (
    <div>
      <div>Role Selection</div>
      <button onClick={() => handleSelect("athlete")}>Athlete</button>
      <button onClick={() => handleSelect("coach")}>Coach / Trainer</button>
      <button onClick={() => handleSelect("agency")}>Agency / Brand</button>
    </div>
  );
}
