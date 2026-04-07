

## Add hover effects to onboarding tiles + focus borders to setup fields

### Approach

**Tiles (Role, Tier, Sport):** On active (non-coming-soon) tiles, add a CSS hover state that applies the teal accent — border color shifts to `#4DC9C9`, a subtle glow shadow (`0 0 15px rgba(77,201,201,0.3)`), and a slight scale-up. Since these use inline styles, the cleanest approach is adding a hover state class and using a combination of `group` or conditional className with Tailwind's `hover:` — but because border/shadow are inline, we'll add an `onMouseEnter`/`onMouseLeave` local state per tile, or better: use CSS custom properties with a hover class. Simplest: add `hover:border-[#4DC9C9] hover:shadow-[0_0_15px_rgba(77,201,201,0.3)]` via Tailwind classes and move the border/shadow out of inline styles for active tiles.

**Setup fields (CoreSetup):** Add a `focus-within` border highlight to each input card. The card divs use inline `cardStyle` with `border: 1px solid #3D434A`. We'll add a CSS class or use Tailwind's `focus-within:border-[#4DC9C9]` on the wrapper divs, moving the border to className so Tailwind's pseudo-class works.

### Files changed

**1. `src/features/onboarding/steps/RoleSelection.tsx`**
- For active tiles: move border/boxShadow out of inline style into className using Tailwind hover utilities
- Add `hover:border-[#4DC9C9] hover:shadow-[0_0_15px_rgba(77,201,201,0.3)]` to the button className (only for non-comingSoon tiles)

**2. `src/features/onboarding/steps/AthleteTier.tsx`**
- Same pattern as RoleSelection for active tiles

**3. `src/features/onboarding/steps/SportSelection.tsx`**
- Same pattern as RoleSelection for active tiles

**4. `src/features/onboarding/steps/CoreSetup.tsx`**
- Change `cardStyle` border to className-based so we can use `focus-within:`
- Add `focus-within:border-[#4DC9C9]` and `transition-colors` to each input wrapper div
- Apply via a shared card class string like `rounded-xl p-4 bg-[#2A2E33] border border-[#3D434A] focus-within:border-[#4DC9C9] transition-colors duration-200`

### Technical detail

For the tiles, the selected state still needs inline style for the glow intensity difference (selected = stronger glow). The hover state will be a lighter version that only appears on non-selected, active tiles. We'll structure it as:
- Selected: inline `border-color: #4DC9C9` + `boxShadow: 0 0 15px ...0.5`  
- Hover (not selected, active): Tailwind `hover:border-[#4DC9C9] hover:shadow-[0_0_15px_rgba(77,201,201,0.3)]`
- Inactive: inline `opacity: 0.45`, no hover effect

