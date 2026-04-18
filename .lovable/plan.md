

## Recommendation: Yes — make the button reflect current state

You're right that "Set Live" while already Live is confusing. The button's underlying handler (`handleStatusToggle`) already does the right thing — it toggles and pops the "Set to Draft" confirmation in attachment 4 — so this is purely a label/icon/styling fix on the button itself. No logic change.

### What changes — single button, three states

In `NodeReadinessBar.tsx` (the only place "Set Live" appears), make the bottom-right CTA state-aware based on `node.status`:

| Node status | Label | Icon | Style | Disabled when |
|---|---|---|---|---|
| `draft`, score < 100 | `Set Live` | `rocket_launch` | muted (current disabled look) | score < 100 |
| `draft`, score = 100 | `Set Live` | `rocket_launch` | `kinetic-gradient` (current live-ready look) | never |
| `live` | `Set to Draft` | `pause_circle` | ghost / outline (matches the modal's secondary aesthetic — `border-outline-variant/30 bg-surface-container text-on-surface-variant hover:text-on-surface`) | never |

Key behaviors:
- **Always enabled when Live** — going back to draft must never be gated by readiness score (score is irrelevant once published; the user needs an escape hatch).
- **Icon** swaps to `pause_circle` when Live to match the modal's pause icon (attachment 4) and reinforce "you're pausing automation," not "you're publishing."
- **Visual demotion** when Live — going to draft is a destructive-ish action, so it should *not* use `kinetic-gradient`. A muted ghost button is the right register and stops the bar from screaming "PRESS ME" at someone who just shipped.
- **Tooltip** updates to "Pause automatic analysis for new uploads" when Live, mirroring the modal copy.

### Why this is better than removing the button

The button is genuinely useful from inside the node — without it, the only way to demote to draft is via the small status pill in the editor's title bar (attachment 1). Keeping a discoverable, correctly-labeled toggle in the readiness bar preserves the affordance while removing the cognitive dissonance.

### Out of scope

- No change to `handleStatusToggle`, the confirmation modals, or the status pill in the title bar (attachment 1) — those are already correct.
- No change to the "Save Node" button (attachment 2) — its disabled-when-clean behavior is correct.
- No change to `NodeEditor.tsx` props or wiring — `onSetLive` stays as-is (it's really an `onToggleStatus` now; renaming is optional polish, skipped for minimum-diff).

### Files touched
- `src/features/athlete-lab/components/NodeReadinessBar.tsx` — lines ~280–293 (the Set Live button block) only.

### Risks
None meaningful. Pure presentational change on one button; the underlying toggle handler and modal flow are unchanged and already correct.

