import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";
import { useAthleteStore } from "@/store/athleteStore";
import { universities, type University } from "@/data/universities";

const POSITIONS = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P", "FB"];
const CLASS_YEARS = ["2025", "2026", "2027", "2028", "2029"];

export function CoreSetup() {
  const navigate = useNavigate();
  const { setOnboardingStep } = useUserStore();
  const { firstName, lastName, school, schoolAbbrev, teamColor, position, classYear, number, height, weight, fortyTime, setAthlete } = useAthleteStore();

  const [query, setQuery] = useState(school);
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = query.length >= 1
    ? universities.filter((u) => u.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectSchool = (uni: University) => {
    setQuery(uni.name);
    setOpen(false);
    setAthlete({
      school: uni.name,
      schoolAbbrev: uni.abbrev,
      teamColor: uni.primaryColor,
    });
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    setFocusIndex(-1);
    setOpen(value.length >= 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && focusIndex >= 0 && filtered[focusIndex]) {
      e.preventDefault();
      handleSelectSchool(filtered[focusIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const canContinue = school && position && classYear && firstName && lastName;

  const handleContinue = () => {
    setOnboardingStep(4);
    navigate("/onboarding/preview");
  };

  const tc = teamColor || "#50C4CA";
  const displayName = firstName || lastName ? `${firstName}\n${lastName}` : null;

  const formatHeight = (val: string) => {
    const total = parseInt(val, 10);
    if (!total) return "--";
    return `${Math.floor(total / 12)}'${total % 12}"`;
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-on-surface font-black text-3xl md:text-4xl uppercase tracking-tight">
          Build Your Foundation
        </h1>
        <p className="text-on-surface-variant text-sm font-normal">
          This powers your card and profile
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: form fields */}
        <div className="space-y-4">
          {/* First Name + Last Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-container-high rounded-xl p-4 border border-outline-variant/10 input-card-focus transition-colors duration-200">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant block mb-2">
                First Name
              </label>
              <input
                className="w-full bg-transparent text-on-surface text-sm font-normal outline-none placeholder:text-on-surface/40"
                value={firstName}
                onChange={(e) => setAthlete({ firstName: e.target.value })}
                placeholder="First"
              />
            </div>
            <div className="bg-surface-container-high rounded-xl p-4 border border-outline-variant/10 input-card-focus transition-colors duration-200">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant block mb-2">
                Last Name
              </label>
              <input
                className="w-full bg-transparent text-on-surface text-sm font-normal outline-none placeholder:text-on-surface/40"
                value={lastName}
                onChange={(e) => setAthlete({ lastName: e.target.value })}
                placeholder="Last"
              />
            </div>
          </div>

          {/* School search */}
          <div ref={wrapperRef} className="relative">
            <div className="bg-surface-container-high rounded-xl p-4 border border-outline-variant/10 input-card-focus transition-colors duration-200">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant block mb-2">
                School
              </label>
              <div className="flex items-center">
                <input
                  className="w-full bg-transparent text-on-surface text-sm font-normal outline-none placeholder:text-on-surface/40"
                  value={query}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onFocus={() => { if (query.length >= 1) setOpen(true); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search schools..."
                />
                <span className="material-symbols-outlined text-on-surface-variant text-base ml-1 shrink-0">search</span>
              </div>
            </div>
            {open && filtered.length > 0 && (
              <ul className="absolute z-50 left-0 right-0 top-full mt-1 max-h-[200px] overflow-y-auto rounded-xl bg-surface-container-high shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                {filtered.map((uni, i) => (
                  <li
                    key={uni.name}
                    onMouseDown={() => handleSelectSchool(uni)}
                    onMouseEnter={() => setFocusIndex(i)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors duration-100 ${
                      i === focusIndex ? "bg-surface-container-highest" : "hover:bg-surface-container-highest/50"
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: uni.primaryColor }} />
                    <span className="text-on-surface text-sm font-normal truncate">{uni.name}</span>
                    <span className="text-on-surface-variant text-[10px] uppercase tracking-widest ml-auto shrink-0">{uni.abbrev}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Position pills */}
          <div className="bg-surface-container-high rounded-xl p-4 border border-outline-variant/10">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant block mb-3">
              Position
            </label>
            <div className="flex flex-wrap gap-2">
              {POSITIONS.map((pos) => (
                <button
                  key={pos}
                  onClick={() => setAthlete({ position: pos })}
                  className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.15em] transition-all duration-200 active:scale-95 ${
                    position === pos
                      ? "text-surface"
                      : "bg-surface-container border border-outline-variant/10 text-on-surface-variant hover:text-on-surface"
                  }`}
                  style={position === pos ? { backgroundColor: tc } : undefined}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {/* Class year */}
          <div className="bg-surface-container-high rounded-xl p-4 border border-outline-variant/10">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant block mb-3">
              Class Year
            </label>
            <div className="flex flex-wrap gap-2">
              {CLASS_YEARS.map((yr) => (
                <button
                  key={yr}
                  onClick={() => setAthlete({ classYear: yr })}
                  className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.15em] transition-all duration-200 active:scale-95 ${
                    classYear === yr
                      ? "text-surface"
                      : "bg-surface-container border border-outline-variant/10 text-on-surface-variant hover:text-on-surface"
                  }`}
                  style={classYear === yr ? { backgroundColor: tc } : undefined}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>

          {/* Jersey number */}
          <div className="bg-surface-container-high rounded-xl p-4 border border-outline-variant/10 input-card-focus transition-colors duration-200">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant block mb-2">
              Jersey Number
            </label>
            <input
              className="w-full bg-transparent text-on-surface text-sm font-normal outline-none placeholder:text-on-surface/40"
              value={number}
              onChange={(e) => setAthlete({ number: e.target.value })}
              placeholder="#"
              maxLength={3}
            />
          </div>
        </div>

        {/* Right: ProCard-style preview */}
        <div className="flex items-start justify-center">
          <div
            className="w-full max-w-[220px] aspect-[3/4] rounded-[12px] overflow-hidden bg-surface-container-high relative"
            style={{ boxShadow: `0 0 60px ${tc}55, 0 0 120px ${tc}22` }}
          >
            {/* School banner */}
            <div
              className="absolute top-0 left-0 right-0 h-7 z-10 flex items-center justify-center"
              style={{ backgroundColor: tc }}
            >
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white/90">
                {school || "Your School"}
              </span>
            </div>

            {/* Photo placeholder */}
            <div className="absolute top-7 bottom-[40%] left-0 right-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant/20 text-5xl">person</span>
            </div>

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-transparent" />

            {/* Bottom info */}
            <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
              {/* Badges */}
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <span
                  className="text-[7px] font-bold uppercase tracking-widest px-2 py-1 rounded-[3px]"
                  style={{ backgroundColor: tc, color: "white" }}
                >
                  {position || "--"}
                </span>
                <span
                  className="text-[7px] font-bold uppercase tracking-widest px-2 py-1 rounded-[3px]"
                  style={{ backgroundColor: tc, color: "white" }}
                >
                  #{number || "--"}
                </span>
                <span className="text-[7px] font-bold uppercase tracking-widest px-2 py-1 rounded-[3px] border border-white/20 text-on-surface-variant">
                  {classYear || "----"}
                </span>
              </div>

              {/* Name */}
              {displayName ? (
                <h3 className="font-black italic uppercase tracking-tighter text-on-surface text-lg leading-[0.9] whitespace-pre-line">
                  {displayName}
                </h3>
              ) : (
                <h3 className="font-black italic uppercase tracking-tighter text-on-surface/40 text-lg leading-[0.9]">
                  Your Name
                </h3>
              )}

              {/* Physicals */}
              <div className="flex gap-3 mt-2 border-t border-white/10 pt-2">
                <div>
                  <span className="text-[7px] uppercase tracking-widest text-on-surface-variant block">Height</span>
                  <span className={`font-black text-sm ${height ? "text-on-surface" : "text-on-surface/40"}`}>
                    {height ? formatHeight(height) : "--"}
                  </span>
                </div>
                <div>
                  <span className="text-[7px] uppercase tracking-widest text-on-surface-variant block">Weight</span>
                  <span className={`font-black text-sm ${weight ? "text-on-surface" : "text-on-surface/40"}`}>
                    {weight ? weight.replace(/\s*lbs?/i, "") : "--"}
                  </span>
                </div>
                <div>
                  <span className="text-[7px] uppercase tracking-widest text-on-surface-variant block">40-YD</span>
                  <span className={`font-black text-sm ${fortyTime ? "text-on-surface" : "text-on-surface/40"}`}>
                    {fortyTime || "--"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Continue */}
      <button
        onClick={handleContinue}
        disabled={!canContinue}
        className="w-full py-3 rounded-full font-black uppercase tracking-[0.2em] text-xs transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ backgroundColor: "#50C4CA", color: "#0b0f12" }}
      >
        Build My Profile →
      </button>
    </div>
  );
}
