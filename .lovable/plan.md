

## Make Help Icon More Visible (Green Solid Fill + White Icon)

### Problem
The help icon (`?`) that opens the admin guidance drawer is barely visible — it's a faint ghost icon (`text-on-surface-variant/40`) that blends into the dark background.

### Solution
Update the help button styling on **line 152** of `NodeEditor.tsx` to use a solid Performance Green (`bg-primary-container`) background with white icon text, making it immediately noticeable on every tab.

### Change
**`src/features/athlete-lab/components/NodeEditor.tsx`** — line 152

Current:
```
className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant/40 hover:text-primary-container hover:bg-surface-container-high transition-colors"
```

Updated:
```
className="ml-auto w-7 h-7 rounded-full bg-primary-container flex items-center justify-center text-white hover:brightness-110 transition-all active:scale-95"
```

This gives it a solid green circle with a white `?` icon — consistent across all tabs since it's rendered once in the shared tab header area.

