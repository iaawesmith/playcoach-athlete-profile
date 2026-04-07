

## Fix: Missing Fields Not Rendering in ScrapeFill

### Root Cause
The `missingFields` array is computed at the end of `scrape()` in `useAutoFill.ts` and written to the Zustand store. The `ScrapeFill` component reads it from the store via `useAthleteStore((s) => s.missingFields)`. 

The problem: `runFirecrawlPhase` sets `setStatus("results")` before `scrape()` computes and writes `missingFields`. The component re-renders with status="results" but `missingFields` is still `[]` in the store. The subsequent `setMissingFields(missingFields)` call triggers another store update, but `setStatus("results")` at line 707 is a no-op (same value), so React may batch away the re-render if Zustand's update doesn't trigger one independently.

### Fix (two files, minimal changes)

**1. `src/hooks/useAutoFill.ts`**
- Add `const [localMissingFields, setLocalMissingFields] = useState<MissingField[]>([])` alongside other local state
- In `scrape()`, after computing `missingFields`, call BOTH `setLocalMissingFields(missingFields)` and `useAthleteStore.getState().setMissingFields(missingFields)` (keep store write for other consumers)
- In `scrape()` initialization (line 583 area), add `setLocalMissingFields([])` to reset on new scrape
- Return `missingFields: localMissingFields` from the hook

**2. `src/features/builder/components/ScrapeFill.tsx`**
- Remove `const missingFields = useAthleteStore((s) => s.missingFields)` (line 30)
- Destructure `missingFields` from `useAutoFill()` instead (add to the existing destructuring block)

This ensures the component re-renders from the same React state batch as the status update, guaranteeing the missing fields panel appears alongside the "DATA FOUND" panel.

