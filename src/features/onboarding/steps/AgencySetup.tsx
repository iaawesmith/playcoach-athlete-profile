import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";

type AgencyTypeOption = "nil" | "sports" | "both";

const AGENCY_TYPES: { value: AgencyTypeOption; label: string }[] = [
  { value: "nil", label: "NIL" },
  { value: "sports", label: "Sports" },
  { value: "both", label: "Both" },
];

export function AgencySetup() {
  const navigate = useNavigate();
  const { agencyType, setAgencyType, setOnboardingStep } = useUserStore();
  const [agencyName, setAgencyName] = useState("");

  const handleNext = () => {
    setOnboardingStep(4);
    navigate("/onboarding/preview");
  };

  return (
    <div className="space-y-8">
      <h1 className="text-on-surface font-black text-3xl md:text-4xl uppercase tracking-tight text-center">
        Set Up Your Agency
      </h1>

      {/* Agency Name */}
      <div className="bg-surface-container-high rounded-xl p-4 border border-outline-variant/10 input-card-focus transition-colors duration-200">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant block mb-2">
          Agency Name
        </label>
        <input
          className="w-full bg-transparent text-on-surface text-sm font-normal outline-none placeholder:text-on-surface/40"
          value={agencyName}
          onChange={(e) => setAgencyName(e.target.value)}
          placeholder="Enter agency name"
        />
      </div>

      {/* Agency Type */}
      <div className="bg-surface-container-high rounded-xl p-4 border border-outline-variant/10">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant block mb-3">
          Agency Type
        </label>
        <div className="flex gap-2">
          {AGENCY_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setAgencyType(t.value)}
              className={`flex-1 py-2.5 rounded-full text-xs font-black uppercase tracking-[0.15em] transition-all duration-200 active:scale-95 ${
                agencyType === t.value
                  ? "text-surface"
                  : "bg-surface-container border border-outline-variant/10 text-on-surface-variant hover:text-on-surface"
              }`}
              style={agencyType === t.value ? { backgroundColor: "#50C4CA" } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logo upload placeholder */}
      <div className="bg-surface-container-high rounded-xl p-6 border border-outline-variant/10 flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-xl bg-surface-container-lowest border border-outline-variant/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-on-surface-variant text-3xl">add_a_photo</span>
        </div>
        <span className="text-on-surface-variant text-xs font-medium uppercase tracking-widest">Upload Logo</span>
      </div>

      {/* Continue */}
      <button
        onClick={handleNext}
        disabled={!agencyName || !agencyType}
        className="w-full py-3 rounded-full font-black uppercase tracking-[0.2em] text-xs transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ backgroundColor: "#50C4CA", color: "#0b0f12" }}
      >
        Continue →
      </button>
    </div>
  );
}
