import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";
import { useAthleteStore } from "@/store/athleteStore";

interface ActionItem {
  label: string;
  icon: string;
  done: boolean;
}

export function ProfilePreview() {
  const navigate = useNavigate();
  const { role, athleteTier, completeOnboarding } = useUserStore();
  const { firstName, lastName, position, number, school, schoolAbbrev, teamColor, actionPhotoUrl, bio, height, weight } = useAthleteStore();

  const actions: ActionItem[] = [
    { label: "Upload your action photo", icon: "add_a_photo", done: !!actionPhotoUrl },
    { label: "Write your bio", icon: "edit_note", done: bio.length >= 20 },
    { label: "Add your measurables", icon: "straighten", done: !!(height && weight) },
  ];

  const completedCount = actions.filter((a) => a.done).length;
  const completionPct = Math.round(((school ? 1 : 0) + (position ? 1 : 0) + completedCount) / 6 * 100);

  const handleComplete = () => {
    completeOnboarding();

    if (role === "athlete" && athleteTier === "college") {
      navigate("/builder");
    } else if (role === "coach" || role === "trainer") {
      navigate("/coach-dashboard");
    } else {
      navigate("/agency-dashboard");
    }
  };

  const displayName = firstName && lastName ? `${firstName} ${lastName}` : "Your Name";
  const tc = teamColor || "#50C4CA";

  return (
    <div className="space-y-8">
      <h1 className="text-on-surface font-black text-3xl md:text-4xl uppercase tracking-tight text-center">
        Your Profile Is Ready To Build
      </h1>

      {/* Mini ProCard */}
      <div className="flex justify-center">
        <div className="w-56 aspect-[3/4] rounded-xl overflow-hidden relative" style={{ boxShadow: `0 0 40px ${tc}30` }}>
          <div
            className="absolute top-0 left-0 right-0 h-7 z-10 flex items-center justify-center"
            style={{ backgroundColor: tc }}
          >
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-on-surface/90">
              {schoolAbbrev || school || "SCHOOL"}
            </span>
          </div>

          <div className="w-full h-[65%] bg-surface-container-high flex items-center justify-center">
            {actionPhotoUrl ? (
              <img src={actionPhotoUrl} alt="Action" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-on-surface/10 text-6xl">person</span>
            )}
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="text-on-surface font-black italic uppercase tracking-tighter text-base leading-none">
              {displayName}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: tc }}>
              {position || "POS"} {number ? `#${number}` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Completion */}
      <div className="text-center space-y-3">
        <div className="text-5xl font-black text-on-surface">{completionPct}%</div>
        <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${completionPct}%`, backgroundColor: "#50C4CA" }}
          />
        </div>
        <p className="text-on-surface-variant text-sm">Profile completion</p>
      </div>

      {/* Action items */}
      <div className="space-y-1">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant mb-3">
          Do These 3 Things First
        </h2>
        {actions.map((a) => (
          <div
            key={a.label}
            className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-high border border-outline-variant/10"
          >
            <span className="material-symbols-outlined text-lg" style={{ color: a.done ? "#50C4CA" : undefined }}>
              {a.done ? "check_circle" : "radio_button_unchecked"}
            </span>
            <span className={`text-sm font-medium flex-1 ${a.done ? "text-on-surface-variant line-through" : "text-on-surface"}`}>
              {a.label}
            </span>
            <span className="material-symbols-outlined text-on-surface-variant text-base">arrow_forward</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={handleComplete}
        className="w-full py-3.5 rounded-full font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-200"
        style={{ backgroundColor: "#50C4CA", color: "white" }}
      >
        Enter Brand HQ →
      </button>
    </div>
  );
}
