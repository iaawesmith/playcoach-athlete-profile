import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";

type AgencyTypeOption = "nil" | "sports" | "both";

const AGENCY_TYPES: { value: AgencyTypeOption; label: string }[] = [
  { value: "nil", label: "NIL" },
  { value: "sports", label: "Sports" },
  { value: "both", label: "Both" },
];

const cardStyle: React.CSSProperties = { backgroundColor: "#2A2E33", border: "1px solid #3D434A" };
const labelClass = "text-[10px] font-semibold uppercase tracking-widest block mb-2";
const labelColor: React.CSSProperties = { color: "#8A8F94" };

export function AgencySetup() {
  const navigate = useNavigate();
  const { agencyType, setAgencyType, setOnboardingStep } = useUserStore();
  const [agencyName, setAgencyName] = useState("");

  const handleNext = () => { setOnboardingStep(4); navigate("/onboarding/preview"); };

  return (
    <div className="space-y-8">
      <h1 className="text-white font-black text-3xl md:text-4xl uppercase tracking-tight text-center">
        Set Up Your Agency
      </h1>

      {/* Agency Name */}
      <div className="rounded-xl p-4" style={cardStyle}>
        <label className={labelClass} style={labelColor}>Agency Name</label>
        <input
          className="w-full bg-transparent text-white text-sm font-normal outline-none placeholder:text-white/30"
          value={agencyName}
          onChange={(e) => setAgencyName(e.target.value)}
          placeholder="Enter agency name"
        />
      </div>

      {/* Agency Type */}
      <div className="rounded-xl p-4" style={cardStyle}>
        <label className={labelClass} style={{ ...labelColor, marginBottom: "12px" }}>Agency Type</label>
        <div className="flex gap-2">
          {AGENCY_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setAgencyType(t.value)}
              className="flex-1 py-2.5 rounded-full text-xs font-black uppercase tracking-[0.15em] transition-all duration-200 active:scale-95"
              style={
                agencyType === t.value
                  ? { backgroundColor: "#4DC9C9", color: "#12161A" }
                  : { backgroundColor: "#1E2227", border: "1px solid #3D434A", color: "#8A8F94" }
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logo upload placeholder */}
      <div className="rounded-xl p-6 flex flex-col items-center gap-3" style={cardStyle}>
        <div className="w-20 h-20 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#1E2227", border: "1px solid #3D434A" }}>
          <span className="material-symbols-outlined text-3xl" style={{ color: "#8A8F94" }}>add_a_photo</span>
        </div>
        <span className="text-xs font-medium uppercase tracking-widest" style={{ color: "#8A8F94" }}>Upload Logo</span>
      </div>

      {/* Continue */}
      <button
        onClick={handleNext}
        disabled={!agencyName || !agencyType}
        className="w-full py-3 rounded-full font-black uppercase tracking-[0.2em] text-xs transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ backgroundColor: "#4DC9C9", color: "#12161A", boxShadow: "0 0 20px rgba(77, 201, 201, 0.3)" }}
      >
        Continue →
      </button>
    </div>
  );
}
