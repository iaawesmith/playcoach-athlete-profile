import { useAthleteStore } from "@/store/athleteStore";

const positionLabelMap: Record<string, string> = {
  QB: "Quarterback",
  RB: "Running Back",
  FB: "Fullback",
  WR: "Wide Receiver",
  TE: "Tight End",
  OL: "Offensive Line",
  DL: "Defensive Line",
  LB: "Linebacker",
  CB: "Cornerback",
  S: "Safety",
  K: "Kicker",
  P: "Punter",
  LS: "Long Snapper",
};

const ShieldPlaceholder = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-5 h-5 text-on-surface-variant"
  >
    <path
      d="M12 2L4 6V12C4 17 7.6 21.5 12 22.5C16.4 21.5 20 17 20 12V6L12 2Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

export const ProCard = () => {
  const {
    firstName, lastName, position, classYear, school,
    height, weight, actionPhotoUrl, schoolLogoUrl,
  } = useAthleteStore();
  const positionLabel = positionLabelMap[position] ?? position;

  const physicals = [
    { label: "HEIGHT", value: height },
    { label: "WEIGHT", value: weight.replace(/\s*lbs?/i, "") },
    { label: "40-YD", value: "4.42" },
  ];

  return (
    <div className="flex flex-col items-center">

      {/* Card */}
      <div className="team-glow w-full max-w-sm aspect-[3/4] rounded-[12px] overflow-hidden bg-surface-container-high relative group">
        {/* Photo area */}
        {actionPhotoUrl ? (
          <img
            src={actionPhotoUrl}
            alt={`${firstName} ${lastName}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute top-8 bottom-[40%] left-0 right-0 flex items-center justify-center z-[1]">
            <span className="text-on-surface-variant/40 text-sm font-semibold uppercase tracking-widest">
              Add Your Action Photo
            </span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-transparent" />

        {/* School color banner */}
        <div
          className="absolute top-0 left-0 right-0 h-8 z-10 flex items-center justify-center"
          style={{ backgroundColor: "var(--team-color)" }}
        >
          <span className="text-[9px] font-black tracking-[0.25em] uppercase text-white/90">
            {school}
          </span>
        </div>

        {/* School logo — lower right */}
        <div className="absolute bottom-3 right-3 z-10 w-10 h-10 rounded-lg flex items-center justify-center opacity-40">
          {schoolLogoUrl ? (
            <img src={schoolLogoUrl} alt="School logo" className="w-full h-full object-contain" />
          ) : (
            <ShieldPlaceholder />
          )}
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
          {/* Position + Class Year badges */}
          <div className="flex items-center gap-5 mb-5">
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-[3px]"
              style={{ backgroundColor: "var(--team-color)", color: "white" }}
            >
              {positionLabel}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-[3px] border border-white/20 text-on-surface-variant">
              Class of {classYear}
            </span>
          </div>

          {/* Athlete name */}
          <h3 className="font-black italic uppercase tracking-tighter text-on-surface text-5xl leading-[0.9]">
            {firstName}
          </h3>
          <h3 className="font-black italic uppercase tracking-tighter text-on-surface text-5xl leading-[0.9] mt-0.5">
            {lastName}
          </h3>

          {/* Physical attributes row */}
          <div className="flex gap-5 mt-3 border-t border-white/10 pt-3">
            {physicals.map((attr) => (
              <div key={attr.label}>
                <span className="text-[10px] uppercase tracking-widest text-on-surface-variant block">
                  {attr.label}
                </span>
                <span className="text-on-surface font-black text-xl">{attr.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};
