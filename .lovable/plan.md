

## Simplify Icon Upload & Fix Sidebar Icon

### Problem
1. The Basics tab shows a full URL text input + raw file path in the thumbnail — unnecessary clutter
2. The sidebar doesn't reflect the uploaded icon until the node is saved and the data round-trips

### Changes

**`src/features/athlete-lab/components/NodeEditor.tsx`** (Basics tab, lines 164-197)

- **Remove the URL input field** — keep only the Upload button
- **Simplify thumbnail preview** — show just the icon image (larger, clean) with no file path text. Add a small "Remove" button to clear it
- **Update tooltip** to "Upload an icon or diagram. This will appear next to the node name in the sidebar."

**`src/features/athlete-lab/AthleteLab.tsx`** (lines 53-55)

- Update `handleUpdated` to also work as a live preview: pass a second callback or modify the existing one so that partial draft changes (specifically `icon_url`) propagate to the sidebar nodes list in real-time — OR simpler: the sidebar already reads from the `nodes` array which is updated on save. The user just needs to save. But to make it feel more responsive, we can also update the parent nodes list immediately when `icon_url` changes in the editor (before save).

**Approach for live sidebar icon**: Add a new `onIconChange` callback from `NodeEditor` to `AthleteLab` that updates just the `icon_url` on the node in the parent's state immediately when an upload completes, so the sidebar reflects it without needing to hit Save first.

### Result
- Clean upload-only field with just the Upload button
- Thumbnail shows only the icon image, no URL text
- Sidebar icon updates immediately after upload (before save)

