import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";

interface SportCard {
  sport: string;
  icon: string;
  active: boolean;
}

const SPORTS: SportCard[] = [
  { sport: "Football", icon: "sports_football", active: true },
  { sport: "Basketball", icon: "sports_basketball", active: false },
  { sport: "Baseball", icon: "sports_baseball", active: false },
  { sport: "Soccer", icon: "sports_soccer", active: false },
  { sport: "Track", icon: "directions_run", active: false },
  { sport: "Other", icon: "more_horiz", active: false },
];

export function SportSelection() {
  const navigate = useNavigate();
  const { sport, setSport, setOnboardingStep } = useUserStore();

  const handleSelect = (s: SportCard) => {
    if (!s.active) return;
    setSport(s.sport);
    setOnboardingStep(3);
    navigate("/onboarding/setup");
  };

  return (
    <div className="space-y-8">
      <h1 className="text-on-surface font-black text-3xl md:text-4xl uppercase tracking-tight text-center">
        Select Your Sport
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {SPORTS.map((s) => {
          const isSelected = sport === s.sport;
          return (
            <button
              key={s.sport}
              onClick={() => handleSelect(s)}
              disabled={!s.active}
              className={`relative flex flex-col items-center gap-3 p-6 rounded-xl border transition-all duration-200 ${
                !s.active
                  ? "opacity-50 cursor-not-allowed border-outline-variant/10 bg-surface-container-high"
                  : isSelected
                  ? "border-[#50C4CA] bg-[rgba(80,196,202,0.08)] cursor-pointer active:scale-95"
                  : "border-outline-variant/10 bg-surface-container-high hover:border-outline-variant/30 cursor-pointer active:scale-95"
              }`}
            >
              {!s.active && (
                <span className="absolute top-2 right-2 text-[9px] font-semibold uppercase tracking-widest text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded-full">
                  Soon
                </span>
              )}
              <span
                className="material-symbols-outlined text-4xl"
                style={{ color: isSelected ? "#50C4CA" : undefined }}
              >
                {s.icon}
              </span>
              <span className="text-on-surface font-black text-xs uppercase tracking-[0.2em]">
                {s.sport}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
