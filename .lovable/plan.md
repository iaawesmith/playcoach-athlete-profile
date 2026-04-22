

## Plan: "Manual Test Upload" tool in Admin Reference

### Where it lives
New tab in `AdminReferencePanel.tsx` under a new section group **"TESTING"**, tab id `manual_test_upload`, label `MANUAL TEST UPLOAD`. Tab order: appended after the existing "RESOURCES" group so it doesn't disrupt the current layout.

### Why an edge function (not direct client upload)
The `athlete-videos` bucket is **private**. A direct browser upload would require either making the bucket public (security regression) or adding RLS policies for unauthenticated inserts (also bad). The clean pattern: a small edge function uses the **service role key** to upload + sign. The browser just POSTs the file bytes.

### New edge function: `admin-test-upload`
Path: `supabase/functions/admin-test-upload/index.ts`. Default `verify_jwt = false` (this is an internal admin-only test utility behind the Admin Reference portal).

Behavior:
1. Accept `multipart/form-data` POST with one field `file` (the .mp4) and one field `path` (defaults to `test-clips/slant-route-reference-v1.mp4`).
2. Validate: file present, size ≤ 200MB, content-type starts with `video/`.
3. Upload to `athlete-videos` bucket at the given path with `upsert: true` (so re-uploads of the same test clip overwrite cleanly).
4. Generate a signed URL valid for **24 hours** (`createSignedUrl(path, 86400)`).
5. Return JSON: `{ path, signedUrl, expiresAt }`.
6. Standard `corsHeaders` on every response (success + error).

### UI panel (`ManualTestUploadTab` inside `AdminReferencePanel.tsx`)

Visual layout:

```text
┌─ MANUAL TEST UPLOAD ───────────────────────────────────────────┐
│  Test utility — uploads a local .mp4 to athlete-videos and     │
│  returns a 24-hour signed URL for Cloud Run testing.           │
│                                                                 │
│  ┌─ AMBER WARNING CALLOUT ─────────────────────────────────┐  │
│  │ ⚠ This is a test utility, not for production use.       │  │
│  │   Files uploaded here go to a fixed test path and may   │  │
│  │   be overwritten on subsequent uploads.                 │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  DESTINATION PATH                                              │
│  [ test-clips/slant-route-reference-v1.mp4 ]  (editable)       │
│                                                                 │
│  VIDEO FILE (.mp4)                                             │
│  ┌───────────────────────────────────────────────────────┐    │
│  │  ⬆ Drop a .mp4 file here, or click to choose          │    │
│  │  Selected: slant-route-reference-v1.mp4 (3.4 MB)      │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                                 │
│  [ UPLOAD AND GENERATE SIGNED URL ]  (kinetic-gradient CTA)    │
│                                                                 │
│  ─── after success ─────────────────────────────────────────── │
│  ✓ Uploaded successfully · Expires Apr 23, 2026 3:42 PM        │
│                                                                 │
│  SIGNED URL (valid 24 hours)                                   │
│  [ https://nwgljkjckcizbrpbqsro.supabase.co/storage/v1/...  ] │
│  [ COPY URL ]                                                  │
│                                                                 │
│  STORAGE PATH                                                  │
│  [ test-clips/slant-route-reference-v1.mp4 ]  [ COPY PATH ]    │
└────────────────────────────────────────────────────────────────┘
```

### Component behavior
- File input: hidden `<input type="file" accept="video/mp4,.mp4">`, triggered by a styled drop-zone button. Show selected filename + size.
- Path field: pre-filled with `test-clips/slant-route-reference-v1.mp4`, editable in case the admin wants a different path.
- Upload button: disabled until a file is selected. Shows `UPLOADING…` with a small spinner during the request.
- Calls the edge function via `supabase.functions.invoke("admin-test-upload", { body: formData })`.
- On success: render the signed URL in a read-only `<input>` styled like the other inputs in the portal, plus a `COPY URL` button using `navigator.clipboard.writeText`. Same pattern for the path. Show `✓ COPIED!` 2-second confirmation, matching the existing Copy button pattern in `PromptTab`.
- On error: show a red inline error row beneath the CTA with the server message.

### Styling
Reuses existing portal tokens — `bg-surface-container`, `border-outline-variant/10`, `kinetic-gradient text-[#00460a]`, `text-[10px] font-black uppercase tracking-[0.2em]`, `rounded-full` CTAs, `rounded-xl` cards. Amber warning callout: `border border-amber-500/30 bg-amber-500/5 text-amber-200/90` with `warning` Material Symbol — matches the warning style we recently used in the Videos tab guide.

### Files touched / created
- **NEW** `supabase/functions/admin-test-upload/index.ts` — ~70 lines. CORS, multipart parse, validate, upload via service role, signed URL, return JSON.
- **MODIFIED** `src/features/athlete-lab/components/AdminReferencePanel.tsx` — add `TESTING` section to `TAB_SECTIONS`, add `manual_test_upload` to `TabId`, add `ManualTestUploadTab` component (~120 lines) inline, render it in the tab switch.

### Out of scope
- No changes to the `athlete-videos` bucket configuration, RLS, or policies — bucket stays private.
- No DB tables, migrations, or new secrets — `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` are already configured.
- No changes to other tabs in the portal.
- No changes to the existing analysis pipeline or `analyze-athlete-video` flow.

### Risks
- **Edge function file-size limits**: Supabase edge functions have a request body limit (~6MB by default for some configurations, larger via streaming). For a 4-second 1080p clip this is comfortably fine (typically 2–8MB). If the admin later tries a much larger file, the function returns a clear 413-style error.
- **Service role exposure**: Confined to the edge function (server-side only, never returned to the client). The client only sees the resulting signed URL.
- **Overwrite by design**: `upsert: true` means re-uploading to the same path replaces the previous file. This is the intended behavior for an iterating test utility, and it's called out in the warning callout.

