import { useRef, useState, useEffect, useCallback } from "react";
import { useAthleteStore } from "@/store/athleteStore";
import { useSchoolSearch, type SchoolOption } from "@/hooks/useSchoolSearch";
import { firecrawlApi } from "@/services/firecrawl";
import { supabase } from "@/integrations/supabase/client";

/* ─── Shared sub-components ─────────────────────────────────── */

const commitmentOptions = [
  { value: "", label: "Select..." },
  { value: "committed", label: "Committed" },
  { value: "uncommitted", label: "Uncommitted" },
  { value: "portal", label: "Transfer Portal" },
];

const GroupHeader = ({ title }: { title: string }) => (
  <div className="flex items-center gap-3 mb-8 mt-2">
    <h2 className="text-on-surface font-black uppercase text-base tracking-[0.2em]">
      {title}
    </h2>
    <span className="flex-1 h-[1px] bg-outline-variant/20" />
  </div>
);

const SectionHeader = ({ title }: { title: string }) => (
  <div className="flex items-center gap-3 mb-6">
    <span className="w-8 h-[1px]" style={{ backgroundColor: "var(--team-color)" }} />
    <h3 className="text-on-surface font-extrabold uppercase text-sm tracking-wide">{title}</h3>
  </div>
);

const SourceBadge = ({ source }: { source: "CFBD" | "247" | "ON3" }) => (
  <span className="absolute top-2.5 right-3 text-[8px] font-bold uppercase tracking-widest text-on-surface-variant/40 select-none">
    {source}
  </span>
);

const LockIcon = () => (
  <span className="absolute top-2.5 right-3 material-symbols-outlined text-on-surface-variant/30 text-sm select-none">
    lock
  </span>
);

/* ─── Locked read-only display field ───────────────────────── */

const LockedField = ({ label, value, placeholder = "—" }: { label: string; value: string; placeholder?: string }) => (
  <div className="bg-surface-container rounded-xl p-4 relative">
    <LockIcon />
    <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">{label}</label>
    <span className={`text-sm font-normal ${value ? "text-on-surface" : "text-on-surface-variant/30"}`}>
      {value || placeholder}
    </span>
  </div>
);

/* ─── Editable input card with optional source badge ───────── */

const InputCard = ({
  label, value, type = "text", onChange, suffix, helperText, placeholder, badge,
}: {
  label: string; value: string; type?: string; onChange: (val: string) => void;
  suffix?: string; helperText?: string; placeholder?: string;
  badge?: "CFBD" | "247" | "ON3";
}) => (
  <div className="bg-surface-container rounded-xl p-4 transition-colors duration-200 input-card-focus relative">
    {badge && <SourceBadge source={badge} />}
    <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">{label}</label>
    {type === "textarea" ? (
      <>
        <textarea
          className="w-full bg-transparent text-on-surface text-sm font-normal resize-none outline-none min-h-[80px] placeholder:text-on-surface/40"
          value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        />
        {helperText && <p className="text-[10px] text-on-surface-variant/50 mt-1">{helperText}</p>}
      </>
    ) : (
      <div className="flex items-center">
        <input
          className="w-full bg-transparent text-on-surface text-sm font-normal outline-none placeholder:text-on-surface/40"
          value={value} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder}
        />
        {suffix && <span className="text-on-surface-variant text-sm font-normal ml-1 shrink-0">{suffix}</span>}
      </div>
    )}
  </div>
);

const NumericInputCard = ({
  label, value, onChange, suffix, placeholder, badge,
}: {
  label: string; value: string; onChange: (val: string) => void; suffix: string;
  placeholder?: string; badge?: "CFBD" | "247" | "ON3";
}) => {
  const isEmpty = !value;
  return (
    <div className="bg-surface-container rounded-xl p-4 transition-colors duration-200 input-card-focus cursor-text relative">
      {badge && <SourceBadge source={badge} />}
      <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">{label}</label>
      <div className={`flex items-center ${isEmpty ? "border-b border-dashed border-outline-variant/30" : ""} pb-0.5`}>
        <input
          className="bg-transparent text-on-surface text-sm font-normal outline-none placeholder:text-on-surface/40"
          style={{ width: `${Math.max((value || placeholder || "").length, 1) * 0.6 + 0.4}em` }}
          value={value}
          onChange={(e) => { onChange(e.target.value.replace(/[^\d.]/g, "")); }}
          inputMode="decimal" placeholder={placeholder}
        />
        <span className="text-on-surface-variant text-sm font-normal shrink-0">{suffix}</span>
      </div>
    </div>
  );
};

