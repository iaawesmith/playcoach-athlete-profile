
Yes, but only slightly.

What the example URLs confirm:
- 247Sports canonical recruiting URLs do use the pattern `/player/{slug}-{id}/high-school-{id}/`
- On3 recruiting URLs do use the pattern `/rivals/{slug}-{id}/`

What this changes in the earlier diagnosis:
- It does not change the main issue: the current autofill is still failing primarily at URL discovery, because `supabase/functions/firecrawl-profile/index.ts` is scraping Google-result markdown instead of doing a reliable profile search.
- It does refine the implementation: we should match these exact skeletons with ID-aware regexes instead of loose substring checks.
- It also means On3’s `/rivals/` path is valid as-is, so the first fix is not “change the On3 path,” it is “make discovery reliable and score the right result.”

Updated implementation plan

1. Fix profile discovery in `supabase/functions/firecrawl-profile/index.ts`
- Replace Google-page scraping with a real Firecrawl search request.
- Search for candidate URLs using athlete name plus school.
- Rank candidates against the exact patterns your examples confirm:
  - 247 preferred: `/player/{slug}-{id}/high-school-{id}/`
  - 247 fallback: `/player/{slug}-{id}/`
  - On3 preferred: `/rivals/{slug}-{id}/`

2. Tighten URL matching using the example skeletons
- Replace broad `includes("/player/")` and `includes("/rivals/")` logic with regex-based matching.
- Keep slug matching, but also require the numeric ID suffix so we don’t accept unrelated pages that happen to contain the name.

3. Keep the current 247 parser, but fix the frontend contract
- The backend currently returns `stars247`, `rating247`, `compositeRating247`, etc.
- `src/hooks/useAutoFill.ts` is still reading stale keys like `d.stars`, `d.playerRating247`, and `d.compositeRating`.
- Update `src/services/firecrawl.ts` types and `useAutoFill.ts` field mapping so successful 247 results actually populate the UI/store.

4. Make attempt/failure states explicit
- Return clearer outcomes from the edge function:
  - search ran but no matching profile URL found
  - profile page found but parse returned no usable fields
  - success with data
- Use that to make missing-field reasons accurate instead of defaulting everything to “Source not reached.”

5. Keep the UI behavior, but make 247/On3 visibly attempted
- If 247 or On3 were queried but returned no data, still surface them as attempted sources in the autofill results/missing-fields flow so it no longer looks like CFBD was the only provider searched.

Technical details
- Current 247 logic already prefers `high-school` URLs, which matches your example.
- Current On3 logic already extracts `/rivals/`, which also matches your example.
- So the example URLs do not require a new parser shape; they mainly tell us how to harden candidate selection and confirm that discovery—not the downstream parsing target—is the weak link.

Files to update
- `supabase/functions/firecrawl-profile/index.ts`
- `src/services/firecrawl.ts`
- `src/hooks/useAutoFill.ts`

Expected outcome
- 247 and On3 will actually resolve profiles more consistently.
- Successful 247 data will stop being dropped by the frontend due to key mismatches.
- The autofill modal will clearly show whether 247/On3 were searched, matched, parsed, or failed.
