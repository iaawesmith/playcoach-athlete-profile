

## Fix Firecrawl Profile Data Parsing

Three bugs traced to the edge function's regex extraction and a format mismatch with the store.

### Problem Analysis

1. **Height "0 ft 6 in"** — The store expects height as total inches (e.g. `"74"`), but the scraper returns `"6-2"`. `parseInt("6-2")` = `6`, so the form shows 0 ft 6 in.
2. **Position "S" instead of "QB"** — The regex `Position[:\s]*(QB|RB|...)` grabs the first match across all scraped pages. If a different player's page or a sidebar element mentions "S" first, it wins.
3. **High school "in Murrieta"** — The regex `High\s*School[:\s]+(.{3,40})` matched markdown text like "High School in Murrieta" — capturing "in Murrieta" instead of the actual school name.
4. **Jersey number "47"** — The `#(\d{1,3})\b` regex is too greedy and grabs any `#` number from any page.

### Changes in `supabase/functions/firecrawl-profile/index.ts`

**Convert height to total inches before returning.** After all regex extraction is done, if `merged.height` is in `X-Y` or `X'Y"` format, convert to total inches:

```typescript
// Normalize height to total inches for the store
if (merged.height) {
  const h = String(merged.height);
  const dashMatch = h.match(/^(\d+)['-](\d+)$/);
  if (dashMatch) {
    merged.height = String(parseInt(dashMatch[1], 10) * 12 + parseInt(dashMatch[2], 10));
  }
}
```

**Improve position regex** — require the position to appear in a structured context (not just anywhere in the text). Add the athlete's name as a proximity check: only accept position from content that also contains the athlete's first or last name nearby. Also move position matching to prefer pages whose URL contains the athlete name:

```typescript
// More specific position patterns
const posMatch = content.match(
  /(?:Position|Pos\.?)\s*[:\-]\s*(QB|RB|WR|TE|OL|OT|OG|C|DL|DE|DT|LB|CB|S|FS|SS|K|P|FB|LS|ATH)\b/i
);
```

Also: skip the single-letter position "S" — it's too ambiguous. Map `FS`/`SS` to `S`, but don't accept bare `S` as a position match from a `Position:` label. Instead require at least 2 characters or a known full form.

**Fix high school regex** — reject matches that start with prepositions like "in", "at", "from":

```typescript
const highSchoolMatch = content.match(
  /High\s*School[:\s]+(?!in\b|at\b|from\b)([A-Za-z0-9\s.'()-]{3,40})/i
);
```

**Strip "lbs" from weight** so it stores cleanly as a number string.

**Validate jersey number** — only accept `#` numbers from lines that also contain the athlete's name, to avoid grabbing random `#47` from other content.

### Changes in `src/features/builder/components/ScrapeFill.tsx`

Add a display formatter so height shows as `6'2"` in the review list instead of `74`:

```typescript
const formatDisplayValue = (field: FieldKey, val: unknown): string => {
  if (field === "height") {
    const total = parseInt(String(val), 10);
    if (total > 11) return `${Math.floor(total / 12)}'${total % 12}"`;
  }
  return String(val ?? "");
};
```

Use this in the results list instead of raw `String(scrapedData?.[field])`.

### Files modified
- `supabase/functions/firecrawl-profile/index.ts` — height conversion, improved position/highSchool/jersey regex, weight cleanup
- `src/features/builder/components/ScrapeFill.tsx` — display formatter for height in review list

