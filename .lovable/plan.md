

## Fix Profile Strength Starting at 5%

**Root cause**: `computeProfileStrength` in `SideNav.tsx` line 21 checks `state.teamColor !== "#00e639"`, but the store default is `"#50C4CA"`. Since `"#50C4CA" !== "#00e639"`, it scores 5% on a fresh profile.

**Fix**: Change the check to exclude **both** known defaults, or better — only award the 5% when a school has been selected (since team color is tied to school selection):

```tsx
if (state.teamColor && state.teamColor !== "#00e639" && state.teamColor !== "#50C4CA") score += 5;
```

Alternatively, tie it to school being set (since team color auto-populates with school). But the simplest correct fix is to treat `#50C4CA` as a default too.

### Files modified
- `src/features/builder/components/SideNav.tsx`

