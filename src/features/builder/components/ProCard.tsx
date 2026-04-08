import { useAthleteStore } from "@/store/athleteStore";

export const ProCard = () => {
  const {
    firstName, lastName, position, classYear, school, number,
    height, weight, actionPhotoUrl, schoolLogoUrl, teamColor,
    ratingComposite, transferRating247, prospectRating247,
    transferOvrRank247, transferPositionRank247,
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
    { label: "RATING", value: transferRating247 ? String(transferRating247) : prospectRating247 ? String(prospectRating247) : ratingComposite || "—" },
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
        ) : null}

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
              {classYear || "--"}
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
                <span className={`font-black text-xl ${["0'0\"", "0", "—"].includes(attr.value) ? "text-on-surface/40" : "text-on-surface"}`}>
                  {attr.value}
                </span>
              </div>
            ))}
          </div>

          {/* Rank badges */}
          {(transferOvrRank247 || transferPositionRank247) && (
            <div className="flex gap-3 mt-2">
              {transferOvrRank247 && (
                <span className="text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-[3px] border border-white/15 text-on-surface-variant">
                  OVR #{transferOvrRank247}
                </span>
              )}
              {transferPositionRank247 && (
                <span className="text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-[3px] border border-white/15 text-on-surface-variant">
                  {position || "Pos"} #{transferPositionRank247}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
