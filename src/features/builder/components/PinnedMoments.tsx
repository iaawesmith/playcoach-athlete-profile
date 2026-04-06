import { PulseCard, type PulsePost } from "./PulseCard";

interface PinnedMomentsProps {
  posts: PulsePost[];
  onUnpin: (id: string) => void;
}

export const PinnedMoments = ({ posts, onUnpin }: PinnedMomentsProps) => {
  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-surface-container p-6 flex items-center gap-4">
        <span className="material-symbols-outlined text-on-surface-variant/30 text-3xl">push_pin</span>
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {posts.slice(0, 3).map((post) => (
        <PulseCard key={post.id} post={post} onUnpin={onUnpin} compact />
      ))}
    </div>
  );
};
