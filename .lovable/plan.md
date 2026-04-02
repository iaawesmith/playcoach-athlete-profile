

## Layout Refinements — Preview Header + Editor Form Compaction

Six targeted changes across two files.

### 1. Move Draft/Live status below label (`BuilderLayout.tsx`)

Currently the status indicator (● Draft / ● Live) sits inline next to "Identity Preview", crowding the line. Move it to a second line below the label. The header becomes:

```text
IDENTITY PREVIEW        [🚀] [↗]
● Draft
```

The label and CTA icons stay on line 1 via `flex justify-between`. Status moves to its own row below, left-aligned.

### 2. Editor: Names above uploads (`IdentityForm.tsx`)

In the "Your Identity" section, move the First Name / Last Name grid row above the Action Photo and School Logo upload buttons. Names are the most fundamental fields — they belong at the top.

### 3. Upload buttons side by side (`IdentityForm.tsx`)

Put Action Photo and School Logo upload buttons in a `grid grid-cols-2 gap-4` row instead of stacked. Both get equal width, reduced `min-h-[80px]`.

### 4. Hometown + High School on one line (`IdentityForm.tsx`)

Wrap in `grid grid-cols-2 gap-4`.

### 5. Merge Commitment into Eligibility, two-column layout (`IdentityForm.tsx`)

Remove the standalone "Commitment" section. Add the Commitment Status select into the "Eligibility" section. Lay out fields in 2-col rows:
- Row 1: Eligibility Years Remaining | Transfer Eligible
- Row 2: Redshirt Status | Commitment Status

### 6. National Rank + Position Rank on one line (`IdentityForm.tsx`)

Wrap in `grid grid-cols-2 gap-4`.

### 7. Upcoming Game fields in 2-col rows (`IdentityForm.tsx`)

- Row 1: Opponent | Date
- Row 2: Time | Network
- Row 3: Location (full width)

### Files modified
- `src/features/builder/BuilderLayout.tsx`
- `src/features/builder/components/IdentityForm.tsx`

