import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";

interface RoleCard {
  role: "athlete" | "coach" | "trainer" | "agency" | "brand";
  label: string;
  icon: string;
  description: string;
  displayRole: string;
}

const ROLES: RoleCard[] = [
  {
    role: "athlete",
    label: "ATHLETE",
    icon: "person",
    description: "Build your identity",
    displayRole: "athlete",
  },
  {
    role: "coach",
    label: "COACH / TRAINER",
    icon: "sports",
    description: "Develop and track athletes",
    displayRole: "coach",
  },
  {
    role: "agency",
    label: "AGENCY / BRAND",
    icon: "business_center",
    description: "Manage athletes and partnerships",
    displayRole: "agency",
  },
];

export function RoleSelection() {
  const navigate = useNavigate();
  const { role, setRole, setOnboardingStep } = useUserStore();

  const handleSelect = (selected: RoleCard) => {
    setRole(selected.role);
    setOnboardingStep(1);

    if (selected.role === "athlete") {
      navigate("/onboarding/tier");
    } else if (selected.role === "coach" || selected.role === "trainer") {
      navigate("/onboarding/sport");
    } else {
      navigate("/onboarding/agency-setup");
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-on-surface font-black text-3xl md:text-4xl uppercase tracking-tight text-center">
        I Am A...
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ROLES.map((r) => {
          const isSelected = role === r.role;
          return (
            <button
              key={r.role}
              onClick={() => handleSelect(r)}
              className={`flex flex-col items-center gap-4 p-8 rounded-xl border transition-all duration-200 cursor-pointer active:scale-95 ${
                isSelected
                  ? "border-[#50C4CA] bg-[rgba(80,196,202,0.08)]"
                  : "border-outline-variant/10 bg-surface-container-high hover:border-outline-variant/30"
              }`}
            >
              <span
                className="material-symbols-outlined text-5xl"
                style={{ color: isSelected ? "#50C4CA" : undefined }}
              >
                {r.icon}
              </span>
              <span className="text-on-surface font-black text-sm uppercase tracking-[0.2em]">
                {r.label}
              </span>
              <span className="text-on-surface-variant text-sm font-normal text-center">
                {r.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
