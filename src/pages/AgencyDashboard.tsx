import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";

export function AgencyDashboard() {
  const navigate = useNavigate();
  const { reset } = useUserStore();

  const handleBack = () => {
    reset();
    navigate("/onboarding");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(39,45,50,0.4)_0%,_rgba(11,15,18,0)_70%)] pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <span className="text-on-surface font-black text-2xl uppercase tracking-tight">PlayCoach</span>
        <div className="bg-surface-container rounded-xl p-12 flex flex-col items-center gap-4 border border-outline-variant/10">
          <span className="material-symbols-outlined text-on-surface-variant text-5xl">business_center</span>
          <h1 className="text-on-surface font-black text-xl uppercase tracking-[0.2em]">Agency Dashboard</h1>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant bg-surface-container-highest px-3 py-1 rounded-full">
            Coming Soon
          </span>
        </div>
        <button
          onClick={handleBack}
          className="text-on-surface-variant text-sm font-medium hover:text-on-surface transition-colors duration-200"
        >
          ← Back to onboarding
        </button>
      </div>
    </div>
  );
}
