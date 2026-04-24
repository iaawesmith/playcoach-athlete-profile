

## Shrink Description / Overview textarea in Basics tab

Reduce the minimum height of the merged Description / Overview field from 220px to 80px to match the standard Textarea component and fit its intended 2–3 sentence limit.

---

### Change

| File | Line | Change |
|---|---|---|
| `src/features/athlete-lab/components/NodeEditor.tsx` | 797 | `min-h-[220px]` → `min-h-[80px]` |

`resize-y` remains, so users can still expand the box if they choose to write more.

