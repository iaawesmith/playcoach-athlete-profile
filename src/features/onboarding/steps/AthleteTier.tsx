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
      <h1 className="text-on-surface font-black text-3xl md:text-4xl uppercase tracking-tight text-center">
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
              className={`relative flex flex-col items-center gap-3 p-8 rounded-xl border transition-all duration-200 ${
                !t.active
                  ? "opacity-50 cursor-not-allowed border-outline-variant/10 bg-surface-container-high"
                  : isSelected
                  ? "border-[#50C4CA] bg-[rgba(80,196,202,0.08)] cursor-pointer active:scale-95"
                  : "border-[#50C4CA]/40 bg-[rgba(80,196,202,0.05)] cursor-pointer active:scale-95 hover:border-[#50C4CA]/60"
              }`}
            >
              {!t.active && (
                <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant bg-surface-container-highest px-2 py-1 rounded-full">
                  Coming Soon
                </span>
              )}
              <span
                className="material-symbols-outlined text-4xl"
                style={{ color: t.active ? "#50C4CA" : undefined }}
              >
                {t.icon}
              </span>
              <span className="text-on-surface font-black text-sm uppercase tracking-[0.2em]">
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
