

## Fix Icon Upload & Sync Icon Across Sidebar + Header

### Problem
1. **Upload fails** — The storage bucket's INSERT policy requires authentication (`Authenticated users can upload athlete media`), but the app has no auth. Uploads silently fail.
2. **No thumbnail feedback** after upload/URL paste (partially exists but may not show on upload failure).
3. **Sidebar icon** is hardcoded to the `route` Material Symbol — never uses `icon_url`.
4. **Header icon** next to the skill title is hardcoded to `neurology` — never uses `icon_url`.

### Solution

**1. Fix upload via image-proxy edge function** (`NodeEditor.tsx`)
- Instead of uploading directly to storage (which requires auth), use the existing `image-proxy` edge function approach: convert the file to base64, upload it via a new flow that bypasses auth. OR simpler — add an RLS policy allowing anonymous uploads to the `node-icons/` path prefix.
- **Chosen approach**: Add an unauthenticated INSERT policy scoped to `node-icons/` path in the `athlete-media` bucket. This is safe since it's admin-only content.

**Database migration:**
```sql
CREATE POLICY "Anyone can upload node icons"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'athlete-media' AND (storage.foldername(name))[1] = 'node-icons');
```

**2. Thumbnail preview** (`NodeEditor.tsx`)
- Already exists at line 188-193 but only shows when `draft.icon_url` is truthy. Since uploads were failing, it never appeared. The fix in step 1 will make this work. No additional changes needed.

**3. Sidebar icon uses `icon_url`** (`NodeSidebar.tsx`)
- Replace the hardcoded `<span>route</span>` icon with a conditional: if `node.icon_url` exists, render `<img>` with the URL; otherwise fall back to the `route` Material Symbol.

**4. Header icon uses `icon_url`** (`NodeEditor.tsx`, line 102)
- Replace the hardcoded `neurology` icon next to the node title with the same conditional: if `draft.icon_url` exists, show `<img>`; otherwise show the `neurology` icon.

### Files Changed
- **Migration** — new RLS policy for unauthenticated node-icon uploads
- **`src/features/athlete-lab/components/NodeSidebar.tsx`** — conditional icon_url image in sidebar items
- **`src/features/athlete-lab/components/NodeEditor.tsx`** — conditional icon_url image in header

### Result
- Upload works without auth
- Thumbnail shows immediately after upload or URL paste
- Sidebar and header both reflect the uploaded/pasted icon
- Falls back to Material Symbol icons when no image is set

