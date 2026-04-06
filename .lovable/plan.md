

## Clear school logo when school input is deleted

**Problem:** When the user clears the school search field, the logo remains because `handleInputChange` only updates the query text — it never clears the store values.

**Fix:** In `src/features/onboarding/steps/CoreSetup.tsx`, update `handleInputChange` (line 45–49) to check if the input is empty and clear the school-related store fields:

```typescript
const handleInputChange = (value: string) => {
  setQuery(value);
  setFocusIndex(-1);
  setOpen(value.length >= 1);
  if (value === "") {
    setAthlete({ school: "", schoolAbbrev: "", schoolLogoUrl: null, teamColor: "#50C4CA" });
  }
};
```

This resets `school`, `schoolAbbrev`, `schoolLogoUrl`, and `teamColor` back to the default PlayCoach Steel when the field is emptied, causing the shield placeholder icon to reappear.

