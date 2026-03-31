import { useLocation } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 font-black text-5xl uppercase tracking-tighter text-on-surface">404</h1>
        <p className="mb-6 text-sm font-medium uppercase tracking-[0.4em] text-on-surface-variant">
          Route not found: {location.pathname}
        </p>
        <a
          href="/"
          className="inline-flex h-11 items-center rounded-full px-6 font-black text-xs uppercase tracking-[0.2em] text-on-surface border border-outline-variant/20 transition-all hover:border-white/20 active:scale-95"
        >
          Return Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
