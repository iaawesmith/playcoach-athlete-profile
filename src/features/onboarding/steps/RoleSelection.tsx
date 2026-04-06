import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";

interface RoleCard {
  role: "athlete" | "coach" | "trainer" | "agency" | "brand";
  label: string;
  icon: string;
  description: string;
  comingSoon?: boolean;
}

const ROLES: RoleCard[] = [
  { role: "athlete", label: "ATHLETE", icon: "person", description: "Build your identity" },
  { role: "coach", label: "COACH", icon: "sports", description: "Develop and track athletes", comingSoon: true },
  { role: "trainer", label: "TRAINER", icon: "exercise", description: "Train and measure performance", comingSoon: true },
  { role: "agency", label: "AGENCY", icon: "business_center", description: "Manage athletes and partnerships", comingSoon: true },
];

export function RoleSelection() {
  const navigate = useNavigate();
  const { role, setRole, setOnboardingStep } = useUserStore();

  const handleSelect = (selected: RoleCard) => {
    if (selected.comingSoon) return;
    setRole(selected.role);
    setOnboardingStep(1);
    if (selected.role === "athlete") navigate("/onboarding/tier");
    else if (selected.role === "coach" || selected.role === "trainer") navigate("/onboarding/sport");
    else navigate("/onboarding/agency-setup");
  };

  return (
    <div className="space-y-8">
      <h1 className="text-white font-black text-3xl md:text-4xl uppercase tracking-tight text-center">
        I Am A...
      </h1>

      <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
        {ROLES.map((r) => {
          const isSelected = role === r.role;
          const isActive = !r.comingSoon;
          return (
            <button
              key={r.role}
              onClick={() => handleSelect(r)}
              disabled={r.comingSoon}
              className="relative grid grid-rows-[48px_24px_32px_1fr] items-center justify-items-center w-full min-h-[180px] py-5 px-4 rounded-xl transition-all duration-200 active:scale-[0.97]"
              style={{
                backgroundColor: "#2A2E33",
                border: `1px solid ${isSelected ? "#4DC9C9" : "#3D434A"}`,
                boxShadow: isSelected ? "0 0 15px rgba(77, 201, 201, 0.5)" : "none",
                opacity: r.comingSoon ? 0.45 : 1,
                cursor: r.comingSoon ? "not-allowed" : "pointer",
              }}
            >
              {r.comingSoon && (
                <span
                  className="absolute top-3 right-3 text-[9px] font-semibold uppercase tracking-widest rounded-full px-2.5 py-1"
                  style={{ color: "#8A8F94", border: "1px solid #3D434A" }}
                >
                  Coming Soon
                </span>
              )}
              <span
                className="material-symbols-outlined text-5xl"
                style={{ color: isActive ? "#4DC9C9" : "#8A8F94" }}
              >
                {r.icon}
              </span>
              <span
                className="font-black text-sm uppercase tracking-[0.2em]"
                style={{ color: isActive ? "#4DC9C9" : "#8A8F94" }}
              >
                {r.label}
              </span>
              <span className="text-sm font-normal text-center self-start" style={{ color: "#8A8F94" }}>
                {r.description}
              </span>
              {r.comingSoon ? (
                <span className="invisible text-[9px] self-end justify-self-center">.</span>
              ) : (
                <span className="invisible text-[9px] self-end justify-self-center">.</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
