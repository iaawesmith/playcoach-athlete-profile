

## Problem

The Knowledge Base "Save" button in the HelpDrawer only saves the rich-text content back into the local React draft state (via `onKnowledgeBaseChange`). It never triggers a Supabase write. The content is only persisted if the admin separately clicks the main node "Save" button in the NodeEditor — which is not obvious and easy to forget. On page refresh, unsaved knowledge base content is lost.

## Solution

Make the HelpDrawer's Save button persist directly to Supabase by:

1. **Pass `nodeId` as a new prop** to `HelpDrawer` from `NodeEditor`
2. **Update `handleSave`** in `HelpDrawer` to:
   - Save content into local state (existing behavior)
   - Build the updated `knowledge_base` object
   - Call `updateNode(nodeId, { knowledge_base: updatedKb })` to persist to Supabase
   - Show "Saved ✓" toast on success, error toast on failure
3. **Make `handleSave` async** to await the Supabase call

## Technical Details

### File: `src/features/athlete-lab/components/HelpDrawer.tsx`
- Add `nodeId: string` to `HelpDrawerProps`
- Import `updateNode` from `@/services/athleteLab`
- Import `toast` from `sonner`
- Change `handleSave` to async:
  ```typescript
  const handleSave = async () => {
    if (!selected) return;
    const html = editorRef.current?.innerHTML ?? "";
    const updatedSections = sections.map((s) => 
      s.id === selected.id ? { ...s, content: html } : s
    );
    const updatedKb = { ...knowledgeBase, [tabKey]: updatedSections };
    onKnowledgeBaseChange(updatedKb);
    try {
      await updateNode(nodeId, { knowledge_base: updatedKb });
      toast.success("Saved ✓");
    } catch {
      toast.error("Save failed — check connection");
    }
    setEditing(false);
  };
  ```

### File: `src/features/athlete-lab/components/NodeEditor.tsx`
- Pass `nodeId={node.id}` to the `HelpDrawer` component (line ~828)

### No database changes needed
- The `knowledge_base` column is JSONB with no size limit
- RLS policy allows all access (public ALL)
- The `updateNode` service function already handles the write correctly

