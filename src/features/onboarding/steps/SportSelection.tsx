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
      <h1 className="text-white font-black text-3xl md:text-4xl uppercase tracking-tight text-center">
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
              className="relative flex flex-col items-center gap-3 p-6 rounded-xl transition-all duration-200 active:scale-[0.97]"
              style={{
                backgroundColor: "#2A2E33",
                border: `1px solid ${isSelected ? "#4DC9C9" : "#3D434A"}`,
                boxShadow: isSelected ? "0 0 15px rgba(77, 201, 201, 0.5)" : "none",
                opacity: !s.active ? 0.45 : 1,
                cursor: !s.active ? "not-allowed" : "pointer",
              }}
            >
              {!s.active && (
                <span
                  className="absolute top-2 right-2 text-[9px] font-semibold uppercase tracking-widest rounded-full px-2 py-0.5"
                  style={{ color: "#8A8F94", border: "1px solid #3D434A" }}
                >
                  Soon
                </span>
              )}
              <span
                className="material-symbols-outlined text-4xl"
                style={{ color: s.active ? "#4DC9C9" : "#8A8F94" }}
              >
                {s.icon}
              </span>
              <span
                className="font-black text-xs uppercase tracking-[0.2em]"
                style={{ color: s.active ? "#4DC9C9" : "#8A8F94" }}
              >
                {s.sport}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
