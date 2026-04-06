import { useState } from "react";

export interface PulsePost {
  id: string;
  type: "news" | "video" | "coach_mention" | "social";
  text: string;
  source: string;
  username: string;
  timestamp: string;
  imageUrl?: string;
  videoUrl?: string;
  likes?: number;
  reposts?: number;
  isPinned?: boolean;
}

interface PulseCardProps {
  post: PulsePost;
  onPin?: (id: string) => void;
  onUnpin?: (id: string) => void;
  compact?: boolean;
}

const formatNumber = (n: number): string => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};

export const PulseCard = ({ post, onPin, onUnpin, compact }: PulseCardProps) => {
  const [imgError, setImgError] = useState(false);

  const typeIcon: Record<string, string> = {
    news: "article",
    video: "play_circle",
    coach_mention: "sports",
    social: "alternate_email",
  };

  const typeLabel: Record<string, string> = {
    news: "News",
    video: "Video",
    coach_mention: "Coach Mention",
    social: "Social",
  };

  return (
    <div
      className={`bg-surface-container rounded-xl border border-white/5 transition-all duration-200 hover:border-white/10 ${
        compact ? "p-4" : "p-5"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-base"
            style={{ color: "var(--team-color)" }}
          >
            {typeIcon[post.type] || "article"}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-on-surface-variant">
            {typeLabel[post.type] || "Post"}
          </span>
          <span className="text-[10px] text-on-surface-variant/50">•</span>
          <span className="text-[10px] text-on-surface-variant/60">{post.timestamp}</span>
        </div>

        {post.isPinned ? (
          <button
            onClick={() => onUnpin?.(post.id)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-high border border-white/10 text-[10px] font-semibold uppercase tracking-widest transition-all duration-150 active:scale-95"
            style={{ color: "var(--team-color)" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>push_pin</span>
            Pinned
          </button>
        ) : (
          <button
            onClick={() => onPin?.(post.id)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-surface-container-high text-[10px] font-semibold uppercase tracking-widest transition-all duration-150 active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>push_pin</span>
            Pin
          </button>
        )}
      </div>

      {/* Post text */}
      <p className={`text-on-surface text-sm leading-relaxed ${compact ? "line-clamp-2" : "line-clamp-4"}`}>
        {post.text}
      </p>

      {/* Media */}
      {post.imageUrl && !imgError && (
        <div className="mt-3 rounded-lg overflow-hidden bg-surface-container-lowest aspect-video relative group">
          <img
            src={post.imageUrl}
            alt=""
            className="w-full h-full object-cover transition-all duration-700 grayscale group-hover:grayscale-0"
            onError={() => setImgError(true)}
          />
          {post.videoUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full glass-card flex items-center justify-center border border-white/20">
                <span className="material-symbols-outlined text-white text-2xl">play_arrow</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-on-surface-variant/50" style={{ fontSize: "14px" }}>person</span>
          <span className="text-[11px] text-on-surface-variant font-medium">@{post.username}</span>
          <span className="text-[10px] text-on-surface-variant/40">via {post.source}</span>
        </div>

        <div className="flex items-center gap-3">
          {post.likes !== undefined && (
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: "14px" }}>favorite</span>
              <span className="text-[11px] text-on-surface-variant/60">{formatNumber(post.likes)}</span>
            </div>
          )}
          {post.reposts !== undefined && (
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: "14px" }}>repeat</span>
              <span className="text-[11px] text-on-surface-variant/60">{formatNumber(post.reposts)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
