import { PulseCard, type PulsePost } from "./PulseCard";

interface PinnedMomentsProps {
  posts: PulsePost[];
  onUnpin: (id: string) => void;
}

export const PinnedMoments = ({ posts, onUnpin }: PinnedMomentsProps) => {
  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-surface-container p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-on-surface-variant/30 text-xl">push_pin</span>
        </div>
        <div>
          <p className="text-on-surface text-sm font-medium">No pinned moments yet</p>
          <p className="text-on-surface-variant/60 text-xs mt-0.5">
            Pin your best mentions to showcase them at the top of your Pulse feed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
      {posts.slice(0, 3).map((post) => (
        <div key={post.id} className="min-w-[260px] max-w-[300px] flex-shrink-0">
          <PulseCard post={post} onUnpin={onUnpin} compact />
        </div>
      ))}
    </div>
  );
};
