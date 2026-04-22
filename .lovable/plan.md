
Add a delete-confirmation flow to the AthleteLab node list so a node cannot be removed with a single click.

### What will be built

1. Wire a confirmation modal into the left-side node list delete action
   - Intercept the delete button in `src/features/athlete-lab/components/NodeSidebar.tsx`
   - Replace the direct `onDelete(node.id)` call with a request to open a confirmation step first

2. Manage pending-delete state in `src/features/athlete-lab/AthleteLab.tsx`
   - Add local state for the node currently queued for deletion
   - Pass a new callback into `NodeSidebar` such as `onRequestDelete`
   - Keep the actual delete API call inside `handleDelete`, but only run it after confirmation

3. Reuse the existing custom modal
   - Import `ConfirmModal` from `src/features/athlete-lab/components/ConfirmModal.tsx`
   - Render it at the AthleteLab page level, alongside the existing layout
   - Configure it with clear destructive copy, for example:
     - Title: `Delete Training Node?`
     - Body: mention the specific node name so the user can verify what is being deleted
     - Confirm button: `Delete Node`

4. Preserve current behavior after confirmation
   - Confirming still calls the existing `deleteNodeApi`
   - Cancel closes the modal without changing selection or list state
   - If the deleted node was selected, keep the current fallback selection behavior

### Files to update

- `src/features/athlete-lab/AthleteLab.tsx`
- `src/features/athlete-lab/components/NodeSidebar.tsx`

### Implementation details

- `NodeSidebarProps` will change from a direct destructive `onDelete(id)` flow to a safer `onRequestDelete(node)` or equivalent
- Passing the whole `TrainingNode` object is preferable so the modal body can show the node name without doing another lookup
- The existing `ConfirmModal` already matches the project’s design system and supports:
  - open/close state
  - Escape to cancel
  - overlay click to cancel
  - custom confirm label

### UX outcome

- Clicking the trash icon opens a confirmation modal instead of deleting immediately
- Users get a clear “are you sure?” safety step before losing a populated node
- The change stays consistent with the custom AthleteLab UI and avoids introducing any shadcn dialog components

### Validation

After implementation, verify:
- Delete icon no longer removes a node instantly
- Modal opens with the correct node name
- Cancel leaves the node untouched
- Confirm deletes the intended node
- Selected-node fallback still works correctly after deletion
- Hover behavior and sidebar layout remain unchanged
