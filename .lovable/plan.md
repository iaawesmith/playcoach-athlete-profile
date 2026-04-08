

## Extract High School from 247Sports Instead of CFBD

### What's Changing
The CFBD recruiting endpoint often fails to match transfer players, so `highSchool` never populates. The 247 college profile page already contains the high school name in a structured `<li>` element. We'll extract it there and update the source badge from CFBD to 247.

### Changes

**1. `supabase/functions/firecrawl-profile/index.ts`**
- Add `highSchool: string | null` to the return type of `parse247RecruitingData`
- Parse it from the full HTML (not a section — it's in the player bio area): look for `<li>` containing `<span>High School</span>`, then extract the text content of the second `<span>` (strip the `<a>` tag, take inner text)
- Return `highSchool` alongside the existing transfer/prospect fields
- Redeploy edge function

**2. `src/hooks/useAutoFill.ts`**
- In the 247 data mapping block (~line 397-408): add `if (d.highSchool) data.highSchool = d.highSchool;`
- Add `highSchool` to `immediateRatingFields` block so it writes to the store immediately with source `"247"`
- Remove `highSchool` from the CFBD missing-fields check (~line 661-667) — no longer tracked under CFBD
- Add a 247 missing-field check: if `!storeAfter.highSchool`, push `{ field: "High School", source: "247", reason: "Field not in response" }`

**3. `src/features/builder/components/IdentityForm.tsx`**
- Change the `badge` prop on the High School `InputCard` from `"CFBD"` to `"247"`

**4. `src/hooks/useAutoFill.ts` (field labels)**
- No change needed — `highSchool: "High School"` label already exists

### Not Changing
- CFBD still pulls `recruit.school` if available — but it will no longer be the primary source and 247 will overwrite it
- Store schema — `highSchool` field already exists
- Hometown — stays as CFBD

