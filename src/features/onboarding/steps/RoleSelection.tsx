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
  { role: "athlete", label: "ATHLETE", icon: "person", description: "Build your identity,\nshowcase your progress" },
  { role: "coach", label: "COACH", icon: "sports", description: "Develop and measure performance of your team", comingSoon: true },
  { role: "trainer", label: "TRAINER", icon: "exercise", description: "Measure performance of\nyour clients", comingSoon: true },
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
              className={`relative flex flex-col items-center justify-center gap-2 w-full min-h-[180px] py-5 px-4 rounded-xl transition-all duration-200 active:scale-[0.97] border ${
                isSelected
                  ? "border-[#4DC9C9] shadow-[0_0_15px_rgba(77,201,201,0.5)]"
                  : isActive
                    ? "border-[#3D434A] hover:border-[#4DC9C9] hover:shadow-[0_0_15px_rgba(77,201,201,0.3)]"
                    : "border-[#3D434A]"
              }`}
              style={{
                backgroundColor: "#2A2E33",
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
                className="material-symbols-outlined text-4xl"
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
              <span className="text-sm font-normal text-center whitespace-pre-line" style={{ color: "#8A8F94" }}>
                {r.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
