import { useRef } from "react";
import { useAthleteStore } from "@/store/athleteStore";

const positions = ["QB", "RB", "FB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P", "LS"];

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
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (val: string) => void;
}) => (
  <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 transition-colors duration-200 input-card-focus">
    <label className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant block mb-2">
      {label}
    </label>
    {type === "textarea" ? (
      <textarea
        className="w-full bg-transparent text-on-surface text-sm font-normal resize-none outline-none min-h-[80px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    ) : (
      <input
        className="w-full bg-transparent text-on-surface text-sm font-normal outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
      />
    )}
  </div>
);

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

  return (
    <div className="space-y-10">
      {/* ═══════════════ CARD FIELDS ═══════════════ */}
      <GroupHeader title="Card Fields" />

      {/* Your Identity */}
      <section>
        <SectionHeader title="Your Identity" />
        <div className="space-y-4">
          {/* Name fields — top */}
          <div className="grid grid-cols-2 gap-4">
            <InputCard label="First Name" value={firstName} onChange={(v) => setAthlete({ firstName: v })} />
            <InputCard label="Last Name" value={lastName} onChange={(v) => setAthlete({ lastName: v })} />
          </div>

          {/* Media uploads — side by side */}
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="bg-surface-container-lowest rounded-xl border border-white/5 min-h-[80px] flex flex-col items-center justify-center gap-2 text-center transition-colors duration-200 hover:border-white/20"
            >
              {actionPhotoUrl ? (
                <img src={actionPhotoUrl} alt="Action photo" className="w-12 h-12 rounded-lg object-cover" />
              ) : (
                <span className="material-symbols-outlined text-on-surface-variant text-3xl">add_a_photo</span>
              )}
              <span className="text-on-surface-variant text-[10px] font-medium uppercase tracking-widest">
                {actionPhotoUrl ? "Change Photo" : "Action Photo"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="bg-surface-container-lowest rounded-xl border border-white/5 min-h-[80px] flex flex-col items-center justify-center gap-2 text-center transition-colors duration-200 hover:border-white/20"
            >
              {schoolLogoUrl ? (
                <img src={schoolLogoUrl} alt="School logo" className="w-12 h-12 rounded-lg object-contain" />
              ) : (
                <span className="material-symbols-outlined text-on-surface-variant text-3xl">school</span>
              )}
              <span className="text-on-surface-variant text-[10px] font-medium uppercase tracking-widest">
                {schoolLogoUrl ? "Change Logo" : "School Logo"}
              </span>
            </button>
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
            <InputCard label="Class Year" value={classYear} onChange={(v) => setAthlete({ classYear: v })} />
          </div>
        </div>
      </section>

      {/* Measurables */}
      <section>
        <SectionHeader title="Measurables" />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <InputCard label="Height" value={height} onChange={(v) => setAthlete({ height: v })} />
            <InputCard label="Weight" value={weight} onChange={(v) => setAthlete({ weight: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputCard label="40 Time" value={fortyTime} onChange={(v) => setAthlete({ fortyTime: v })} />
            <InputCard label="Vertical" value={vertical} onChange={(v) => setAthlete({ vertical: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputCard label="Wingspan" value={wingspan} onChange={(v) => setAthlete({ wingspan: v })} />
            <InputCard label="Hand Size" value={handSize} onChange={(v) => setAthlete({ handSize: v })} />
          </div>
        </div>
      </section>

      {/* ═══════════════ PROFILE FIELDS ═══════════════ */}
      <GroupHeader title="Profile Fields" />

      {/* Background */}
      <section>
        <SectionHeader title="Background" />
        <div className="space-y-4">
          <InputCard label="Hometown" value={hometown} onChange={(v) => setAthlete({ hometown: v })} />
          <InputCard label="High School" value={highSchool} onChange={(v) => setAthlete({ highSchool: v })} />
        </div>
      </section>

      {/* Story */}
      <section>
        <SectionHeader title="Story" />
        <div className="space-y-4">
          <InputCard label="Athlete Bio" value={bio} type="textarea" onChange={(v) => setAthlete({ bio: v })} />
          <InputCard label="Personal Quote" value={quote} type="textarea" onChange={(v) => setAthlete({ quote: v })} />
        </div>
      </section>

      {/* Eligibility */}
      <section>
        <SectionHeader title="Eligibility" />
        <div className="space-y-4">
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
      </section>

      {/* Commitment */}
      <section>
        <SectionHeader title="Commitment" />
        <div className="space-y-4">
          <SelectCard
            label="Commitment Status"
            value={commitmentStatus}
            options={[
              { value: "committed", label: "Committed" },
              { value: "uncommitted", label: "Uncommitted" },
              { value: "portal", label: "In Portal" },
            ]}
            onChange={(v) => setAthlete({ commitmentStatus: v as "committed" | "uncommitted" | "portal" })}
          />
        </div>
      </section>

      {/* Upcoming Game */}
      <section>
        <SectionHeader title="Upcoming Game" />
        <div className="space-y-4">
          <InputCard label="Opponent" value={game.opponent} onChange={(v) => setGame("opponent", v)} />
          <InputCard label="Date" value={game.date} onChange={(v) => setGame("date", v)} />
          <InputCard label="Time" value={game.time} onChange={(v) => setGame("time", v)} />
          <InputCard label="Network" value={game.network} onChange={(v) => setGame("network", v)} />
          <InputCard label="Location" value={game.location} onChange={(v) => setGame("location", v)} />
        </div>
      </section>
    </div>
  );
};
