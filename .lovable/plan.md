

## Add teamColor glow to Pulse phone preview

**What:** Apply the same dynamic teamColor shadow to the phone frame in PulsePreview that the ProCard uses on the Identity screen.

**File: `src/features/builder/components/PulsePreview.tsx`**

1. Read `teamColor` from the athlete store (already importing `useAthleteStore`).

2. On the phone frame div (line 95), replace the static `shadow-[0_20px_50px_rgba(0,0,0,0.5)]` class with an inline `style` that mirrors the ProCard's glow:
   ```
   boxShadow: `0 0 60px ${teamColor}55, 0 0 120px ${teamColor}22`
   ```

This produces the same ambient teamColor glow that surrounds the ProCard, dynamically updating when the athlete changes their school color.

