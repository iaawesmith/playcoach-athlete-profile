# Official route icon mapping

## Goal
Replace per-node/default icon behavior with one official PlayCoach diagram per route name, shared automatically across WR, TE, and RB nodes.

## Implementation
- Upload the ten supplied PNGs as app assets, keyed by normalized route name: Slant, Cross, Out, In, Curl, Comeback, Corner, Post, Wheel, and Go.
- Add one route-icon resolver that matches a node’s route name case-insensitively and tolerates a trailing “Route” label.
- Use the resolver in the node header and Icon / Visual Diagram preview so stored `icon_url` values cannot make non-Slant nodes show the Slant diagram.
- Remove per-node upload/remove controls for mapped routes; future nodes with a mapped route name inherit the correct icon automatically.
- Keep all node records and every training field unchanged, including `icon_url`, status, readiness, phases, metrics, badges, errors, and filming instructions.

## Verification
- Snapshot all node names, positions, statuses, readiness inputs, and configuration before the change.
- Check the live Athlete Lab node list/editor and confirm every existing node resolves to its own route diagram.
- Specifically confirm only Slant WR and Slant TE resolve to Slant, no mapped node displays the brain fallback, and Slant WR remains LIVE.
- Report the ten route-to-asset mappings and every node’s resolved icon.

## Technical details
- Scope is frontend asset resolution only; no schema migration and no database writes.
- Unknown route names retain the existing fallback behavior so unrelated future skills are not broken.
