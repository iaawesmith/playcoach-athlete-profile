

## Show Results Section in Run Analysis Tab

### Problem
The results section in the Run Analysis tab is completely hidden until an analysis is run. There's no visual indication of what output to expect, so the panel looks incomplete.

### Solution
Add an empty state placeholder in the results area that's always visible below the input section. After analysis runs, it gets replaced with the actual results. This makes the full testing capability immediately obvious.

### Changes

**`src/features/athlete-lab/components/TestingPanel.tsx`**

- Add a visual divider between input and output sections
- When no analysis has been run yet (`result === null` and no error), show an empty state card with:
  - Icon (e.g. `science` or `analytics`)
  - Message: "Run an analysis to see scoring, phase breakdown, metrics, and coach feedback here"
  - Subtle list previewing the output sections: Overall Score, Phase Breakdown, Strengths & Improvements, Raw Metrics, Elite Comparison, Coach Feedback
- Keep the existing rich results display for when `result` is populated
- Ensure the entire panel scrolls smoothly within the editor

### Result
The Run Analysis tab will always show both halves — input on top, output area on bottom — so the admin immediately understands the full capability of the testing panel.

