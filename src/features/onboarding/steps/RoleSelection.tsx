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
  {
    role: "athlete",
    label: "ATHLETE",
    icon: "person",
    description: "Build your identity",
  },
  {
    role: "coach",
    label: "COACH",
    icon: "sports",
    description: "Develop and track athletes",
    comingSoon: true,
  },
  {
    role: "trainer",
    label: "TRAINER",
    icon: "exercise",
    description: "Train and measure performance",
    comingSoon: true,
  },
  {
    role: "agency",
    label: "AGENCY",
    icon: "business_center",
    description: "Manage athletes and partnerships",
    comingSoon: true,
  },
];

export function RoleSelection() {
  const navigate = useNavigate();
  const { role, setRole, setOnboardingStep } = useUserStore();

  const handleSelect = (selected: RoleCard) => {
    if (selected.comingSoon) return;
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
        {ROLES.map((r) => {
          const isAthlete = r.role === "athlete";
          const isSelected = role === r.role;
          return (
            <button
              key={r.role}
              onClick={() => handleSelect(r)}
              disabled={r.comingSoon}
              className={`flex flex-col items-center gap-4 px-16 py-6 rounded-xl border transition-all duration-200 ${
                r.comingSoon
                  ? "opacity-50 cursor-not-allowed border-outline-variant/10 bg-surface-container-high"
                  : isSelected
                    ? "border-[#50C4CA] bg-[rgba(80,196,202,0.08)] cursor-pointer active:scale-95"
                    : isAthlete
                      ? "border-[#50C4CA]/40 bg-[rgba(80,196,202,0.05)] cursor-pointer active:scale-95 hover:border-[#50C4CA]/60"
                      : "border-outline-variant/10 bg-surface-container-high hover:border-outline-variant/30 cursor-pointer active:scale-95"
              }`}
            >
              <span
                className="material-symbols-outlined text-5xl"
                style={{ color: isAthlete || isSelected ? "#50C4CA" : undefined }}
              >
                {r.icon}
              </span>
              <span
                className="font-black text-sm uppercase tracking-[0.2em]"
                style={{ color: isAthlete ? "#50C4CA" : undefined }}
              >
                {r.label}
              </span>
              <span className="text-on-surface-variant text-sm font-normal text-center">
                {r.description}
              </span>
              {r.comingSoon && (
                <span className="px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant text-[9px] font-bold uppercase tracking-widest">
                  Coming Soon
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
