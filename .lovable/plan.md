

## Fix: Unchecking School Logo Doesn't Remove It

### Problem
When scrape results come back, `schoolLogoUrl` is immediately set on the athlete store as a live preview (line 128-129 of `useAutoFill.ts`). When the user unchecks the school logo checkbox and clicks "Apply Selected," the `apply` function only uploads and sets images that are in `selectedImages` — it never removes the previewed logo that was already written to the store. So the logo persists into Brand HQ.

### Fix

**`src/hooks/useAutoFill.ts`** — in the `apply` callback (~line 191-225):

After processing `selectedImages`, add a cleanup step: for any image key that was previewed but is NOT in `selectedImages`, restore the original value from `originalValues.current`.

```typescript
// After the selectedImages loop, revert any live-previewed images the user unchecked
const previewedImageKeys: (keyof ImageUrls)[] = ["actionPhoto", "schoolLogo"];
for (const imgKey of previewedImageKeys) {
  if (imageUrls?.[imgKey] && !selectedImages.has(imgKey)) {
    const storeKey = imageStoreKeys[imgKey];
    update[storeKey] = originalValues.current[storeKey] ?? null;
  }
}
```

This ensures that if the user unchecks school logo (or action photo), the store reverts to whatever value existed before the scrape ran.

### Files Modified
- `src/hooks/useAutoFill.ts`

