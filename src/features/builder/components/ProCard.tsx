import { useAthleteStore } from "@/store/athleteStore";

export const ProCard = () => {
  const {
    firstName, lastName, position, classYear, school, number,
    height, weight, fortyTime, actionPhotoUrl, schoolLogoUrl, teamColor,
  } = useAthleteStore();

  const hasName = firstName || lastName;
  const hasSchool = !!school;

  const formatHeight = (val: string) => {
    const total = parseInt(val, 10);
    if (!total) return "—";
    return `${Math.floor(total / 12)}'${total % 12}"`;
  };

  const physicals = [
    { label: "HEIGHT", value: height ? formatHeight(height) : "0'0\"" },
    { label: "WEIGHT", value: weight ? weight.replace(/\s*lbs?/i, "") : "0" },
    { label: "40 TIME", value: fortyTime || "0.0" },
  ];

  return (
    <div className="flex flex-col items-center">

      {/* Card */}
      <div
        className="w-full max-w-sm aspect-[3/4] rounded-[12px] overflow-hidden bg-surface-container-high relative group"
        style={{ boxShadow: `0 0 60px ${teamColor}55, 0 0 120px ${teamColor}22` }}
      >
        {/* Photo area */}
        {actionPhotoUrl ? (
          <img
            src={actionPhotoUrl}
            alt={`${firstName} ${lastName}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute top-8 bottom-[40%] left-0 right-0 flex items-center justify-center z-[1]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 200" className="h-[120px] opacity-[0.07]" fill="currentColor" style={{ color: 'white' }}>
              <ellipse cx="60" cy="18" rx="14" ry="16" />
              <path d="M60 36c-12 0-22 8-26 20l-6 28c-1 4 2 7 5 7s6-3 7-6l4-16 4 14v72c0 5 4 9 8 9s8-4 8-9v-40h4v40c0 5 4 9 8 9s8-4 8-9V83l4-14 4 16c1 3 4 6 7 6s6-3 5-7l-6-28c-4-12-14-20-26-20z" />
            </svg>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-transparent" />

        {/* School color banner */}
        <div
          className="absolute top-0 left-0 right-0 h-8 z-10 flex items-center justify-center"
          style={{ backgroundColor: "var(--team-color)" }}
        >
          {hasSchool ? (
            <span className="text-[11px] font-black tracking-[0.25em] uppercase text-white/90">
              {school}
            </span>
          ) : (
            <span className="text-[11px] font-black tracking-[0.25em] uppercase text-white/70">
              Enter Your School
            </span>
          )}
        </div>

        {/* School logo — only when uploaded */}
        {schoolLogoUrl && (
          <div className="absolute bottom-3 right-3 z-10 w-10 h-10 rounded-lg flex items-center justify-center opacity-40">
            <img src={schoolLogoUrl} alt="School logo" className="w-full h-full object-contain" />
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
          {/* Position + Jersey + Class Year badges */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-[3px]"
              style={{ backgroundColor: "var(--team-color)", color: "white" }}
            >
              {position || "--"}
            </span>
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-[3px]"
              style={{ backgroundColor: "var(--team-color)", color: "white" }}
            >
              #{number || "--"}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-[3px] border border-white/20 text-on-surface-variant">
              Class of {classYear || "--"}
            </span>
          </div>

          {/* Athlete name */}
          {hasName ? (
            <h3 className="font-black italic uppercase tracking-tighter text-on-surface text-4xl leading-[0.9]">
              {firstName} {lastName}
            </h3>
          ) : (
            <h3 className="font-black italic uppercase tracking-tighter text-on-surface/40 text-4xl leading-[0.9]">
              Your Name
            </h3>
          )}

          {/* Physical attributes row */}
          <div className="flex gap-5 mt-3 border-t border-white/10 pt-3">
            {physicals.map((attr) => (
              <div key={attr.label}>
                <span className="text-[10px] uppercase tracking-widest text-on-surface-variant block">
                  {attr.label}
                </span>
                <span className={`font-black text-xl ${["0'0\"", "0", "0.0"].includes(attr.value) ? "text-on-surface/40" : "text-on-surface"}`}>
                  {attr.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};
