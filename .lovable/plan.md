

## Make Brand HQ Person Icon White

### Change
In `src/features/builder/components/SideNav.tsx`, line 40: change the person icon class from `text-on-surface-variant` to `text-white`.

```tsx
- <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: "18px" }}>person</span>
+ <span className="material-symbols-outlined text-white" style={{ fontSize: "18px" }}>person</span>
```

### Files modified
- `src/features/builder/components/SideNav.tsx`

