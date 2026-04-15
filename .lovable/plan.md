
Diagnosis

- The save call itself is already wired to the backend: `HelpDrawer` calls `updateNode(nodeId, { knowledge_base: updatedKb })`.
- The likely failure is state sync after save, not the database write.
- Right now `HelpDrawer` updates the database, but it does not push the returned saved node back up into the parent `AthleteLab` node list.
- So when you navigate away from the node and come back, `NodeEditor` gets rebuilt from the old `selectedNode` prop in `AthleteLab`, which still contains the previous `knowledge_base`. That makes the saved content appear to disappear.

Plan

1. Update `HelpDrawer` so a successful save does two things:
   - persists `knowledge_base` to `athlete_lab_nodes`
   - returns the saved node upward through a new callback like `onNodeSaved(updatedNode)`

2. Update `NodeEditor` to pass its existing `onUpdated` handler into `HelpDrawer`, so the saved node replaces the stale one in the top-level `nodes` array.

3. Also sync `NodeEditor`’s local `draft` from the saved response immediately after save, so the drawer and editor stay aligned without waiting for remounts.

4. Keep the current storage model for this feature in `athlete_lab_nodes.knowledge_base` since this knowledge base is node-specific.

5. Re-test the exact failure path:
   - add/edit section content
   - click Save
   - switch to another node and back
   - close and reopen the knowledge base
   - refresh the page
   - confirm the content still exists in all cases

Technical details

- Files to update:
  - `src/features/athlete-lab/components/HelpDrawer.tsx`
  - `src/features/athlete-lab/components/NodeEditor.tsx`
- No database migration needed.
- This does not look like an RLS issue; it looks like stale frontend state after a successful save.
