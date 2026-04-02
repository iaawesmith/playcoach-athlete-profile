

## UI Polish Pass — Preview Header, Editor Layout, and Media Prominence

Several targeted refinements across three files.

### 1. Go Live → Icon-only button (`BuilderLayout.tsx`)

Replace the "Go Live" / "Publish" text button with a `w-8 h-8` kinetic-gradient circle containing the Material Symbol `rocket_launch`. Same `publishProfile` onClick. When live, swap to a `check_circle` icon in a glass-card circle (same size as the share button). This keeps the header compact and lets "Identity Preview" fit on one line.

The header row becomes:

```text
IDENTITY PREVIEW        [🚀] [↗]
● Draft
```

### 2. Section label on one line (`BuilderLayout.tsx`)

The label is already single-line — the icon buttons being smaller guarantees it won't wrap. No text change needed beyond the button swap above.

### 3. Fix Measurables label alignment (`IdentityPreview.tsx`)

The section labels inside IdentityPreview ("Measurables", "Recruiting", etc.) are rendered as inline `<span>` elements with different padding than the blocks below them. The Measurables label sits inside a bare `<div>` while Recruiting/Eligibility labels sit inside their card's `p-4`. Fix by making all section labels consistent — either all outside their cards (like Measurables) or all inside. Best approach: keep them all outside, and ensure every block's outer wrapper has `px-0` so labels align flush left with the `max-w-sm` container edge.

Currently Recruiting label has `p-4` on its parent card pushing it inward. Move the label span outside the card div for Recruiting, Eligibility, and Upcoming Game — matching the Measurables pattern. All labels become siblings at the same indent level.

### 4. ProCard name on one line (`ProCard.tsx`)

Merge the two `<h3>` elements (firstName / lastName on separate lines) into a single `<h3>` with both names separated by a space. Reduce text size from `text-5xl` to `text-4xl` to accommodate longer combined names. This reclaims vertical space on the card.

### 5. Editor: First Name + Last Name on one row (`IdentityForm.tsx`)

Wrap the two InputCard fields in a `grid grid-cols-2 gap-4` — same pattern already used for measurables. Similarly, put Jersey # and Class Year on one row.

### 6. Editor: Promote media uploads into "Your Identity" section (`IdentityForm.tsx`)

Move the Action Photo and School Logo upload buttons from the separate "Your Media" section into "Your Identity", placing them above the name fields. Make them more prominent:

- **Action Photo**: taller upload zone (`min-h-[120px]`), larger icon (`text-4xl`), and a subtitle prompt: "This is the hero of your card". When a photo is set, show a larger preview (`w-16 h-16`).
- **School Logo**: same treatment but slightly smaller (`min-h-[80px]`).
- Remove the "Your Media" SectionHeader entirely — the uploads now live under "Your Identity".

### Files modified
- `src/features/builder/BuilderLayout.tsx`
- `src/features/builder/components/IdentityPreview.tsx`
- `src/features/builder/components/ProCard.tsx`
- `src/features/builder/components/IdentityForm.tsx`

