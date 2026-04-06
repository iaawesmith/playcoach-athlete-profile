import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";

interface TierCard {
  tier: "youth" | "high-school" | "college" | "pro";
  label: string;
  icon: string;
  active: boolean;
}

const TIERS: TierCard[] = [
  { tier: "college", label: "COLLEGE", icon: "school", active: true },
  { tier: "high-school", label: "HIGH SCHOOL", icon: "domain", active: false },
  { tier: "youth", label: "YOUTH", icon: "child_care", active: false },
  { tier: "pro", label: "PRO", icon: "emoji_events", active: false },
];

export function AthleteTier() {
  const navigate = useNavigate();
  const { athleteTier, setAthleteTier, setOnboardingStep } = useUserStore();

  const handleSelect = (tier: TierCard) => {
    if (!tier.active) return;
    setAthleteTier(tier.tier);
    setOnboardingStep(2);
    navigate("/onboarding/sport");
  };

  return (
    <div className="space-y-8">
      <h1 className="text-white font-black text-3xl md:text-4xl uppercase tracking-tight text-center">
        Select Your Level
      </h1>

      <div className="grid grid-cols-2 gap-4">
        {TIERS.map((t) => {
          const isSelected = athleteTier === t.tier;
          return (
            <button
              key={t.tier}
              onClick={() => handleSelect(t)}
              disabled={!t.active}
              className="relative flex flex-col items-center gap-3 p-8 rounded-xl transition-all duration-200 active:scale-[0.97]"
              style={{
                backgroundColor: "#2A2E33",
                border: `1px solid ${isSelected ? "#4DC9C9" : "#3D434A"}`,
                boxShadow: isSelected ? "0 0 15px rgba(77, 201, 201, 0.5)" : "none",
                opacity: !t.active ? 0.45 : 1,
                cursor: !t.active ? "not-allowed" : "pointer",
              }}
            >
              {!t.active && (
                <span
                  className="absolute top-3 right-3 text-[9px] font-semibold uppercase tracking-widest rounded-full px-2 py-1"
                  style={{ color: "#8A8F94", border: "1px solid #3D434A" }}
                >
                  Coming Soon
                </span>
              )}
              <span
                className="material-symbols-outlined text-4xl"
                style={{ color: t.active ? "#4DC9C9" : "#8A8F94" }}
              >
                {t.icon}
              </span>
              <span
                className="font-black text-sm uppercase tracking-[0.2em]"
                style={{ color: t.active ? "#4DC9C9" : "#8A8F94" }}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
