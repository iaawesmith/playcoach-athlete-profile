

## Make Pulse phone preview larger with iPhone 17 styling

**What changes:** Update `PulsePreview.tsx` to make the phone frame fill most of the preview column height, matching the visual weight of the ProCard on the Identity screen. Update the frame to resemble an iPhone 17 (Dynamic Island instead of notch, thinner bezels, taller aspect ratio ~19.5:9).

**File: `src/features/builder/components/PulsePreview.tsx`**

1. **Outer container** (line 93): Change from fixed `w-[280px] max-h-[520px]` to responsive height-filling: `w-[320px] h-[calc(100%-2rem)]` with a reasonable `max-h-[680px]` so it fills the preview column top-to-bottom.

2. **Dynamic Island** (line 97): Replace the wide notch (`w-24 h-5 rounded-b-xl`) with a smaller pill shape: `w-[100px] h-[28px] rounded-full bg-black absolute top-2 left-1/2 -translate-x-1/2 z-20` — mimicking the iPhone Dynamic Island.

3. **Phone body** (line 100): Update `rounded-[24px]` to `rounded-[40px]` for the more aggressive iPhone 17 corner radius. Remove the `max-h-[520px]` constraint. Add thinner bezel simulation with slightly more internal padding at top.

4. **Phone inner chrome**: Remove the old `max-h-[520px]` on the body div so it stretches with the parent. The scrollable content area already has `flex-1 overflow-y-auto` so it will fill naturally.

5. **Bottom home indicator** (line ~188): Keep the swipe bar but ensure it sits cleanly at the bottom of the taller frame.

6. **Outer wrapper** (line 93): Change `py-6` to `py-4` so the phone sits closer to edges vertically.

No other files need changes — the phone frame is self-contained in this component.

