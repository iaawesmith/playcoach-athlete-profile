

## Fix Michigan Wolverines Primary Color

**Root cause**: `pickPrimaryColor()` in `src/data/universities.ts` returns the *last* non-white color. For Michigan's array `["#FFFFFF", "#FFCB05", "#272341"]`, that's `#272341` (dark purple) — not the yellow.

**Fix**: Remove `#272341` from Michigan's color array in `universities.json`. The colors should be `["#FFFFFF", "#FFCB05"]`. This way `pickPrimaryColor` returns `#FFCB05` (the yellow) as intended.

### Files modified
- `src/data/universities.json` — Michigan Wolverines colors changed from `["#FFFFFF", "#FFCB05", "#272341"]` to `["#FFFFFF", "#FFCB05"]`

