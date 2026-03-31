import TopNav from "@/components/TopNav";

export const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <TopNav />
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(39,45,50,0.4)_0%,_rgba(11,15,18,0)_70%)]" />
        <div className="relative text-center">
          <h1 className="font-black text-4xl uppercase tracking-tighter text-on-surface">
            PlayCoach
          </h1>
          <p className="mt-2 text-sm font-medium uppercase tracking-[0.4em] text-on-surface-variant">
            Foundation Ready
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
