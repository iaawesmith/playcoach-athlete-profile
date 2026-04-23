
Diagnose the Run Analysis failure as a storage-layer RLS problem, then rewire the upload path so the admin test flow uses backend privileges end-to-end instead of direct client storage calls.

### Findings

1. The RLS violation happened during the storage bucket upload, not the `athlete_uploads` insert
   - The failing network request is:
     - `POST .../storage/v1/object/athlete-videos/test-clips/...`
     - response: `403 Unauthorized`
     - message: `new row violates row-level security policy`
   - In code, Run Analysis uploads the file directly from the browser before it calls any backend helper:
     - `src/services/athleteLab.ts:244-262` uses `supabase.storage.from("athlete-videos").upload(...)`
     - only after that succeeds does it call `admin-create-athlete-upload`
     - `src/services/athleteLab.ts:292-294`

2. The `athlete_uploads` row insert is not the failing operation
   - The helper function `supabase/functions/admin-create-athlete-upload/index.ts` does use service-role credentials and inserts directly into `athlete_uploads`
   - That helper would bypass normal table RLS
   - Because the storage upload fails first, this helper is never reached in the failing path

3. Current RLS policies on `athlete_uploads`
   - `Users can insert their own uploads`
     - role: `authenticated`
     - `WITH CHECK (auth.uid() = athlete_id)`
   - `Users can view their own uploads`
     - role: `authenticated`
     - `USING (auth.uid() = athlete_id)`
   - `Service role can select all uploads`
   - `Service role can update all uploads`
   - There is no client-safe policy that would allow an anonymous admin test flow to insert rows for the fixed test athlete UUID, which is fine because the intended path is the backend helper

4. Current storage RLS policies affecting `athlete-videos`
   - `Athletes can upload to their own folder`
     - role: `authenticated`
     - insert allowed only when first folder segment equals `auth.uid()`
   - `Athletes can read their own videos`
     - role: `authenticated`
     - select allowed only when first folder segment equals `auth.uid()`
   - `Public admin test uploads can add athlete video test clips`
     - role: `public`
     - insert allowed when:
       - `bucket_id = 'athlete-videos'`
       - first folder segment is `test-clips`
   - Important gap:
     - there is no matching public/anon `SELECT` policy for `athlete-videos/test-clips/*`
     - so even if the insert policy were enough for upload, the current client-side `createSignedUrl(...)` step would still be at risk because the browser is trying to generate the signed URL against a private bucket from the client

### Diagnosis summary

- The first failure is the browser trying to upload directly into `athlete-videos/test-clips/*`
- The backend helper for `athlete_uploads` is not being used yet when the error occurs
- The current Run Analysis implementation only moved the database insert behind a helper; it did not move the storage upload behind a helper
- That means the flow still depends on storage RLS from the browser, which is exactly where it is breaking

### Proposed fix

1. Stop uploading test clips directly from the browser in Run Analysis
   - Replace the direct client storage flow in `src/services/athleteLab.ts`
   - Instead of:
     - `storage.upload(...)`
     - then `storage.createSignedUrl(...)`
   - call the existing backend helper `admin-test-upload` with `FormData`
   - That helper already:
     - uploads to `athlete-videos`
     - uses service-role credentials
     - returns a 24-hour signed URL
     - is already used successfully by the Manual Test Upload tool

2. Keep `admin-create-athlete-upload` as the second backend step
   - After `admin-test-upload` returns the signed URL/path, continue calling `admin-create-athlete-upload`
   - That preserves the intended architecture:
     - backend helper for storage
     - backend helper for `athlete_uploads` row creation
     - webhook-triggered production pipeline after insert

3. Do not rely on loosening storage RLS as the primary fix
   - A policy-only fix is possible, but it is the weaker option
   - To keep client-side uploads working, you would likely need:
     - insert access for `test-clips/*`
     - and read/select access sufficient for signed URL generation on those same objects
   - That increases surface area on a private bucket and is unnecessary because a backend upload helper already exists

4. Optional cleanup after the rewire
   - Make Run Analysis and Manual Test Upload share the same upload helper logic in `src/services/athleteLab.ts`
   - Keep all test uploads landing in `athlete-videos/test-clips/*`
   - Preserve the fixed test athlete workflow exactly as-is

### Files to update

- `src/services/athleteLab.ts`
  - replace direct browser storage upload/signing in `uploadTestClip(...)`
  - invoke `admin-test-upload` instead
- possibly small reuse cleanup in:
  - `src/features/athlete-lab/components/AdminReferencePanel.tsx`
  - only if extracting shared helper logic is worthwhile

### Validation after the fix

1. Run Analysis uploads no longer make a browser `POST /storage/v1/object/athlete-videos/test-clips/...` request
2. The upload step succeeds through `admin-test-upload`
3. A 24-hour signed URL is returned
4. `admin-create-athlete-upload` is then called and creates the `athlete_uploads` row
5. The production pipeline is triggered from that inserted upload row
6. The test can proceed end-to-end without storage RLS blocking the first step

### Bottom line

- Operation that failed: storage upload
- Bucket path involved: `athlete-videos/test-clips/*`
- `athlete_uploads` insert helper: not reached in the failing flow
- Best fix: route Run Analysis file uploads through the existing backend upload helper instead of client storage APIs
