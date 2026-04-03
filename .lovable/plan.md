

## Reset Team Color When School Is Cleared

**`src/features/builder/components/IdentityForm.tsx` — line 537**

The `onManualChange` callback fires when the user types in the school field (including clearing it). Currently it only updates `school`. Add logic: when the value is empty, also reset `teamColor` to the default `"#50C4CA"` and clear `schoolAbbrev`.

Change line 537 from:
```tsx
onManualChange={(v) => setAthlete({ school: v })}
```
To:
```tsx
onManualChange={(v) => {
  if (v === "") {
    setAthlete({ school: "", schoolAbbrev: "", teamColor: "#50C4CA" });
  } else {
    setAthlete({ school: v });
  }
}}
```

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

