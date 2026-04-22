
Fix the `resolveBilateral` function-name mismatch in `supabase/functions/analyze-athlete-video/index.ts`, then redeploy and rerun the same end-to-end pipeline test.

### Confirmed occurrences found
In `supabase/functions/analyze-athlete-video/index.ts` I found this mismatch:

1. Call site
```ts
const side = resolvebilateral(mapping, context.route_direction)
```
Location: around line 305

2. Function definition
```ts
function resolvebilderal(mapping: any, routeDirection: string): string {
```
Location: around line 546

### Proposed normalization
Rename both of those to the same camelCase identifier:

```ts
resolveBilateral
```

### Proposed code fixes
Apply these exact changes in `supabase/functions/analyze-athlete-video/index.ts`:

1. Update the call site:
```ts
const side = resolveBilateral(mapping, context.route_direction)
```

2. Update the function definition:
```ts
function resolveBilateral(mapping: any, routeDirection: string): string {
```

### Additional typo scan result
I scanned the function definitions in this file and did not find another confirmed function-name mismatch of the same kind. The only clearly broken callable-name typo currently visible is:

- `resolvebilderal` vs `resolvebilateral`

I will still do a careful pass during implementation for any other definition/call-site spelling mismatches before deploying, but based on the current read-only inspection, this is the only confirmed one.

### Notes from the current file
- The failure matches the code state exactly: the function is defined with the misspelled name `resolvebilderal`, while the metric calculation path calls `resolvebilateral`.
- The `side` value is currently assigned but not used later in the shown metric logic. Even so, the undefined function reference still crashes execution before metric processing can continue.

### Deployment plan
1. Edit `supabase/functions/analyze-athlete-video/index.ts`
2. Rename the definition to `resolveBilateral`
3. Rename every call site in the file to `resolveBilateral`
4. Do one more file-wide scan for near-duplicate function names before deploy
5. Redeploy the updated edge function
6. Re-run the same pipeline verification flow:
   - confirm a live node exists
   - confirm the reference video exists
   - generate a fresh signed URL
   - insert a new `athlete_uploads` test row
   - wait for processing
   - pull `analyze-athlete-video` logs
   - inspect final `athlete_uploads` row
   - inspect the resulting `athlete_lab_results` row

### Expected outcome
After this fix, the pipeline should progress past the previous `resolvebilateral is not defined` failure and continue into:
1. metric calculation
2. Claude feedback generation
3. results write
4. final upload status update to `complete`

### Success criteria to verify after redeploy
- No `ReferenceError` for `resolvebilateral` / `resolvebilderal`
- Cloud Run still succeeds using the normalized `/analyze` URL path
- `athlete_lab_results` receives a new row
- `athlete_uploads.status = 'complete'`

### File to change
- `supabase/functions/analyze-athlete-video/index.ts`
