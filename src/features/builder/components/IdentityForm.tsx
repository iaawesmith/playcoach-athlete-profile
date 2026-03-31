const positions = ["QB", "RB", "FB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P", "LS"];
const activePosition = "WR";

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

const InputCard = ({ label, value, type = "text" }: { label: string; value: string; type?: string }) => (
  <div
    className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 transition-colors duration-200 input-card-focus"
  >
    <label className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant block mb-2">
      {label}
    </label>
    {type === "textarea" ? (
      <textarea
        className="w-full bg-transparent text-on-surface text-sm font-normal resize-none outline-none min-h-[80px]"
        defaultValue={value}
        readOnly
      />
    ) : (
      <input
        className="w-full bg-transparent text-on-surface text-sm font-normal outline-none"
        defaultValue={value}
        readOnly
        type={type}
      />
    )}
  </div>
);

export const IdentityForm = () => {
  return (
    <div className="space-y-10">
      {/* Your Identity */}
      <section>
        <SectionHeader title="Your Identity" />
        <div className="space-y-4">
          <InputCard label="First Name" value="Marcus" />
          <InputCard label="Last Name" value="Sterling" />
          <InputCard
            label="Athlete Bio"
            value="Elite-tier wide receiver specializing in deep vertical threat scenarios. 3-year varsity starter with record-breaking explosive metrics."
            type="textarea"
          />
        </div>
      </section>

      {/* School & Colors */}
      <section>
        <SectionHeader title="School & Colors" />
        <div className="space-y-4">
          <InputCard label="School Name" value="University of Georgia" />
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 transition-colors duration-200 input-card-focus">
            <label className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant block mb-2">
              School Color
            </label>
            <div className="flex items-center gap-3">
              <input
                className="flex-1 bg-transparent text-on-surface text-sm font-normal outline-none"
                defaultValue="#00e639"
                readOnly
                type="text"
              />
              <div
                className="w-6 h-6 flex-shrink-0 rounded"
                style={{ backgroundColor: "#00e639" }}
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
          <div className="bg-surface-container-lowest rounded-xl border border-white/5 p-6 flex items-center gap-4">
            <span className="material-symbols-outlined text-on-surface-variant text-2xl">add_a_photo</span>
            <span className="text-on-surface-variant text-sm font-medium uppercase tracking-wide">
              Upload Action Photo
            </span>
          </div>
          <div className="bg-surface-container-lowest rounded-xl border border-white/5 p-6 flex items-center gap-4">
            <span className="material-symbols-outlined text-on-surface-variant text-2xl">school</span>
            <span className="text-on-surface-variant text-sm font-medium uppercase tracking-wide">
              Upload School Logo
            </span>
          </div>
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
                <span
                  key={pos}
                  className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.2em] transition-all duration-200 ${
                    pos === activePosition
                      ? "text-[#00460a] kinetic-gradient"
                      : "text-on-surface-variant bg-surface-container-high"
                  }`}
                >
                  {pos}
                </span>
              ))}
            </div>
          </div>

          <InputCard label="Jersey #" value="84" />
          <InputCard label="Class Year" value="2025" />
        </div>
      </section>

      {/* Bottom CTAs */}
      <div className="flex items-center gap-3 pt-4">
        <button className="flex-1 h-11 rounded-full border border-outline-variant text-on-surface font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-150">
          Discard Changes
        </button>
        <button className="flex-1 h-11 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-150">
          Save Identity
        </button>
      </div>
    </div>
  );
};
