import { useMemo } from "react";
import { useAthleteStore } from "@/store/athleteStore";
import type { PulsePost } from "./PulseCard";

interface PulsePreviewProps {
  posts: PulsePost[];
}

const formatNumber = (n: number): string => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};

const MiniPostCard = ({ post }: { post: PulsePost }) => {
  const typeIcon: Record<string, string> = {
    news: "article",
    video: "play_circle",
    coach_mention: "sports",
    social: "alternate_email",
  };

  return (
    <div className="bg-surface-container rounded-lg border border-white/5 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "12px", color: "var(--team-color)" }}
        >
          {typeIcon[post.type] || "article"}
        </span>
        <span className="text-[8px] font-semibold uppercase tracking-widest text-on-surface-variant">
          @{post.username}
        </span>
        <span className="text-[8px] text-on-surface-variant/40 ml-auto">{post.timestamp}</span>
      </div>
      <p className="text-on-surface text-[10px] leading-relaxed line-clamp-2">{post.text}</p>
      {post.imageUrl && (
        <div className="mt-2 rounded overflow-hidden aspect-video bg-surface-container-lowest">
          <img
            src={post.imageUrl}
            alt=""
            className="w-full h-full object-cover opacity-80"
          />
          {post.videoUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-lg">play_arrow</span>
            </div>
          )}
        </div>
      )}
      <div className="flex items-center gap-3 mt-2">
        {post.likes !== undefined && (
          <div className="flex items-center gap-0.5">
            <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: "10px" }}>favorite</span>
            <span className="text-[8px] text-on-surface-variant/50">{formatNumber(post.likes)}</span>
          </div>
        )}
        {post.reposts !== undefined && (
          <div className="flex items-center gap-0.5">
            <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: "10px" }}>repeat</span>
            <span className="text-[8px] text-on-surface-variant/50">{formatNumber(post.reposts)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const MiniPinnedCard = ({ post }: { post: PulsePost }) => (
  <div
    className="bg-surface-container-high rounded-lg border border-white/5 p-2.5"
  >
    <div className="flex items-center gap-1 mb-1.5">
      <span className="material-symbols-outlined" style={{ fontSize: "10px", color: "var(--team-color)" }}>push_pin</span>
      <span className="text-[7px] font-semibold uppercase tracking-widest text-on-surface-variant">
        @{post.username}
      </span>
    </div>
    <p className="text-on-surface text-[9px] leading-snug line-clamp-3">{post.text}</p>
  </div>
);

export const PulsePreview = ({ posts }: PulsePreviewProps) => {
  const firstName = useAthleteStore((s) => s.firstName);
  const teamColor = useAthleteStore((s) => s.teamColor);
  const lastName = useAthleteStore((s) => s.lastName);

  const pinnedPosts = useMemo(() => posts.filter((p) => p.isPinned), [posts]);
  const feedPosts = useMemo(() => posts.filter((p) => !p.isPinned).slice(0, 4), [posts]);
  const athleteName = [firstName, lastName].filter(Boolean).join(" ") || "Athlete";
  const hasAnyPosts = posts.length > 0;

  return (
    <div className="flex flex-col items-center justify-center h-full py-4 px-4">
      {/* Phone Frame */}
      <div className="relative w-[380px] h-[calc(100%-2rem)] max-h-[680px] flex flex-col bg-black rounded-[40px] p-[3px]" style={{ boxShadow: `0 0 60px ${teamColor}55, 0 0 120px ${teamColor}22` }}>
        {/* Dynamic Island */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[100px] h-[28px] bg-black rounded-full z-20" />

        {/* Phone body */}
        <div className="w-full h-full bg-background rounded-[37px] border border-white/10 overflow-hidden flex flex-col">
          {/* Status bar */}
          <div className="h-8 flex items-end justify-between px-5 pb-0.5 bg-background">
            <span className="text-[9px] font-semibold text-on-surface">9:41</span>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-on-surface" style={{ fontSize: "10px" }}>signal_cellular_alt</span>
              <span className="material-symbols-outlined text-on-surface" style={{ fontSize: "10px" }}>wifi</span>
              <span className="material-symbols-outlined text-on-surface" style={{ fontSize: "10px" }}>battery_full</span>
            </div>
          </div>

          {/* App header */}
          <div
            className="h-10 px-4 flex items-center gap-2 shrink-0"
            style={{ backgroundColor: "var(--team-color)" }}
          >
            <span className="material-symbols-outlined text-white" style={{ fontSize: "14px" }}>monitoring</span>
            <div className="flex flex-col">
              <span className="text-white font-bold uppercase text-[9px] tracking-widest leading-none">
                Pulse
              </span>
              <span className="text-white/70 text-[7px] leading-none mt-0.5">{athleteName}</span>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-[7px] text-white/80 italic">Live</span>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto scroll-smooth scrollbar-thin px-3 py-3 space-y-3 min-h-0">
            {!hasAnyPosts ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: "20px" }}>monitoring</span>
                </div>
                <p className="text-on-surface text-[10px] font-semibold mb-1">No activity yet</p>
                <p className="text-on-surface-variant/50 text-[8px] leading-relaxed max-w-[180px]">
                  Mentions, news, and coach shoutouts will appear here in real time.
                </p>
              </div>
            ) : (
              <>
                {/* Pinned moments */}
                {pinnedPosts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 mb-2">
                      <span className="material-symbols-outlined" style={{ fontSize: "10px", color: "var(--team-color)" }}>push_pin</span>
                      <span className="text-[7px] font-semibold uppercase tracking-[0.3em] text-on-surface-variant">
                        Pinned
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {pinnedPosts.map((post) => (
                        <MiniPinnedCard key={post.id} post={post} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Filter pills */}
                <div className="flex gap-1.5">
                  {["All", "News", "Video", "Coaches"].map((label, i) => (
                    <span
                      key={label}
                      className={`px-2.5 py-1 rounded-full text-[7px] font-semibold uppercase tracking-widest ${
                        i === 0
                          ? "bg-on-surface text-surface"
                          : "bg-surface-container-high text-on-surface-variant/50"
                      }`}
                    >
                      {label}
                    </span>
                  ))}
                </div>

                {/* Feed */}
                <div className="space-y-2">
                  {feedPosts.map((post) => (
                    <MiniPostCard key={post.id} post={post} />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Bottom home indicator */}
          <div className="h-5 flex items-center justify-center bg-background">
            <div className="w-24 h-1 rounded-full bg-on-surface-variant/30" />
          </div>
        </div>
      </div>
    </div>
  );
};
