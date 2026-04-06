import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";
import { useAthleteStore } from "@/store/athleteStore";
import { useSchoolSearch, type SchoolOption } from "@/hooks/useSchoolSearch";

const POSITIONS = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P", "FB"];
const CLASS_OPTIONS = ["Freshman", "Sophomore", "Junior", "Senior"];

const cardStyle: React.CSSProperties = {
  backgroundColor: "#2A2E33",
  border: "1px solid #3D434A",
};

const labelClass = "text-[10px] font-semibold uppercase tracking-widest block mb-2";
const labelColor: React.CSSProperties = { color: "#8A8F94" };
const inputClass = "w-full bg-transparent text-white text-sm font-normal outline-none placeholder:text-white/30";

export function CoreSetup() {
  const navigate = useNavigate();
  const { setOnboardingStep } = useUserStore();
  const { firstName, lastName, school, position, classYear, number, teamColor, schoolLogoUrl, setAthlete } = useAthleteStore();

  const [query, setQuery] = useState(school);
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { results: filtered } = useSchoolSearch(open ? query : "");

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectSchool = (opt: SchoolOption) => {
    setQuery(opt.displayName);
    setOpen(false);
    setAthlete({ school: opt.displayName, schoolAbbrev: opt.abbrev, teamColor: opt.primaryColor, schoolLogoUrl: opt.logoUrl });
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    setFocusIndex(-1);
    setOpen(value.length >= 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusIndex((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && focusIndex >= 0 && filtered[focusIndex]) { e.preventDefault(); handleSelectSchool(filtered[focusIndex]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  const canContinue = school && position && classYear && firstName && lastName;
  const handleContinue = () => { setOnboardingStep(4); navigate("/onboarding/preview"); };
  const tc = teamColor || "#4DC9C9";

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-white font-black text-3xl md:text-4xl uppercase tracking-tight">
          Build Your Foundation
        </h1>
        <p className="text-sm font-normal" style={{ color: "#8A8F94" }}>
          This powers your card and profile
        </p>
      </div>

      <div className="space-y-4">
        {/* First Name + Last Name */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-4" style={cardStyle}>
            <label className={labelClass} style={labelColor}>First Name</label>
            <input className={inputClass} value={firstName} onChange={(e) => setAthlete({ firstName: e.target.value })} placeholder="First" />
          </div>
          <div className="rounded-xl p-4" style={cardStyle}>
            <label className={labelClass} style={labelColor}>Last Name</label>
            <input className={inputClass} value={lastName} onChange={(e) => setAthlete({ lastName: e.target.value })} placeholder="Last" />
          </div>
        </div>

        {/* School + School Logo */}
        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <div ref={wrapperRef} className="relative">
            <div className="rounded-xl p-4" style={cardStyle}>
              <label className={labelClass} style={labelColor}>School</label>
              <div className="flex items-center">
                <input
                  className={inputClass}
                  value={query}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onFocus={() => { if (query.length >= 1) setOpen(true); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search schools..."
                />
                <span className="material-symbols-outlined text-base ml-1 shrink-0" style={{ color: "#8A8F94" }}>search</span>
              </div>
            </div>
            {open && filtered.length > 0 && (
              <ul className="absolute z-50 left-0 right-0 top-full mt-1 max-h-[200px] overflow-y-auto rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.6)]" style={{ backgroundColor: "#2A2E33", border: "1px solid #3D434A" }}>
                {filtered.map((opt, i) => (
                  <li
                    key={opt.name}
                    onMouseDown={() => handleSelectSchool(opt)}
                    onMouseEnter={() => setFocusIndex(i)}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors duration-100"
                    style={{ backgroundColor: i === focusIndex ? "#363B40" : undefined }}
                  >
                    {opt.logoUrl ? (
                      <img src={opt.logoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />
                    ) : (
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: opt.primaryColor }} />
                    )}
                    <span className="text-white text-sm font-normal truncate">{opt.displayName}</span>
                    <span className="text-[10px] uppercase tracking-widest ml-auto shrink-0" style={{ color: "#8A8F94" }}>{opt.abbrev}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl p-4" style={cardStyle}>
            <label className={labelClass} style={labelColor}>School Logo</label>
            {schoolLogoUrl ? (
              <div className="flex items-center h-[20px]">
                <img src={schoolLogoUrl} alt="School logo" className="h-5 w-5 object-contain" />
              </div>
            ) : (
              <span className={`${inputClass} text-white/30`}>Autopopulates</span>
            )}
          </div>
        </div>

        {/* Position pills */}
        <div className="rounded-xl p-4" style={cardStyle}>
          <label className={labelClass} style={labelColor}>Position</label>
          <div className="flex flex-wrap gap-2">
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                onClick={() => setAthlete({ position: pos })}
                className="px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.15em] transition-all duration-200 active:scale-95"
                style={
                  position === pos
                    ? { backgroundColor: tc, color: "#fff", boxShadow: `0 0 10px ${tc}40` }
                    : { backgroundColor: "#1E2227", border: "1px solid #3D434A", color: "#8A8F94" }
                }
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Class */}
        <div className="rounded-xl p-4" style={cardStyle}>
          <label className={labelClass} style={labelColor}>Class</label>
          <div className="flex flex-wrap gap-2">
            {CLASS_OPTIONS.map((yr) => (
              <button
                key={yr}
                onClick={() => setAthlete({ classYear: yr })}
                className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.15em] transition-all duration-200 active:scale-95"
                style={
                  classYear === yr
                    ? { backgroundColor: tc, color: "#fff", boxShadow: `0 0 10px ${tc}40` }
                    : { backgroundColor: "#1E2227", border: "1px solid #3D434A", color: "#8A8F94" }
                }
              >
                {yr}
              </button>
            ))}
          </div>
        </div>

        {/* Jersey number */}
        <div className="rounded-xl p-4" style={cardStyle}>
          <label className={labelClass} style={labelColor}>Jersey Number</label>
          <input className={inputClass} value={number} onChange={(e) => setAthlete({ number: e.target.value })} placeholder="#" maxLength={3} />
        </div>
      </div>

      {/* Continue */}
      <button
        onClick={handleContinue}
        disabled={!canContinue}
        className="w-full py-3 rounded-full font-black uppercase tracking-[0.2em] text-xs transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ backgroundColor: "#4DC9C9", color: "#12161A", boxShadow: "0 0 20px rgba(77, 201, 201, 0.3)" }}
      >
        Build My Profile →
      </button>
    </div>
  );
}
