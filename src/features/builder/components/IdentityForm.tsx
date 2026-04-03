import { useRef, useState, useEffect, useCallback } from "react";
import { useAthleteStore } from "@/store/athleteStore";
import { universities, type University } from "@/data/universities";

const positions = ["QB", "RB", "FB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P", "LS"];
const classYears = ["2024", "2025", "2026", "2027", "2028", "2029", "2030"];
const commitmentOptions = [
  { value: "", label: "Select..." },
  { value: "committed", label: "Committed" },
  { value: "uncommitted", label: "Uncommitted" },
  { value: "portal", label: "In Portal" },
];

const SectionHeader = ({ title }: { title: string }) => (
  <div className="flex items-center gap-3 mb-6">
    <span
      className="w-8 h-[1px]"
      style={{ backgroundColor: "var(--team-color)" }}
    />
    <h3 className="text-on-surface font-extrabold uppercase text-sm tracking-wide">
      {title}
    </h3>
  </div>
);

const GroupHeader = ({ title }: { title: string }) => (
  <div className="flex items-center gap-3 mb-8 mt-2">
    <h2 className="text-on-surface font-black uppercase text-base tracking-[0.2em]">
      {title}
    </h2>
    <span className="flex-1 h-[1px] bg-outline-variant/20" />
  </div>
);

const InputCard = ({
  label,
  value,
  type = "text",
  onChange,
  suffix,
  helperText,
  placeholder,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (val: string) => void;
  suffix?: string;
  helperText?: string;
  placeholder?: string;
}) => (
  <div className="bg-surface-container rounded-xl p-4 transition-colors duration-200 input-card-focus">
    <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">
      {label}
    </label>
    {type === "textarea" ? (
      <>
        <textarea
          className="w-full bg-transparent text-on-surface text-sm font-normal resize-none outline-none min-h-[80px] placeholder:text-on-surface/40"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {helperText && (
          <p className="text-[10px] text-on-surface-variant/50 mt-1">{helperText}</p>
        )}
      </>
    ) : (
      <div className="flex items-center">
        <input
          className="w-full bg-transparent text-on-surface text-sm font-normal outline-none placeholder:text-on-surface/40"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          placeholder={placeholder}
        />
        {suffix && (
          <span className="text-on-surface-variant text-sm font-normal ml-1 shrink-0">{suffix}</span>
        )}
      </div>
    )}
  </div>
);

const NumericInputCard = ({
  label,
  value,
  onChange,
  suffix,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  suffix: string;
  placeholder?: string;
}) => {
  const isEmpty = !value;
  return (
    <div className="bg-surface-container rounded-xl p-4 transition-colors duration-200 input-card-focus cursor-text">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">
        {label}
      </label>
      <div className={`flex items-center ${isEmpty ? "border-b border-dashed border-outline-variant/30" : ""} pb-0.5`}>
        <input
          className="bg-transparent text-on-surface text-sm font-normal outline-none placeholder:text-on-surface/40"
          style={{ width: `${Math.max((value || placeholder || "").length, 1) * 0.6 + 0.4}em` }}
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d.]/g, "");
            onChange(v);
          }}
          inputMode="decimal"
          placeholder={placeholder}
        />
        <span className="text-on-surface-variant text-sm font-normal shrink-0">{suffix}</span>
      </div>
    </div>
  );
};

