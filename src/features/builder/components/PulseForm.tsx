import { useState, useMemo } from "react";
import { useAthleteStore } from "@/store/athleteStore";
import { PulseCard, type PulsePost } from "./PulseCard";
import { PinnedMoments } from "./PinnedMoments";

const filters = [
  { key: "all", label: "All" },
  { key: "news", label: "News" },
  { key: "video", label: "Videos" },
  { key: "coach_mention", label: "Coach Mentions" },
] as const;

type FilterKey = (typeof filters)[number]["key"];

const placeholderPosts: PulsePost[] = [
  {
    id: "1",
    type: "coach_mention",
    text: "Really impressed with what I saw on film this week. Elite route runner with the ability to separate at every level. This kid is a problem for defensive coordinators.",
    source: "X",
    username: "CoachMikeTX",
    timestamp: "2h ago",
    likes: 342,
    reposts: 89,
    isPinned: true,
  },
  {
    id: "2",
    type: "news",
    text: "Breaking: 4-star wide receiver commits to program, becoming the highest-rated recruit in the 2026 class. Scouts praise elite speed and route-running ability.",
    source: "247Sports",
    username: "247recruiting",
    timestamp: "4h ago",
    imageUrl: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=600&q=80",
    likes: 1200,
    reposts: 430,
  },
  {
    id: "3",
    type: "video",
    text: "Senior season highlights reel is INSANE. 12 TDs in 8 games. Watch the full breakdown 🎬🔥",
    source: "X",
    username: "PrepRedZone",
    timestamp: "6h ago",
    imageUrl: "https://images.unsplash.com/photo-1508098682722-e99c643e7f0b?w=600&q=80",
    videoUrl: "#",
    likes: 856,
    reposts: 210,
  },
  {
    id: "4",
    type: "social",
    text: "Blessed to receive an offer from the University of Georgia! 🐶 All glory to God. #GoDawgs",
    source: "X",
    username: "athlete_official",
    timestamp: "1d ago",
    likes: 2400,
    reposts: 580,
    isPinned: true,
  },
  {
    id: "5",
    type: "coach_mention",
    text: "Had a great conversation with this young man today. Character, work ethic, and talent — the full package. One to watch this season.",
    source: "X",
    username: "CoachJohnsonSEC",
    timestamp: "2d ago",
    likes: 198,
    reposts: 45,
  },
  {
    id: "6",
    type: "news",
    text: "Updated 2026 recruiting rankings released. Several notable risers in the latest evaluation period including multiple WR prospects with elite measurables.",
    source: "On3",
    username: "On3Recruits",
    timestamp: "3d ago",
    likes: 670,
    reposts: 156,
  },
];

export const PulseForm = () => {
  const firstName = useAthleteStore((s) => s.firstName);
  const lastName = useAthleteStore((s) => s.lastName);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [posts, setPosts] = useState<PulsePost[]>(placeholderPosts);

  const pinnedPosts = useMemo(() => posts.filter((p) => p.isPinned), [posts]);

  const filteredPosts = useMemo(() => {
    const unpinned = posts.filter((p) => !p.isPinned);
    if (activeFilter === "all") return unpinned;
    return unpinned.filter((p) => p.type === activeFilter);
  }, [posts, activeFilter]);

  const handlePin = (id: string) => {
    setPosts((prev) => {
      const pinned = prev.filter((p) => p.isPinned).length;
      if (pinned >= 3) return prev;
      return prev.map((p) => (p.id === id ? { ...p, isPinned: true } : p));
    });
  };

  const handleUnpin = (id: string) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, isPinned: false } : p)));
  };

  const hasAnyPosts = posts.length > 0;
  const athleteName = [firstName, lastName].filter(Boolean).join(" ") || "this athlete";

  return (
    <div className="space-y-8 pb-24">
      {/* Section Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="w-8 h-[1px]" style={{ backgroundColor: "var(--team-color)" }} />
          <h3 className="text-on-surface font-extrabold uppercase text-sm tracking-wide">
            Pulse
          </h3>
          <span className="text-on-surface-variant/40 text-xs font-normal normal-case">
            • What's happening right now
          </span>
        </div>
        <div className="flex items-center gap-2 ml-11">
          <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: "14px" }}>schedule</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-on-surface-variant/50">
            Last updated just now
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
        </div>
      </div>

      {!hasAnyPosts ? (
        /* Empty State */
        <div className="rounded-xl border border-white/5 bg-surface-container p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-5">
            <span className="material-symbols-outlined text-on-surface-variant/30 text-3xl">monitoring</span>
          </div>
          <h4 className="text-on-surface font-bold text-base mb-2">No recent mentions yet</h4>
          <p className="text-on-surface-variant/60 text-sm max-w-sm leading-relaxed">
            When coaches, scouts, or news talk about {athleteName} on X, they'll appear here automatically.
          </p>
          <button
            className="mt-6 px-5 py-2.5 rounded-full glass-card border border-outline-variant/20 text-on-surface text-xs font-black uppercase tracking-[0.2em] transition-all duration-150 active:scale-95 hover:border-white/20"
          >
            Connect X Account
          </button>
        </div>
      ) : (
        <>
          {/* Pinned Moments */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--team-color)" }}>push_pin</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant">
                Pinned Moments
              </span>
              <span className="text-[10px] text-on-surface-variant/40">{pinnedPosts.length}/3</span>
            </div>
            <PinnedMoments posts={pinnedPosts} onUnpin={handleUnpin} />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`px-4 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-widest transition-all duration-150 active:scale-95 ${
                  activeFilter === f.key
                    ? "text-surface bg-on-surface"
                    : "text-on-surface-variant/60 bg-surface-container-high hover:text-on-surface-variant hover:bg-surface-container-highest"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Feed */}
          <div className="space-y-4">
            {filteredPosts.length > 0 ? (
              filteredPosts.map((post) => (
                <PulseCard key={post.id} post={post} onPin={handlePin} onUnpin={handleUnpin} />
              ))
            ) : (
              <div className="rounded-xl border border-white/5 bg-surface-container p-8 text-center">
                <span className="material-symbols-outlined text-on-surface-variant/20 text-2xl mb-2">filter_list</span>
                <p className="text-on-surface-variant/50 text-sm">No posts match this filter</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
