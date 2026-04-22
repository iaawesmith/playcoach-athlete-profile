
Update the Reference Video Quality Guide in `src/features/athlete-lab/components/NodeEditor.tsx` so the Videos tab guidance is route-agnostic and scales beyond Slant Route.

### Scope
Modify only the guide copy inside the collapsible “Reference Video Quality Guide” block:
- `idealCriteria`
- `avoidItems`
- the “Why This Matters” bullet list
- the short collapsed summary line if needed so it matches the new universal framing

### Planned content changes

#### 1) Replace the slant-specific camera-angle guidance in “Ideal Criteria”
Swap the current generic/slant-oriented camera-angle item with this universal rule:

```text
Camera positioned to capture the athlete's face, chest, and hands at the route's critical moment
```

Add the route-agnostic filming rule and examples directly in the guide so admins understand how to apply it across different node types:

```text
Simple rule: film from the side you'll be facing when you make your cut or decision.
```

Examples to include:
- Routes that break inside (slant, post): film from the sideline opposite the break direction
- Routes that break outside (out, corner): film from the sideline the break goes toward
- Routes where you face the QB after the break (curl, hook, comeback): either sideline works

#### 2) Replace the slant-specific warning in “What to Avoid”
Update the warning copy to this universal rule:

```text
Camera angle that shows the athlete's back during the critical moment of the route
```

Add the explanatory line under that section:

```text
If the camera sees the athlete's back during the break, catch, or decision point, key metrics cannot be measured reliably.
```

#### 3) Add a 5th point to “Why This Matters”
Append this new bullet after the existing four points:

```text
Pose estimation requires specific body keypoints (face, shoulders, hips, hands, feet) to be visible during the moments being measured. When the athlete's body blocks these keypoints during a turn or rotation, the model can't evaluate those metrics reliably. Filming from the correct side ensures every metric on the node can be measured.
```

### Implementation notes
- Keep the existing visual structure, icons, spacing, and collapsible behavior unchanged.
- Preserve the current editorial tone and AthleteLab styling.
- Keep the guidance applicable to all current and future skill nodes, not just route-running.
- If the new examples are too long for the current list format, convert that one item into a short primary rule plus nested example lines without changing the rest of the component’s layout.

### Validation after implementation
Once the current pipeline test is finished and this is queued for execution, verify:
- no remaining slant-specific “strong-side / weak-side” wording appears in the guide
- the new rule reads clearly in both collapsed and expanded states
- the examples fit cleanly at desktop and tablet widths without overflowing
- the message now works for inside-break, outside-break, and face-the-QB route families

### Expected outcome
The Videos tab guidance will shift from slant-specific camera instructions to a universal “film from the side the athlete will face at the critical moment” rule, making the Reference Video Quality Guide reusable across all route types and future skill nodes.
