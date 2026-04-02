import { useRef, useState } from "react";
import { useAthleteStore } from "@/store/athleteStore";

const positions = ["QB", "RB", "FB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P", "LS"];
const classYears = ["2024", "2025", "2026", "2027", "2028", "2029", "2030"];
const commitmentOptions = [
  { value: "committed" as const, label: "Committed" },
  { value: "uncommitted" as const, label: "Uncommitted" },
  { value: "portal" as const, label: "In Portal" },
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
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (val: string) => void;
  suffix?: string;
  helperText?: string;
}) => (
  <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 transition-colors duration-200 input-card-focus">
    <label className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant block mb-2">
      {label}
    </label>
    {type === "textarea" ? (
      <>
        <textarea
          className="w-full bg-transparent text-on-surface text-sm font-normal resize-none outline-none min-h-[80px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {helperText && (
          <p className="text-[10px] text-on-surface-variant/50 mt-1">{helperText}</p>
        )}
      </>
    ) : (
      <div className="flex items-center">
        <input
          className="w-full bg-transparent text-on-surface text-sm font-normal outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
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
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  suffix: string;
}) => (
  <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 transition-colors duration-200 input-card-focus">
    <label className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant block mb-2">
      {label}
    </label>
    <div className="flex items-center">
      <span className="text-on-surface text-sm font-normal">{value || "\u00A0"}</span>
      <span className="text-on-surface-variant text-sm font-normal shrink-0">{suffix}</span>
      <input
        className="absolute inset-0 opacity-0 cursor-text"
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d.]/g, "");
          onChange(v);
        }}
        inputMode="decimal"
      />
    </div>
  </div>
);

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

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 transition-colors duration-200 input-card-focus">
      <label className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant block mb-2">
        Height
      </label>
      <div className="flex items-center gap-2">
        <input
          className="w-12 bg-transparent text-on-surface text-sm font-normal outline-none text-center"
          value={totalInches > 0 ? String(feet) : ""}
          onChange={(e) => handleFeetChange(e.target.value)}
          inputMode="numeric"
          placeholder="6"
        />
        <span className="text-on-surface-variant text-sm shrink-0">ft</span>
        <input
          className="w-12 bg-transparent text-on-surface text-sm font-normal outline-none text-center"
          value={totalInches > 0 ? String(inches) : ""}
          onChange={(e) => handleInchesChange(e.target.value)}
          inputMode="numeric"
          placeholder="2"
        />
        <span className="text-on-surface-variant text-sm shrink-0">in</span>
      </div>
    </div>
  );
};

