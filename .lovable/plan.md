# Hotfix Plan — MigrateCoachingCuesModal Rules-of-Hooks Crash

## Severity
**Production blocker.** Modal renders blank on open in admin UI; blocks Slant migration confirmation (Action 2).

## Root cause (confirmed in source)

`src/features/athlete-lab/components/MigrateCoachingCuesModal.tsx` declares hooks both above and below an early return:

```text
Line 131  useRef    (closeRef)         ← above guard
Line 134  useMemo   (reconciliation)   ← above guard
Line 141  useState  (drafts)           ← above guard
Line 144  useEffect (reset drafts)     ← above guard
Line 153  useEffect (focus)            ← above guard
Line 157  useEffect (escape key)       ← above guard
Line 166  if (!open) return null;      ← EARLY RETURN
Line 174  useState  (pendingPhaseIds)  ← BELOW guard ❌
Line 175  useState  (pendingAll)       ← BELOW guard ❌
Line 230  useMemo   (_previewAfter)    ← BELOW guard ❌
```

When the modal is closed React sees 6 hooks; when it opens React sees 9 → "Rendered more hooks than during the previous render". Stack trace points at line 133 (the next `useState` after the guard) which matches `pendingPhaseIds` once line numbers shift with HMR.

This was introduced in Step 6 (the `pendingPhaseIds` / `pendingAll` in-flight tracking additions) — they were appended after the existing `if (!open) return null` guard instead of being placed with the other hooks.

## Fix

Single-file change. Move the two `useState` declarations (and the `_previewAfter` `useMemo`) above the `if (!open) return null` guard. No behavioral change — these hooks already run unconditionally when the modal is open; the fix just makes them also run (harmlessly) when it's closed, which is what React requires.

### Diff outline

```text
src/features/athlete-lab/components/MigrateCoachingCuesModal.tsx

  // ... existing hooks (closeRef, reconciliation, drafts, 3× useEffect) ...

+ // [MOVED FROM BELOW EARLY RETURN] In-flight commit tracking.
+ const [pendingPhaseIds, setPendingPhaseIds] = useState<Set<string>>(new Set());
+ const [pendingAll, setPendingAll] = useState(false);
+
+ // [MOVED FROM BELOW EARLY RETURN] Preview helper exercise.
+ const _previewAfter = useMemo(() => { ... }, [reconciliation, drafts, phase_breakdown]);
+ void _previewAfter;

  if (!open) return null;

  const totalPhases = reconciliation.phases.length;
  const confirmAllEligible = canOfferConfirmAll(reconciliation);

- // [DELETED] const [pendingPhaseIds, ...] = useState(...);
- // [DELETED] const [pendingAll, ...] = useState(...);
  const anyPending = pendingAll || pendingPhaseIds.size > 0;

  // ... handlers unchanged ...

- // [DELETED] const _previewAfter = useMemo(...);
- // [DELETED] void _previewAfter;

  return ( /* unchanged JSX */ );
```

Plain values that are NOT hooks (`totalPhases`, `confirmAllEligible`, `anyPending`, `confirmedCount`, the two handler functions) stay below the early return — they don't violate the Rules of Hooks and don't need to run when the modal is closed.

## Verification

1. **Build clean**: `bunx tsc --noEmit` passes.
2. **Manual repro**:
   - Open Slant in `/athlete-lab`.
   - Click migration banner → modal opens with no crash, no blank screen.
   - Close → reopen → still works (hook count stable across mount/unmount cycles).
   - Confirm one phase → "Saving…" state renders → confirms the moved `pendingPhaseIds` state still drives in-flight UI correctly.
   - Confirm-all path (if eligible) exercises the moved `pendingAll` state.
3. **Console**: zero "Rendered more hooks" warnings, zero "change in the order of Hooks" warnings.

## Out of scope

- The `SectionTooltip` `forwardRef` warning that also appears in the console — separate issue in `PhasesEditor`, not blocking the modal. Will flag for a follow-up but not touching in this hotfix.
- The `onStatusChange` no-op prop cleanup — already inherited by 1c.2, not addressed here.

## Ship path

After fix lands and passes manual repro, Publish → Update. Then you can resume Action 2 (Slant migration confirmation).