const HeightInputCard = ({ value, onChange, badge }: { value: string; onChange: (val: string) => void; badge?: "CFBD" | "247" | "ON3" }) => {
  const totalInches = parseInt(value, 10) || 0;
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  const handleFeetChange = (v: string) => { const f = parseInt(v.replace(/\D/g, ""), 10) || 0; onChange(String(f * 12 + inches)); };
  const handleInchesChange = (v: string) => { const i = Math.min(parseInt(v.replace(/\D/g, ""), 10) || 0, 11); onChange(String(feet * 12 + i)); };
  const isEmpty = totalInches === 0;

  return (
    <div className="bg-surface-container rounded-xl p-4 transition-colors duration-200 input-card-focus cursor-text relative">
      {badge && <SourceBadge source={badge} />}
      <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">Height</label>
      {isEmpty ? (
        <span className="text-on-surface-variant/30 text-sm font-normal">—</span>
      ) : (
        <div className="flex items-center pb-0.5">
          <input className="bg-transparent text-on-surface text-sm font-normal outline-none placeholder:text-on-surface/40"
            style={{ width: `${Math.max(String(feet || "").length || 1, 1) * 0.6 + 0.4}em` }}
            value={String(feet)} onChange={(e) => handleFeetChange(e.target.value)} inputMode="numeric" placeholder="0" />
          <span className="text-on-surface-variant text-sm font-normal shrink-0 ml-1.5">ft</span>
          <input className="bg-transparent text-on-surface text-sm font-normal outline-none placeholder:text-on-surface/40 ml-3"
            style={{ width: `${Math.max(String(inches || "").length || 1, 1) * 0.6 + 0.4}em` }}
            value={String(inches)} onChange={(e) => handleInchesChange(e.target.value)} inputMode="numeric" placeholder="0" />
          <span className="text-on-surface-variant text-sm font-normal shrink-0 ml-1.5">in</span>
        </div>
      )}
    </div>
  );
};

const SelectCard = ({
  label, value, options, onChange, badge,
}: {
  label: string; value: string; options: { value: string; label: string }[];
  onChange: (val: string) => void; badge?: "CFBD" | "247" | "ON3";
}) => (
  <div className="bg-surface-container rounded-xl p-4 transition-colors duration-200 input-card-focus relative">
    {badge && <SourceBadge source={badge} />}
    <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">{label}</label>
    <select
      className={`w-full bg-transparent text-sm font-normal outline-none appearance-none cursor-pointer ${value ? "text-on-surface" : "text-on-surface/40"}`}
      value={value} onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-surface-container text-on-surface">{opt.label}</option>
      ))}
    </select>
  </div>
);