const ToggleCard = ({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: boolean;
  onChange: (val: boolean) => void;
  description?: string;
}) => (
  <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 transition-colors duration-200">
    <label className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant block mb-2">
      {label}
    </label>
    <div className="flex items-center justify-between">
      <span className="text-on-surface text-sm font-normal">
        {value ? "Yes" : "No"}
      </span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-11 h-6 rounded-full relative transition-all duration-200 ${
          value ? "kinetic-gradient" : "bg-surface-container-high"
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${
            value ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
    {description && (
      <p className="text-[10px] text-on-surface-variant mt-2">{description}</p>
    )}
  </div>
);

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
  <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 transition-colors duration-200 input-card-focus">
    <label className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant block mb-2">
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
  <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 transition-colors duration-200 input-card-focus">
    <label className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant block mb-2">
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
  <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 transition-colors duration-200 input-card-focus">
    <label className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant block mb-2">
      {label}
    </label>
    <div className="flex items-center gap-2">
      <input
        className="flex-1 bg-transparent text-on-surface text-sm font-normal outline-none"
        value={time}
        onChange={(e) => onTimeChange(e.target.value)}
        placeholder="7:00"
        inputMode="numeric"
      />
      <div className="flex rounded-full overflow-hidden">
        {["AM", "PM"].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPeriodChange(p)}
            className={`px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-200 ${
              period === p
                ? "text-[#00460a] kinetic-gradient"
                : "text-on-surface-variant bg-surface-container-high"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  </div>
);

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
    setAthlete,
  } = store;

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
  const timeMatch = game.time.match(/^([\d:]+)\s*(AM|PM)?$/i);
  const timeValue = timeMatch ? timeMatch[1] : game.time;
  const timePeriod = timeMatch?.[2]?.toUpperCase() ?? "PM";

  const handleTimeChange = (val: string) => {
    setGame("time", `${val} ${timePeriod}`);
  };
  const handlePeriodChange = (p: string) => {
    setGame("time", `${timeValue} ${p}`);
  };

  // Weight: strip "lbs" suffix for raw editing
  const weightRaw = weight.replace(/\s*lbs?/i, "");

  return (
    <div className="space-y-10">
      {/* ═══════════════ ON YOUR CARD ═══════════════ */}
      <GroupHeader title="On Your Card" />

      {/* Your Identity */}
      <section>
        <SectionHeader title="Your Identity" />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <InputCard label="First Name" value={firstName} onChange={(v) => setAthlete({ firstName: v })} />
            <InputCard label="Last Name" value={lastName} onChange={(v) => setAthlete({ lastName: v })} />
          </div>

          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant">
                Action Photo
              </label>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="bg-surface-container-lowest rounded-xl border border-white/5 min-h-[100px] flex flex-col items-center justify-center gap-2 text-center transition-colors duration-200 hover:border-white/20"
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
              <label className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant">
                School Logo
              </label>
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="bg-surface-container-lowest rounded-xl border border-white/5 min-h-[100px] flex flex-col items-center justify-center gap-2 text-center transition-colors duration-200 hover:border-white/20"
              >
                {schoolLogoUrl ? (
                  <>
                    <img src={schoolLogoUrl} alt="School logo" className="w-16 h-16 rounded-lg object-contain" />
                    <span className="text-on-surface-variant/60 text-[9px]">Tap to change</span>
                  </>
                ) : (
                  <span className="material-symbols-outlined text-on-surface-variant text-3xl">school</span>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InputCard label="School" value={school} onChange={(v) => setAthlete({ school: v })} />
            <InputCard label="Abbreviation" value={schoolAbbrev} onChange={(v) => setAthlete({ schoolAbbrev: v })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InputCard label="Team Color (Hex)" value={teamColor} onChange={(v) => setAthlete({ teamColor: v })} />
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4">
              <label className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant block mb-2">
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
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4">
            <label className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant block mb-3">
              Position
            </label>
            <div className="flex flex-wrap gap-2">
              {positions.map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setAthlete({ position: pos })}
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
            <InputCard label="Jersey #" value={number} onChange={(v) => setAthlete({ number: v })} />
            <SelectCard
              label="Class Year"
              value={classYear}
              options={classYears.map((y) => ({ value: y, label: y }))}
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
              suffix="lbs"
              onChange={(v) => setAthlete({ weight: v ? `${v} lbs` : "" })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <NumericInputCard label="40 Time" value={fortyTime} suffix="s" onChange={(v) => setAthlete({ fortyTime: v })} />
            <NumericInputCard label="Vertical" value={vertical.replace(/"/g, "")} suffix='"' onChange={(v) => setAthlete({ vertical: v ? `${v}"` : "" })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <NumericInputCard label="Wingspan" value={wingspan.replace(/['"]/g, "")} suffix='"' onChange={(v) => setAthlete({ wingspan: v ? `${v}"` : "" })} />
            <NumericInputCard label="Hand Size" value={handSize.replace(/"/g, "")} suffix='"' onChange={(v) => setAthlete({ handSize: v ? `${v}"` : "" })} />
          </div>
        </div>
      </section>

      {/* ═══════════════ ON YOUR PROFILE ═══════════════ */}
      <GroupHeader title="On Your Profile" />

      {/* Recruiting */}
      <section>
        <SectionHeader title="Recruiting" />
        <div className="space-y-4">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4">
            <label className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant block mb-3">
              Star Rating
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setAthlete({ starRating: star })}
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
            />
            <InputCard
              label="Position Rank"
              value={positionRank !== null ? String(positionRank) : ""}
              type="number"
              onChange={(v) => setAthlete({ positionRank: v ? Number(v) : null })}
            />
          </div>
          {/* Commitment Status — pill buttons */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4">
            <label className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant block mb-3">
              Commitment Status
            </label>
            <div className="flex flex-wrap gap-2">
              {commitmentOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAthlete({ commitmentStatus: opt.value })}
                  className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.2em] transition-all duration-200 ${
                    commitmentStatus === opt.value
                      ? "text-[#00460a] kinetic-gradient"
                      : "text-on-surface-variant bg-surface-container-high"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Eligibility */}
      <section>
        <SectionHeader title="Eligibility" />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <InputCard
              label="Eligibility Years Remaining"
              value={String(eligibilityYears)}
              type="number"
              onChange={(v) => setAthlete({ eligibilityYears: Number(v) || 0 })}
            />
            <ToggleCard
              label="Transfer Eligible"
              value={transferEligible}
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
            <InputCard label="Opponent" value={game.opponent} onChange={(v) => setGame("opponent", v)} />
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
            <InputCard label="Network" value={game.network} onChange={(v) => setGame("network", v)} />
          </div>
          <InputCard label="Location" value={game.location} onChange={(v) => setGame("location", v)} />
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
          />
          <InputCard label="Personal Quote" value={quote} type="textarea" onChange={(v) => setAthlete({ quote: v })} />
          <div className="grid grid-cols-2 gap-4">
            <InputCard label="Hometown" value={hometown} onChange={(v) => setAthlete({ hometown: v })} />
            <InputCard label="High School" value={highSchool} onChange={(v) => setAthlete({ highSchool: v })} />
          </div>
        </div>
      </section>
    </div>
  );
};
