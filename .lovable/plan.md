

## Improve Profile Section Card Definition

The measurable tiles and info blocks (Recruiting, Eligibility, Upcoming Game) use `bg-surface-container` (#151a1e) with `border-outline-variant/10`, which blends too much into the `bg-surface` (#0b0f12) page background.

### Change — `src/features/builder/components/IdentityPreview.tsx`

Two adjustments applied to all card containers:

1. **Surface level bump**: `bg-surface-container` → `bg-surface-container-high` (#1b2024) — more contrast against the base background
2. **Border opacity bump**: `border-outline-variant/10` → `border-outline-variant/20` — edges become perceptible without feeling heavy

Affected elements:
- `MeasurableTile` component (line 6) — all 6 measurable tiles
- Recruiting block (line 90)
- Eligibility block (line 138)
- Upcoming Game block (line 164) — surface only, already has a teamColor left border

### Files modified
- `src/features/builder/components/IdentityPreview.tsx`

