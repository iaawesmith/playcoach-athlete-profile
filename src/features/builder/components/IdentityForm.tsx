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

export const IdentityForm = () => {
  const {
    firstName, lastName, bio, school, teamColor,
    position, number, classYear, hometown, height, weight,
    actionPhotoUrl, schoolLogoUrl, setAthlete, resetToDefaults,
  } = useAthleteStore();

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

  return (
    <div className="space-y-10">
      {/* Your Identity */}
      <section>
        <SectionHeader title="Your Identity" />
        <div className="space-y-4">
          <InputCard label="First Name" value={firstName} onChange={(v) => setAthlete({ firstName: v })} />
          <InputCard label="Last Name" value={lastName} onChange={(v) => setAthlete({ lastName: v })} />
          <InputCard
            label="Athlete Bio"
            value={bio}
            type="textarea"
            onChange={(v) => setAthlete({ bio: v })}
          />
        </div>
      </section>

      {/* School & Colors */}
      <section>
        <SectionHeader title="School & Colors" />
        <div className="space-y-4">
          <InputCard label="School Name" value={school} onChange={(v) => setAthlete({ school: v })} />
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 transition-colors duration-200 input-card-focus">
            <label className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant block mb-2">
              School Color
            </label>
            <div className="flex items-center gap-3">
              <input
                className="flex-1 bg-transparent text-on-surface text-sm font-normal outline-none"
                value={teamColor}
                onChange={(e) => setAthlete({ teamColor: e.target.value })}
                type="text"
              />
              <div
                className="w-6 h-6 flex-shrink-0 rounded"
                style={{ backgroundColor: teamColor }}
              />
            </div>
            <p className="text-[10px] text-on-surface-variant mt-2">
              Sets your card and profile accent color
            </p>
          </div>
        </div>
      </section>

      {/* Your Media */}
      <section>
        <SectionHeader title="Your Media" />
        <div className="space-y-4">
          {/* Action Photo Upload */}
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="w-full bg-surface-container-lowest rounded-xl border border-white/5 p-6 flex items-center gap-4 text-left transition-colors duration-200 hover:border-white/20"
          >
            {actionPhotoUrl ? (
              <img src={actionPhotoUrl} alt="Action photo" className="w-12 h-12 rounded-lg object-cover" />
            ) : (
              <span className="material-symbols-outlined text-on-surface-variant text-2xl">add_a_photo</span>
            )}
            <span className="text-on-surface-variant text-sm font-medium uppercase tracking-wide">
              {actionPhotoUrl ? "Change Action Photo" : "Upload Action Photo"}
            </span>
          </button>

          {/* School Logo Upload */}
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            className="w-full bg-surface-container-lowest rounded-xl border border-white/5 p-6 flex items-center gap-4 text-left transition-colors duration-200 hover:border-white/20"
          >
            {schoolLogoUrl ? (
              <img src={schoolLogoUrl} alt="School logo" className="w-12 h-12 rounded-lg object-contain" />
            ) : (
              <span className="material-symbols-outlined text-on-surface-variant text-2xl">school</span>
            )}
            <span className="text-on-surface-variant text-sm font-medium uppercase tracking-wide">
              {schoolLogoUrl ? "Change School Logo" : "Upload School Logo"}
            </span>
          </button>
        </div>
      </section>

      {/* Player Details */}
      <section>
        <SectionHeader title="Player Details" />
        <div className="space-y-4">
          {/* Position Chips */}
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

          <InputCard label="Jersey #" value={number} onChange={(v) => setAthlete({ number: v })} />
          <InputCard label="Class Year" value={classYear} onChange={(v) => setAthlete({ classYear: v })} />
          <InputCard label="Hometown" value={hometown} onChange={(v) => setAthlete({ hometown: v })} />
          <div className="grid grid-cols-2 gap-4">
            <InputCard label="Height" value={height} onChange={(v) => setAthlete({ height: v })} />
            <InputCard label="Weight" value={weight} onChange={(v) => setAthlete({ weight: v })} />
          </div>
        </div>
      </section>

      {/* Bottom CTAs */}
      <div className="flex items-center gap-3 pt-4">
        <button
          type="button"
          onClick={resetToDefaults}
          className="flex-1 h-11 rounded-full border border-outline-variant text-on-surface font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-150"
        >
          Discard Changes
        </button>
        <button
          type="button"
          className="flex-1 h-11 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-150"
        >
          Save Identity
        </button>
      </div>
    </div>
  );
};