const HeightInputCard = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) => {
  // value is total inches as string e.g. "74"
  const totalInches = parseInt(value, 10) || 0;
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;

  const handleFeetChange = (v: string) => {
    const f = parseInt(v.replace(/\D/g, ""), 10) || 0;
    onChange(String(f * 12 + inches));
  };

  const handleInchesChange = (v: string) => {
    const raw = v.replace(/\D/g, "");
    const i = Math.min(parseInt(raw, 10) || 0, 11);
    onChange(String(feet * 12 + i));
  };

  const isEmpty = totalInches === 0;
  return (
    <div className="bg-surface-container rounded-xl p-4 transition-colors duration-200 input-card-focus cursor-text">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">
        Height
      </label>
      <div className={`flex items-center gap-2 ${isEmpty ? "border-b border-dashed border-outline-variant/30" : ""} pb-0.5`}>
        <input
          className="w-12 bg-transparent text-on-surface text-sm font-normal outline-none text-center placeholder:text-on-surface/40"
          value={totalInches > 0 ? String(feet) : ""}
          onChange={(e) => handleFeetChange(e.target.value)}
          inputMode="numeric"
          placeholder="0"
        />
        <span className="text-on-surface-variant text-sm shrink-0">ft</span>
        <input
          className="w-12 bg-transparent text-on-surface text-sm font-normal outline-none text-center placeholder:text-on-surface/40"
          value={totalInches > 0 ? String(inches) : ""}
          onChange={(e) => handleInchesChange(e.target.value)}
          inputMode="numeric"
          placeholder="0"
        />
        <span className="text-on-surface-variant text-sm shrink-0">in</span>
      </div>
    </div>
  );
};

