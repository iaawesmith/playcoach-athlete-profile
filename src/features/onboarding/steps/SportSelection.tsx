import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";

export function SportSelection() {
  const navigate = useNavigate();
  const { setSport, setOnboardingStep } = useUserStore();

  const handleSelect = (sport: string) => {
    if (sport !== "Football") return;
    setSport(sport);
    setOnboardingStep(3);
    navigate("/onboarding/setup");
  };

  return (
    <div>
      <div>Sport Selection</div>
      <button onClick={() => handleSelect("Football")}>Football</button>
      <button disabled>Basketball — Coming Soon</button>
      <button disabled>Baseball — Coming Soon</button>
      <button disabled>Soccer — Coming Soon</button>
    </div>
  );
}
