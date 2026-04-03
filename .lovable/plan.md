

## Fix Broken Michigan Wolverines JSON Entry

**Problem**: The GitHub edit updated Michigan's colors correctly (`#FFCB05` is there) but removed the `id`, `slug`, and closing `}` brace — breaking the entire JSON file and causing the white screen.

**Fix in `src/data/universities.json` (lines 1690–1691)**:

Replace:
```json
    ],
  {
```

With:
```json
    ],
    "id": "cec76c74-652b-4833-b40a-acab06687205",
    "slug": "michigan_wolverines"
  },
  {
```

Also fix line 1684 indentation from ` {` to `  {` (minor).

### Files modified
- `src/data/universities.json`

