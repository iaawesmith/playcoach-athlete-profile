

## Create Storage Bucket: `athlete-videos`

### What gets created
A new private Supabase Storage bucket via SQL migration:

- **Name**: `athlete-videos`
- **Public**: `false` (private — access only via signed URLs or service-role key)
- **File size limit**: 500 MB (524288000 bytes)
- **Allowed MIME types**: `video/mp4`, `video/quicktime`, `video/webm`

### How it's done
A single SQL migration that inserts into `storage.buckets`:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'athlete-videos',
  'athlete-videos',
  false,
  524288000,
  array['video/mp4', 'video/quicktime', 'video/webm']
);
```

### RLS policies
Since the bucket is private and the `analyze-athlete-video` edge function accesses it using the `SUPABASE_SERVICE_ROLE_KEY` (which bypasses RLS), no storage policies are strictly required for the edge function to read files.

However, to allow authenticated athletes to upload their own videos from the client, I'll add minimal RLS policies on `storage.objects` scoped to this bucket:

- **Insert**: authenticated users can upload to a path prefixed with their own `auth.uid()`
- **Select**: authenticated users can read their own files (path prefix = their `auth.uid()`)

This follows the standard "user folder" convention: files stored as `{user_id}/{filename}`.

### What I will NOT change
- No changes to existing buckets (`athlete-media` stays as-is)
- No changes to the `athlete-uploads` table or its trigger
- No changes to the `analyze-athlete-video` edge function
- No UI, components, or client code

### Files touched
- New SQL migration (creates the bucket + 2 RLS policies)

