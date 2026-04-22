
Generate a fresh 24-hour signed URL for `athlete-videos/test-clips/slant-route-reference-v1.mp4` without running the pipeline.

### What’s already confirmed
- There is an existing backend function at `supabase/functions/admin-test-upload/index.ts`.
- It already creates a 24-hour signed URL with:
  - bucket: `athlete-videos`
  - default path: `test-clips/slant-route-reference-v1.mp4`
  - TTL: `60 * 60 * 24`
- The AthleteLab admin UI also documents this exact utility as returning a 24-hour signed URL for Cloud Run testing.

### Work to perform after approval
1. Invoke the existing signed-URL flow for:
   - bucket: `athlete-videos`
   - path: `test-clips/slant-route-reference-v1.mp4`
2. Do not insert any upload row and do not trigger `analyze-athlete-video`.
3. Return only the resulting signed URL string, as requested.

### No code changes expected
- This should not require edits to the codebase.
- It is an operational action only.

### Fallback if the existing utility cannot be invoked cleanly
Use backend access to generate a signed URL directly for the same storage object and same 24-hour expiry, then return only the URL.
