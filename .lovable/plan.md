

## Plan: Live Action Photo on Preview + Collapsible Data Fields

### Problem 1 — Action photo doesn't appear on ProCard until "Apply"
The action photo URL is found during the Firecrawl phase but stored only in the `enrichedFields` array for review. The ProCard reads `actionPhotoUrl` from Zustand, which isn't updated until the user clicks "Apply Selected." So the card stays blank during the preview step.

### Problem 2 — All returned fields shown at once
The field list can be 15–25 items long, making the results screen noisy. User wants a collapsed summary with an expand toggle.

---

### Fix 1 — Write actionPhotoUrl to store immediately (useAutoFill.ts)

At the end of the Firecrawl phase (around line 474), when `resolvedActionPhoto` is found, write it to the store immediately via `setAthleteFromSource` so the ProCard updates live:

```typescript
if (resolvedActionPhoto) {
  data.actionPhotoUrl = resolvedActionPhoto;
  // Write to store immediately so ProCard updates in real-time
  setAthleteFromSource({ actionPhotoUrl: resolvedActionPhoto }, source);
}
```

The field still appears in the enrichedFields list for deselection, but the ProCard shows the photo right away. If the user unchecks it and clicks Apply, the apply function should remove it from the store (or simply not re-write it — the current behavior already skips unchecked fields).

Also do the same for `profilePictureUrl` from the CFBD roster headshot — it's already written to the store in the CFBD phase, so that's fine. No change needed there.

### Fix 2 — Collapsible field list (ProfilePreview.tsx)

Replace the flat field list with a collapsed summary + expander:

- **Collapsed state (default)**: Show a summary line like "12 fields found from 247Sports, On3, CFBD" with source badges and a "Show Details" expand button.
- **Expanded state**: Show the full checkbox field list as it exists today.
- Use a local `useState<boolean>(false)` for the expand toggle.
- The expand button: a row with "View all fields" text + a `expand_more` / `expand_less` Material Symbol icon.
- Keep the "Apply Selected" and "Skip" buttons always visible outside the collapsible area.

### Files modified
1. `src/hooks/useAutoFill.ts` — write actionPhotoUrl to store immediately when resolved
2. `src/features/onboarding/steps/ProfilePreview.tsx` — add collapsible wrapper around the field list

