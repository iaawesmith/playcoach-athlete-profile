import { useAthleteStore } from "@/store/athleteStore";

const MeasurableTile = ({ label, value }: { label: string; value: string }) => {
  const hasValue = value && value !== "—";
  return (
    <div className="bg-surface-container border border-outline-variant/10 rounded-xl p-3 flex flex-col items-center justify-center">
      <span
        className="text-[9px] font-bold uppercase tracking-widest mb-1"
        style={{ color: "var(--team-color)" }}
      >
        {label}
      </span>
      <span className={`font-black text-xl ${hasValue ? "text-on-surface" : "text-on-surface-variant/30"}`}>
        {hasValue ? value : "—"}
      </span>
    </div>
  );
};

const commitmentLabels: Record<string, string> = {
  committed: "Committed",
  uncommitted: "Uncommitted",
  portal: "In Portal",
};

export const IdentityPreview = () => {
  const {
    height, weight, fortyTime, vertical, wingspan, handSize,
    starRating, nationalRank, positionRank, commitmentStatus,
    eligibilityYears, transferEligible, redshirtStatus,
    upcomingGame, bio, quote, hometown, highSchool,
  } = useAthleteStore();

  return (
    <div className="w-full max-w-sm mx-auto space-y-6 mt-6 pb-8">

      {/* Measurables Grid */}
      <div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant block mb-3">
          Measurables
        </span>
        <div className="grid grid-cols-3 gap-2">
          <MeasurableTile label="HT" value={height} />
          <MeasurableTile label="WT" value={weight.replace(/\s*lbs?/i, "")} />
          <MeasurableTile label="40-YD" value={fortyTime} />
          <MeasurableTile label="Vertical" value={vertical} />
          <MeasurableTile label="Wingspan" value={wingspan} />
          <MeasurableTile label="Hand Size" value={handSize} />
        </div>
      </div>

      {/* Recruiting Block */}
      <div className="bg-surface-container border border-outline-variant/10 rounded-xl p-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant block mb-3">
          Recruiting
        </span>
        {/* Stars */}
        <div className="flex items-center gap-0.5 mb-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className="material-symbols-outlined text-lg"
              style={{ color: i < starRating ? "var(--team-color)" : undefined }}
            >
              {i < starRating ? "star" : "star"}
            </span>
          ))}
          <span className="text-on-surface-variant text-xs ml-2">{starRating}-Star</span>
        </div>
        {/* Ranks */}
        <div className="flex items-center gap-4 mb-3 text-sm">
          <div>
            <span className="text-[9px] uppercase tracking-widest text-on-surface-variant block">National</span>
            <span className={`font-black ${nationalRank ? "text-on-surface" : "text-on-surface-variant/30"}`}>
              {nationalRank ? `#${nationalRank}` : "Not ranked"}
            </span>
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-widest text-on-surface-variant block">Position</span>
            <span className={`font-black ${positionRank ? "text-on-surface" : "text-on-surface-variant/30"}`}>
              {positionRank ? `#${positionRank}` : "Not ranked"}
            </span>
          </div>
        </div>
        {/* Commitment */}
        <span
          className="inline-block text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
          style={
            commitmentStatus === "committed"
              ? { backgroundColor: "var(--team-color)", color: "white" }
              : undefined
          }
        >
          {commitmentLabels[commitmentStatus] ?? commitmentStatus}
        </span>
      </div>

      {/* Eligibility Block */}
      <div className="bg-surface-container border border-outline-variant/10 rounded-xl p-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant block mb-3">
          Eligibility
        </span>
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-[9px] uppercase tracking-widest text-on-surface-variant block">Years Left</span>
            <span className="text-on-surface font-black">{eligibilityYears}</span>
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-widest text-on-surface-variant block">Transfer</span>
            <span className={`font-bold text-xs uppercase ${transferEligible ? "text-primary" : "text-on-surface-variant/50"}`}>
              {transferEligible ? "Eligible" : "No"}
            </span>
          </div>
          {redshirtStatus !== "None" && (
            <div>
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant block">Redshirt</span>
              <span className="text-on-surface font-bold text-xs">{redshirtStatus}</span>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Game */}
      <div
        className="bg-surface-container border-l-2 rounded-xl p-4"
        style={{ borderLeftColor: "var(--team-color)" }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant block mb-3">
          Upcoming Game
        </span>
        {upcomingGame ? (
          <div className="space-y-1 text-sm">
            <span className="text-on-surface font-black text-lg block">
              vs {upcomingGame.opponent}
            </span>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-on-surface-variant text-xs">
              <span>{upcomingGame.date}</span>
              <span>{upcomingGame.time}</span>
              <span>{upcomingGame.network}</span>
              <span>{upcomingGame.location}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-on-surface-variant/40">
            <span className="material-symbols-outlined text-xl">event</span>
            <span className="text-xs uppercase tracking-widest">No upcoming game scheduled</span>
          </div>
        )}
      </div>

      {/* Bio + Quote */}
      <div className="space-y-4">
        {bio ? (
          <p className="text-on-surface text-sm leading-relaxed">{bio}</p>
        ) : (
          <p className="text-on-surface-variant/30 text-sm italic">Add your bio in the editor</p>
        )}
        {quote ? (
          <blockquote
            className="border-l-2 pl-4 italic text-on-surface-variant text-sm"
            style={{ borderLeftColor: "var(--team-color)" }}
          >
            "{quote}"
          </blockquote>
        ) : (
          <p className="text-on-surface-variant/30 text-sm italic">Add a personal quote</p>
        )}
      </div>

      {/* Hometown + High School */}
      <div className="text-on-surface-variant text-xs uppercase tracking-widest">
        {hometown || highSchool ? (
          <span>
            {hometown}{hometown && highSchool && " · "}{highSchool}
          </span>
        ) : (
          <span className="text-on-surface-variant/30">Add your hometown</span>
        )}
      </div>
    </div>
  );
};