const DateInputCard = ({ label, value, onChange, badge }: {
  label: string; value: string; onChange: (val: string) => void; badge?: "CFBD" | "247" | "ON3";
}) => (
  <div className="bg-surface-container rounded-xl p-4 transition-colors duration-200 input-card-focus relative">
    {badge && <SourceBadge source={badge} />}
    <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">{label}</label>
    <input type="date"
      className={`w-full bg-transparent text-sm font-normal outline-none [color-scheme:dark] ${value ? "text-on-surface" : "text-on-surface/40"}`}
      value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const TimeInputCard = ({
  label, time, period, onTimeChange, onPeriodChange, badge,
}: {
  label: string; time: string; period: string;
  onTimeChange: (val: string) => void; onPeriodChange: (val: string) => void;
  badge?: "CFBD" | "247" | "ON3";
}) => (
  <div className="bg-surface-container rounded-xl p-4 transition-colors duration-200 input-card-focus flex items-center gap-3 relative">
    {badge && <SourceBadge source={badge} />}
    <div className="flex-1">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">{label}</label>
      <input className="w-full bg-transparent text-on-surface text-sm font-normal outline-none placeholder:text-on-surface/40"
        value={time} onChange={(e) => onTimeChange(e.target.value)} placeholder="0:00" inputMode="numeric" />
    </div>
    <select value={period} onChange={(e) => onPeriodChange(e.target.value)}
      className={`bg-surface-container-highest rounded-lg border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 outline-none cursor-pointer appearance-none mr-1 ${period ? "text-on-surface-variant" : "text-on-surface-variant/40"}`}
      style={{ minWidth: 56 }}>
      <option value="">—</option>
      <option value="AM">AM</option>
      <option value="PM">PM</option>
    </select>
  </div>
);

/* ─── AI Video placeholder field ───────────────────────────── */

const AiVideoField = ({ label }: { label: string }) => (
  <div className="bg-surface-container rounded-xl p-4 relative">
    <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container-highest/60">
      <span className="material-symbols-outlined text-[10px] text-on-surface-variant/50">videocam</span>
      <span className="text-[9px] font-semibold uppercase tracking-wider text-on-surface-variant/50">AI Video</span>
    </div>
    <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">{label}</label>
    <span className="text-sm font-normal text-on-surface-variant/30">—</span>
  </div>
);

/* ─── Read-only display for rank/rating with dash empty state ─ */

const DisplayField = ({ label, value, decimals, badge }: {
  label: string; value: string | number | null; decimals?: number; badge?: "CFBD" | "247" | "ON3";
}) => {
  let display = "—";
  if (value !== null && value !== "" && value !== 0) {
    if (decimals !== undefined && typeof value === "number") {
      display = value.toFixed(decimals);
    } else if (decimals !== undefined && typeof value === "string" && value) {
      const n = parseFloat(value);
      display = isNaN(n) ? value : n.toFixed(decimals);
    } else {
      display = String(value);
    }
  }
  return (
    <div className="bg-surface-container rounded-xl p-4 relative">
      {badge && <SourceBadge source={badge} />}
      <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">{label}</label>
      <span className={`text-sm font-normal ${display === "—" ? "text-on-surface-variant/30" : "text-on-surface"}`}>{display}</span>
    </div>
  );
};

/* ─── School Autocomplete (reused from existing) ───────────── */

const SchoolAutocomplete = ({
  value, onSelect, onManualChange,
}: {
  value: string; onSelect: (opt: SchoolOption) => void; onManualChange: (val: string) => void;
}) => {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { results: filtered } = useSchoolSearch(open ? query : "");

  useEffect(() => { setQuery(value); }, [value]);

  const handleSelect = useCallback((opt: SchoolOption) => {
    setQuery(opt.displayName); setOpen(false); setFocusIndex(-1); onSelect(opt);
  }, [onSelect]);

  const handleInputChange = (val: string) => { setQuery(val); setOpen(true); setFocusIndex(-1); onManualChange(val); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusIndex((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && focusIndex >= 0) { e.preventDefault(); handleSelect(filtered[focusIndex]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  useEffect(() => {
    if (focusIndex >= 0 && listRef.current) {
      (listRef.current.children[focusIndex] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
    }
  }, [focusIndex]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="bg-surface-container rounded-xl p-4 transition-colors duration-200 input-card-focus">
        <LockIcon />
        <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">School</label>
        <div className="flex items-center">
          <input className="w-full bg-transparent text-on-surface text-sm font-normal outline-none"
            value={query} onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => { if (query.length >= 1) setOpen(true); }} onKeyDown={handleKeyDown} placeholder="Search schools..." />
          <span className="material-symbols-outlined text-on-surface-variant text-base ml-1 shrink-0">search</span>
        </div>
      </div>
      {open && filtered.length > 0 && (
        <ul ref={listRef} className="absolute z-50 left-0 right-0 top-full mt-1 max-h-[240px] overflow-y-auto rounded-xl bg-surface-container-high shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {filtered.map((opt, i) => (
            <li key={opt.name} onMouseDown={() => handleSelect(opt)} onMouseEnter={() => setFocusIndex(i)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors duration-100 ${i === focusIndex ? "bg-surface-container-highest" : "hover:bg-surface-container-highest/50"}`}>
              {opt.logoUrl ? (
                <img src={opt.logoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />
              ) : (
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: opt.primaryColor }} />
              )}
              <span className="text-on-surface text-sm font-normal truncate">{opt.displayName}</span>
              <span className="text-on-surface-variant text-[10px] uppercase tracking-widest ml-auto shrink-0">{opt.abbrev}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const UniversitySearchCard = ({
  label, value, onChange, placeholder = "Search schools...", badge,
}: {
  label: string; value: string; onChange: (name: string) => void; placeholder?: string;
  badge?: "CFBD" | "247" | "ON3";
}) => {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { results: filtered } = useSchoolSearch(open ? query : "");

  useEffect(() => { setQuery(value); }, [value]);

  const handleSelect = useCallback((opt: SchoolOption) => {
    setQuery(opt.displayName); setOpen(false); setFocusIndex(-1); onChange(opt.displayName);
  }, [onChange]);

  const handleInputChange = (val: string) => { setQuery(val); setOpen(true); setFocusIndex(-1); onChange(val); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusIndex((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && focusIndex >= 0) { e.preventDefault(); handleSelect(filtered[focusIndex]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  useEffect(() => {
    if (focusIndex >= 0 && listRef.current) {
      (listRef.current.children[focusIndex] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
    }
  }, [focusIndex]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="bg-surface-container rounded-xl p-4 transition-colors duration-200 input-card-focus relative">
        {badge && <SourceBadge source={badge} />}
        <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">{label}</label>
        <div className="flex items-center">
          <input className="w-full bg-transparent text-on-surface text-sm font-normal outline-none placeholder:text-on-surface/40"
            value={query} onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => { if (query.length >= 1) setOpen(true); }} onKeyDown={handleKeyDown} placeholder={placeholder} />
          <span className="material-symbols-outlined text-on-surface-variant text-base ml-1 shrink-0">search</span>
        </div>
      </div>
      {open && filtered.length > 0 && (
        <ul ref={listRef} className="absolute z-50 left-0 right-0 top-full mt-1 max-h-[240px] overflow-y-auto rounded-xl bg-surface-container-high shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {filtered.map((opt, i) => (
            <li key={opt.name} onMouseDown={() => handleSelect(opt)} onMouseEnter={() => setFocusIndex(i)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors duration-100 ${i === focusIndex ? "bg-surface-container-highest" : "hover:bg-surface-container-highest/50"}`}>
              {opt.logoUrl ? (
                <img src={opt.logoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />
              ) : (
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: opt.primaryColor }} />
              )}
              <span className="text-on-surface text-sm font-normal truncate">{opt.displayName}</span>
              <span className="text-on-surface-variant text-[10px] uppercase tracking-widest ml-auto shrink-0">{opt.abbrev}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export const IdentityForm = () => {
  const store = useAthleteStore();
  const {
    firstName, lastName, bio, quote, school, teamColor,
    position, number, classYear, hometown, highSchool, height, weight,
    fortyTime, vertical, wingspan, handSize,
    actionPhotoUrl, profilePictureUrl, schoolLogoUrl,
    eligibilityYears, transferEligible, commitmentStatus,
    starRating, nationalRank, positionRank, stateRank,
    recruitingRating, on3Rating,
    nilValuation, transferFrom, transferStars, transferRating,
    upcomingGame, activeSection,
    setAthlete,
  } = store;

  const sectionIcons: Record<string, string> = { performance: "sports_score", develop: "trending_up", pulse: "monitor_heart", connect: "handshake" };
  const sectionLabels: Record<string, string> = { performance: "Performance", develop: "Develop", pulse: "Pulse", connect: "Connect" };

  const photoInputRef = useRef<HTMLInputElement>(null);
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const [showColorOverride, setShowColorOverride] = useState(false);

  const autoFetchSchoolLogo = useCallback(async (schoolName: string) => {
    if (schoolLogoUrl) return;
    setLogoLoading(true);
    try {
      const result = await firecrawlApi.fetchSchoolLogo(schoolName);
      if (result.success && result.logoUrl) {
        const proxyRes = await supabase.functions.invoke("image-proxy", {
          body: { imageUrl: result.logoUrl, fileName: `logos/${schoolName.replace(/\s+/g, "-").toLowerCase()}-logo.png`, bucket: "athlete-media" },
        });
        if (!proxyRes.error && proxyRes.data?.success && proxyRes.data?.publicUrl) {
          setAthlete({ schoolLogoUrl: proxyRes.data.publicUrl });
        }
      }
    } catch { /* silently fail */ } finally { setLogoLoading(false); }
  }, [schoolLogoUrl, setAthlete]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAthlete({ actionPhotoUrl: URL.createObjectURL(file) });
  };
  const handleProfilePicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAthlete({ profilePictureUrl: URL.createObjectURL(file) });
  };
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAthlete({ schoolLogoUrl: URL.createObjectURL(file) });
  };

  const game = upcomingGame ?? { opponent: "", date: "", time: "", network: "", location: "" };
  const setGame = (field: string, val: string) => { setAthlete({ upcomingGame: { ...game, [field]: val } }); };

  const timeMatch = game.time.match(/^([\d:]*)\s*(AM|PM)?$/i);
  const timeValue = timeMatch ? timeMatch[1] : game.time.replace(/[^0-9:]/g, "");
  const timePeriod = timeMatch?.[2]?.toUpperCase() ?? "";
  const handleTimeChange = (val: string) => { setGame("time", timePeriod ? `${val} ${timePeriod}` : val); };
  const handlePeriodChange = (p: string) => { setGame("time", timeValue ? `${timeValue} ${p}` : ` ${p}`); };

  const weightRaw = weight.replace(/\s*lbs?/i, "");

  /* Show transfer block if portal OR has transfer data */
  const showTransfer = commitmentStatus === "portal" || !!transferFrom;

  return (
    <div className="space-y-10">
      {/* ═══════════════ ON YOUR CARD ═══════════════ */}
      <GroupHeader title="On Your Card" />

      {activeSection === "identity" ? (
        <>
          {/* ── Core Identity ── */}
          <section>
            <SectionHeader title="Core Identity" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <LockedField label="First Name" value={firstName} />
                <LockedField label="Last Name" value={lastName} />
              </div>

              <input ref={profilePicInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfilePicUpload} />
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />

              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={() => profilePicInputRef.current?.click()}
                  className="bg-surface-container rounded-xl min-h-[100px] flex flex-col items-center justify-center gap-2 text-center transition-colors duration-200 overflow-hidden">
                  {profilePictureUrl ? (
                    <div className="relative w-full h-full group/img">
                      <img src={profilePictureUrl} alt="Profile picture" className="w-full h-full object-cover rounded-xl" />
                      <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200">
                        <span className="material-symbols-outlined text-on-surface text-xl">swap_horiz</span>
                        <span className="text-on-surface text-[9px] font-bold uppercase tracking-widest">Profile Picture</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-on-surface-variant text-3xl">add_a_photo</span>
                      <span className="text-on-surface-variant/60 text-[9px]">Profile Picture</span>
                    </>
                  )}
                </button>
                <button type="button" onClick={() => photoInputRef.current?.click()}
                  className="bg-surface-container rounded-xl min-h-[100px] flex flex-col items-center justify-center gap-2 text-center transition-colors duration-200 overflow-hidden">
                  {actionPhotoUrl ? (
                    <div className="relative w-full h-full group/img">
                      <img src={actionPhotoUrl} alt="Action photo" className="w-full h-full object-cover rounded-xl" />
                      <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200">
                        <span className="material-symbols-outlined text-on-surface text-xl">swap_horiz</span>
                        <span className="text-on-surface text-[9px] font-bold uppercase tracking-widest">Action Photo</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-on-surface-variant text-3xl">add_a_photo</span>
                      <span className="text-on-surface-variant/60 text-[9px]">Action Photo</span>
                    </>
                  )}
                </button>
              </div>

              {/* School + Logo row */}
              <div className="grid grid-cols-[4fr_1fr] gap-3">
                <SchoolAutocomplete
                  value={school}
                  onSelect={(opt) => {
                    setAthlete({ school: opt.displayName, schoolAbbrev: opt.abbrev, teamColor: opt.primaryColor, schoolLogoUrl: opt.logoUrl });
                    if (!opt.logoUrl) autoFetchSchoolLogo(opt.name);
                  }}
                  onManualChange={(v) => {
                    if (v === "") setAthlete({ school: "", schoolAbbrev: "", teamColor: "#50C4CA", schoolLogoUrl: null });
                    else setAthlete({ school: v });
                  }}
                />
                <button type="button" onClick={() => logoInputRef.current?.click()}
                  className="bg-surface-container rounded-xl flex items-center justify-center transition-colors duration-200 overflow-hidden">
                  {logoLoading ? (
                    <div className="flex flex-col items-center justify-center gap-1 animate-pulse">
                      <span className="material-symbols-outlined text-on-surface-variant text-2xl">search</span>
                    </div>
                  ) : schoolLogoUrl ? (
                    <div className="relative w-full h-full group/img flex items-center justify-center">
                      <img src={schoolLogoUrl} alt="School logo" className="w-10 h-10 object-contain" />
                      <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity duration-200">
                        <span className="material-symbols-outlined text-on-surface text-xl">swap_horiz</span>
                      </div>
                    </div>
                  ) : (
                    <span className="material-symbols-outlined text-on-surface-variant text-2xl">shield</span>
                  )}
                </button>
              </div>

              {/* Color override */}
              <button type="button" onClick={() => setShowColorOverride((p) => !p)}
                className="flex items-center gap-2 text-on-surface-variant/60 hover:text-on-surface-variant text-[10px] font-semibold uppercase tracking-widest transition-colors duration-200 mt-1">
                <span className="material-symbols-outlined text-sm">{showColorOverride ? "expand_less" : "tune"}</span>
                Advanced color customization
              </button>
              {showColorOverride && (
                <div className="bg-surface-container rounded-xl p-4 transition-colors duration-200 input-card-focus">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">Team Color (Hex)</label>
                  <div className="flex items-center gap-2">
                    <input className="w-full bg-transparent text-sm font-normal outline-none" style={{ color: teamColor }}
                      value={teamColor} onChange={(e) => setAthlete({ teamColor: e.target.value })} />
                    <div className="w-6 h-6 rounded-lg border border-outline-variant/10 shrink-0" style={{ backgroundColor: teamColor }} />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Position & Details ── */}
          <section>
            <SectionHeader title="Position & Details" />
            <div className="grid grid-cols-2 gap-4">
              <div className="grid grid-cols-2 gap-4 col-span-2">
                <LockedField label="Position" value={position} />
                <LockedField label="Jersey Number" value={number} placeholder="#" />
              </div>
              <LockedField label="Class" value={classYear} />
              <InputCard label="Class Year" value={store.recruitingClassYear ?? ""} onChange={(v) => setAthlete({ recruitingClassYear: v || null })} placeholder="e.g. 2023" badge="CFBD" />
            </div>
          </section>

          {/* ── Measurables ── */}
          <section>
            <SectionHeader title="Measurables" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <HeightInputCard value={height} onChange={(v) => setAthlete({ height: v })} badge="CFBD" />
                <NumericInputCard label="Weight" value={weightRaw} suffix=" lbs" placeholder="—"
                  onChange={(v) => setAthlete({ weight: v })} badge="CFBD" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <AiVideoField label="40-Yard Dash" />
                <AiVideoField label="Vertical Leap" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <AiVideoField label="Wingspan" />
                <AiVideoField label="Hand Size" />
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl bg-surface-container border border-white/5 py-16">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4">{sectionIcons[activeSection]}</span>
          <span className="text-[#c0c3c7] text-sm font-semibold uppercase tracking-widest">{sectionLabels[activeSection]}</span>
          <span className="text-on-surface-variant/50 text-xs mt-1">Coming Soon</span>
        </div>
      )}

      {activeSection === "identity" && (
        <>
          {/* ═══════════════ ON YOUR PROFILE ═══════════════ */}
          <GroupHeader title="On Your Profile" />

          {/* ── Story ── */}
          <section>
            <SectionHeader title="Story" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InputCard label="Hometown" value={hometown} onChange={(v) => setAthlete({ hometown: v })} placeholder="—" badge="CFBD" />
                <InputCard label="High School" value={highSchool} onChange={(v) => setAthlete({ highSchool: v })} placeholder="—" badge="CFBD" />
              </div>
              <InputCard label="Athlete Bio" value={bio} type="textarea" onChange={(v) => setAthlete({ bio: v })}
                helperText="Tell coaches and scouts your story in your own words" placeholder="Your bio..." />
              <InputCard label="Personal Quote" value={quote} type="textarea" onChange={(v) => setAthlete({ quote: v })} placeholder="Your quote..." />
            </div>
          </section>

          {/* ── Recruiting Profile ── */}
          <section>
            <SectionHeader title="Recruiting Profile" />
            <div className="space-y-4">
              {/* Stars */}
              <SelectCard label="Composite Stars" value={starRating ? String(starRating) : ""} badge="CFBD"
                options={[
                  { label: "—", value: "" },
                  { label: "★", value: "1" }, { label: "★★", value: "2" },
                  { label: "★★★", value: "3" }, { label: "★★★★", value: "4" }, { label: "★★★★★", value: "5" },
                ]}
                onChange={(v) => setAthlete({ starRating: v ? Number(v) : 0 })} />

              {/* Ratings row */}
              <div className="grid grid-cols-3 gap-4">
                <DisplayField label="Composite Rating" value={recruitingRating} decimals={4} badge="CFBD" />
                <DisplayField label="247Sports Rating" value={store.rating247} decimals={4} badge="247" />
                <DisplayField label="On3 Rating" value={on3Rating} decimals={4} badge="ON3" />
              </div>

              {/* Rankings */}
              <div className="grid grid-cols-3 gap-4">
                <DisplayField label="National Rank" value={nationalRank} badge="CFBD" />
                <DisplayField label={position ? `${position} Rank` : "Position Rank"} value={positionRank} badge="247" />
                <DisplayField label="State Rank" value={stateRank} badge="247" />
              </div>

              {/* NIL + Commitment */}
              <div className="grid grid-cols-2 gap-4">
                <InputCard label="NIL Valuation" value={nilValuation ?? ""} onChange={(v) => setAthlete({ nilValuation: v || null })} placeholder="—" badge="ON3" />
                <SelectCard label="Commitment Status" value={commitmentStatus} options={commitmentOptions}
                  onChange={(v) => setAthlete({ commitmentStatus: v as "" | "committed" | "uncommitted" | "portal" })} />
              </div>
            </div>
          </section>

          {/* ── Eligibility & Transfer ── */}
          <section>
            <SectionHeader title="Eligibility & Transfer" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <DisplayField label="Eligibility Years Remaining" value={eligibilityYears || null} badge="CFBD" />
                <DisplayField label="Transfer Eligible" value={transferEligible === "yes" ? "Yes" : transferEligible === "no" ? "No" : null} badge="CFBD" />
              </div>

              {showTransfer && (
                <>
                  <InputCard label="Transferred From" value={transferFrom ?? ""} onChange={(v) => setAthlete({ transferFrom: v || null })} placeholder="—" badge="CFBD" />
                  <div className="grid grid-cols-2 gap-4">
                    <DisplayField label="Transfer Star Rating" value={transferStars} badge="CFBD" />
                    <DisplayField label="Transfer Rating (247)" value={transferRating} decimals={4} badge="CFBD" />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* ── Upcoming Game ── */}
          <section>
            <SectionHeader title="Upcoming Game" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <DisplayField label="Opponent" value={game.opponent} badge="CFBD" />
                <DisplayField label="Date" value={game.date} badge="CFBD" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <DisplayField label="Kickoff Time" value={game.time} badge="CFBD" />
                <DisplayField label="Venue / Location" value={game.location} badge="CFBD" />
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