const SelectCard = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
}) => (
  <div className="bg-surface-container rounded-xl p-4 transition-colors duration-200 input-card-focus">
    <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">
      {label}
    </label>
    <select
      className="w-full bg-transparent text-on-surface text-sm font-normal outline-none appearance-none cursor-pointer"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-surface-container text-on-surface">
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

const DateInputCard = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) => (
  <div className="bg-surface-container rounded-xl p-4 transition-colors duration-200 input-card-focus">
    <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">
      {label}
    </label>
    <input
      type="date"
      className="w-full bg-transparent text-on-surface text-sm font-normal outline-none [color-scheme:dark]"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const TimeInputCard = ({
  label,
  time,
  period,
  onTimeChange,
  onPeriodChange,
}: {
  label: string;
  time: string;
  period: string;
  onTimeChange: (val: string) => void;
  onPeriodChange: (val: string) => void;
}) => (
  <div className="bg-surface-container rounded-xl p-4 transition-colors duration-200 input-card-focus flex items-center gap-3">
    <div className="flex-1">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">
        {label}
      </label>
      <input
        className="w-full bg-transparent text-on-surface text-sm font-normal outline-none"
        value={time}
        onChange={(e) => onTimeChange(e.target.value)}
        placeholder="0:00"
        inputMode="numeric"
      />
    </div>
    <select
      value={period}
      onChange={(e) => onPeriodChange(e.target.value)}
      className="bg-surface-container-highest text-on-surface-variant rounded-lg border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 outline-none cursor-pointer appearance-none mr-1"
      style={{ minWidth: 56 }}
    >
      <option value="">—</option>
      <option value="AM">AM</option>
      <option value="PM">PM</option>
    </select>
  </div>
);

const SchoolAutocomplete = ({
  value,
  onSelect,
  onManualChange,
}: {
  value: string;
  onSelect: (uni: University) => void;
  onManualChange: (val: string) => void;
}) => {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Sync external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered = query.length >= 1
    ? universities.filter((u) =>
        u.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  const handleSelect = useCallback((uni: University) => {
    setQuery(uni.name);
    setOpen(false);
    setFocusIndex(-1);
    onSelect(uni);
  }, [onSelect]);

  const handleInputChange = (val: string) => {
    setQuery(val);
    setOpen(true);
    setFocusIndex(-1);
    onManualChange(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && focusIndex >= 0) {
      e.preventDefault();
      handleSelect(filtered[focusIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Scroll focused item into view
  useEffect(() => {
    if (focusIndex >= 0 && listRef.current) {
      const item = listRef.current.children[focusIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [focusIndex]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="bg-surface-container rounded-xl p-4 transition-colors duration-200 input-card-focus">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">
          School
        </label>
        <div className="flex items-center">
          <input
            className="w-full bg-transparent text-on-surface text-sm font-normal outline-none"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => { if (query.length >= 1) setOpen(true); }}
            onKeyDown={handleKeyDown}
            placeholder="Search schools..."
          />
          <span className="material-symbols-outlined text-on-surface-variant text-base ml-1 shrink-0">
            search
          </span>
        </div>
      </div>
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 left-0 right-0 top-full mt-1 max-h-[240px] overflow-y-auto rounded-xl bg-surface-container-high shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        >
          {filtered.map((uni, i) => (
            <li
              key={uni.name}
              onMouseDown={() => handleSelect(uni)}
              onMouseEnter={() => setFocusIndex(i)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors duration-100 ${
                i === focusIndex
                  ? "bg-surface-container-highest"
                  : "hover:bg-surface-container-highest/50"
              }`}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: uni.primaryColor }}
              />
              <span className="text-on-surface text-sm font-normal truncate">
                {uni.name}
              </span>
              <span className="text-on-surface-variant text-[10px] uppercase tracking-widest ml-auto shrink-0">
                {uni.abbrev}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const IdentityForm = () => {
  const store = useAthleteStore();
  const {
    firstName, lastName, bio, quote, school, schoolAbbrev, teamColor,
    position, number, classYear, hometown, highSchool, height, weight,
    fortyTime, vertical, wingspan, handSize,
    actionPhotoUrl, schoolLogoUrl,
    eligibilityYears, transferEligible, redshirtStatus,
    starRating, nationalRank, positionRank,
    commitmentStatus, upcomingGame,
    activeSection,
    setAthlete,
  } = store;

  const sectionIcons: Record<string, string> = {
    performance: "sports_score",
    develop: "trending_up",
    pulse: "monitor_heart",
    connect: "handshake",
  };

  const sectionLabels: Record<string, string> = {
    performance: "Performance",
    develop: "Develop",
    pulse: "Pulse",
    connect: "Connect",
  };

  const photoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAthlete({ actionPhotoUrl: url });
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAthlete({ schoolLogoUrl: url });
    }
  };

  const game = upcomingGame ?? { opponent: "", date: "", time: "", network: "", location: "" };
  const setGame = (field: string, val: string) => {
    setAthlete({ upcomingGame: { ...game, [field]: val } });
  };

  // Parse time into value and period
  const timeMatch = game.time.match(/^([\d:]*)\s*(AM|PM)?$/i);
  const timeValue = timeMatch ? timeMatch[1] : game.time.replace(/[^0-9:]/g, "");
  const timePeriod = timeMatch?.[2]?.toUpperCase() ?? "";

  const handleTimeChange = (val: string) => {
    setGame("time", timePeriod ? `${val} ${timePeriod}` : val);
  };
  const handlePeriodChange = (p: string) => {
    setGame("time", timeValue ? `${timeValue} ${p}` : ` ${p}`);
  };

  // Weight: raw number stored now
  const weightRaw = weight.replace(/\s*lbs?/i, "");

  return (
    <div className="space-y-10">
      {/* ═══════════════ ON YOUR CARD ═══════════════ */}
      <GroupHeader title="On Your Card" />

      {activeSection === "identity" ? (
        <>
          {/* Your Identity */}
          <section>
            <SectionHeader title="Your Identity" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InputCard label="First Name" value={firstName} onChange={(v) => setAthlete({ firstName: v })} placeholder="Your" />
                <InputCard label="Last Name" value={lastName} onChange={(v) => setAthlete({ lastName: v })} placeholder="Name" />
              </div>

              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7]">
                    Action Photo
                  </label>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="bg-surface-container rounded-xl min-h-[100px] flex flex-col items-center justify-center gap-2 text-center transition-colors duration-200"
                  >
                    {actionPhotoUrl ? (
                      <>
                        <img src={actionPhotoUrl} alt="Action photo" className="w-16 h-16 rounded-lg object-cover" />
                        <span className="text-on-surface-variant/60 text-[9px]">Tap to change</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-on-surface-variant text-3xl">add_a_photo</span>
                        <span className="text-on-surface-variant/60 text-[9px]">This is the hero of your card</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7]">
                    School Logo
                  </label>
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="bg-surface-container rounded-xl min-h-[100px] flex flex-col items-center justify-center gap-2 text-center transition-colors duration-200"
                  >
                    {schoolLogoUrl ? (
                      <>
                        <img src={schoolLogoUrl} alt="School logo" className="w-16 h-16 rounded-lg object-contain" />
                        <span className="text-on-surface-variant/60 text-[9px]">Tap to change</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-on-surface-variant text-3xl">add_a_photo</span>
                        <span className="text-on-surface-variant/60 text-[9px]">Your logo appears on the card</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <SchoolAutocomplete
                value={school}
                onSelect={(uni) => {
                  setAthlete({
                    school: uni.name,
                    schoolAbbrev: uni.abbrev,
                    teamColor: uni.primaryColor,
                  });
                }}
                onManualChange={(v) => setAthlete({ school: v })}
              />

              <div className="grid grid-cols-2 gap-4">
                <InputCard label="Team Color (Hex)" value={teamColor} onChange={(v) => setAthlete({ teamColor: v })} />
                <div className="bg-surface-container rounded-xl p-4">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-2">
                    Preview
                  </label>
                  <div
                    className="w-10 h-10 rounded-xl border border-outline-variant/10"
                    style={{ backgroundColor: teamColor }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Position & Details */}
          <section>
            <SectionHeader title="Position & Details" />
            <div className="space-y-4">
              <div className="bg-surface-container rounded-xl p-4">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-3">
                  Position
                </label>
                <div className="flex flex-wrap gap-2">
                  {positions.map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setAthlete({ position: pos === position ? "" : pos })}
                      className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.2em] transition-all duration-200 ${
                        pos === position
                          ? "text-[#00460a] kinetic-gradient"
                          : "text-on-surface-variant bg-surface-container-high"
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputCard label="Jersey #" value={number} onChange={(v) => setAthlete({ number: v })} placeholder="0" />
                <SelectCard
                  label="Class Year"
                  value={classYear}
                  options={[{ value: "", label: "Select..." }, ...classYears.map((y) => ({ value: y, label: y }))]}
                  onChange={(v) => setAthlete({ classYear: v })}
                />
              </div>
            </div>
          </section>

          {/* Measurables */}
          <section>
            <SectionHeader title="Measurables" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <HeightInputCard value={height} onChange={(v) => setAthlete({ height: v })} />
                <NumericInputCard
                  label="Weight"
                  value={weightRaw}
                  suffix=" lbs"
                  placeholder="0"
                  onChange={(v) => setAthlete({ weight: v })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <NumericInputCard label="40 Time" value={fortyTime} suffix="s" placeholder="0.0" onChange={(v) => setAthlete({ fortyTime: v })} />
                <NumericInputCard label="Vertical" value={vertical} suffix='"' placeholder="0.0" onChange={(v) => setAthlete({ vertical: v })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <NumericInputCard label="Wingspan" value={wingspan} suffix='"' placeholder="0.0" onChange={(v) => setAthlete({ wingspan: v })} />
                <NumericInputCard label="Hand Size" value={handSize} suffix='"' placeholder="0.0" onChange={(v) => setAthlete({ handSize: v })} />
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl bg-surface-container border border-white/5 py-16">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4">
            {sectionIcons[activeSection]}
          </span>
          <span className="text-[#c0c3c7] text-sm font-semibold uppercase tracking-widest">
            {sectionLabels[activeSection]}
          </span>
          <span className="text-on-surface-variant/50 text-xs mt-1">Coming Soon</span>
        </div>
      )}

      {activeSection === "identity" && (
        <>
          {/* ═══════════════ ON YOUR PROFILE ═══════════════ */}
          <GroupHeader title="On Your Profile" />

          {/* Recruiting */}
          <section>
            <SectionHeader title="Recruiting" />
            <div className="space-y-4">
              <div className="bg-surface-container rounded-xl p-4">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[#c0c3c7] block mb-3">
                  Star Rating
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setAthlete({ starRating: star === starRating ? 0 : star })}
                      className={`w-10 h-10 rounded-full text-xs font-black uppercase tracking-[0.2em] transition-all duration-200 ${
                        star === starRating
                          ? "text-[#00460a] kinetic-gradient"
                          : "text-on-surface-variant bg-surface-container-high"
                      }`}
                    >
                      {star}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputCard
                  label="National Rank"
                  value={nationalRank !== null ? String(nationalRank) : ""}
                  type="number"
                  onChange={(v) => setAthlete({ nationalRank: v ? Number(v) : null })}
                  placeholder="0"
                />
                <InputCard
                  label="Position Rank"
                  value={positionRank !== null ? String(positionRank) : ""}
                  type="number"
                  onChange={(v) => setAthlete({ positionRank: v ? Number(v) : null })}
                  placeholder="0"
                />
              </div>
              <SelectCard
                label="Commitment Status"
                value={commitmentStatus}
                options={commitmentOptions}
                onChange={(v) => setAthlete({ commitmentStatus: v as "" | "committed" | "uncommitted" | "portal" })}
              />
            </div>
          </section>

          {/* Eligibility */}
          <section>
            <SectionHeader title="Eligibility" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InputCard
                  label="Eligibility Years Remaining"
                  value={eligibilityYears === 0 ? "" : String(eligibilityYears)}
                  type="number"
                  onChange={(v) => setAthlete({ eligibilityYears: Number(v) || 0 })}
                  placeholder="0"
                />
                <SelectCard
                  label="Transfer Eligible"
                  value={transferEligible}
                  options={[
                    { value: "", label: "Select..." },
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" },
                  ]}
                  onChange={(v) => setAthlete({ transferEligible: v })}
                />
              </div>
              <SelectCard
                label="Redshirt Status"
                value={redshirtStatus}
                options={[
                  { value: "None", label: "None" },
                  { value: "Redshirt", label: "Redshirt" },
                  { value: "Medical RS", label: "Medical RS" },
                ]}
                onChange={(v) => setAthlete({ redshirtStatus: v })}
              />
            </div>
          </section>

          {/* Upcoming Game */}
          <section>
            <SectionHeader title="Upcoming Game" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InputCard label="Opponent" value={game.opponent} onChange={(v) => setGame("opponent", v)} placeholder="–" />
                <DateInputCard label="Date" value={game.date} onChange={(v) => setGame("date", v)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TimeInputCard
                  label="Time"
                  time={timeValue}
                  period={timePeriod}
                  onTimeChange={handleTimeChange}
                  onPeriodChange={handlePeriodChange}
                />
                <InputCard label="Network" value={game.network} onChange={(v) => setGame("network", v)} placeholder="–" />
              </div>
              <InputCard label="Location" value={game.location} onChange={(v) => setGame("location", v)} placeholder="–" />
            </div>
          </section>

          {/* Story */}
          <section>
            <SectionHeader title="Story" />
            <div className="space-y-4">
              <InputCard
                label="Athlete Bio"
                value={bio}
                type="textarea"
                onChange={(v) => setAthlete({ bio: v })}
                helperText="Tell coaches and scouts your story in your own words"
                placeholder="Your bio..."
              />
              <InputCard label="Personal Quote" value={quote} type="textarea" onChange={(v) => setAthlete({ quote: v })} placeholder="Your quote..." />
              <div className="grid grid-cols-2 gap-4">
                <InputCard label="Hometown" value={hometown} onChange={(v) => setAthlete({ hometown: v })} placeholder="–" />
                <InputCard label="High School" value={highSchool} onChange={(v) => setAthlete({ highSchool: v })} placeholder="–" />
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
