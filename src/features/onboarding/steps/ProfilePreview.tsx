import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";

export function ProfilePreview() {
  const navigate = useNavigate();
  const { role, athleteTier, completeOnboarding } = useUserStore();

  const handleComplete = () => {
    completeOnboarding();

    if (role === "athlete" && athleteTier === "college") {
      navigate("/builder");
    } else if (role === "coach" || role === "trainer") {
      navigate("/coach-dashboard");
    } else {
      navigate("/agency-dashboard");
    }
  };

  return (
    <div>
      <div>Profile Preview — card preview + completion % + 3 next actions</div>
      <button onClick={handleComplete}>Complete Onboarding</button>
    </div>
  );
}
