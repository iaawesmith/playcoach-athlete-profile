import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";

export function AgencySetup() {
  const navigate = useNavigate();
  const { setAgencyType, setOnboardingStep } = useUserStore();

  const handleNext = (type: "nil" | "sports" | "both") => {
    setAgencyType(type);
    setOnboardingStep(4);
    navigate("/onboarding/preview");
  };

  return (
    <div>
      <div>Agency Setup — name, type, logo</div>
      <button onClick={() => handleNext("nil")}>NIL Agency</button>
      <button onClick={() => handleNext("sports")}>Sports Agency</button>
      <button onClick={() => handleNext("both")}>Both</button>
    </div>
  );
}
