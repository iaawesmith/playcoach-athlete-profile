

## Make Editor Panel Section-Aware

Currently `BuilderLayout.tsx` always renders `<IdentityForm />` in the right column. The "On Your Card" fields (Your Identity, Position & Details, Measurables) are identity-specific and should only show when `activeSection === "identity"`. For other sections, show a "Coming Soon" placeholder under the "On Your Card" header.

### Changes

**`src/features/builder/components/IdentityForm.tsx`**

Read `activeSection` from the store. Wrap the "On Your Card" content conditionally:

- When `activeSection === "identity"`: render all current fields (Your Identity, Position & Details, Measurables) as they are now
- When any other section is active: render the `GroupHeader "On Your Card"` followed by a Coming Soon placeholder panel (same style as the preview placeholder — centered icon + section name + "Coming Soon" text, using `sectionIcons` for the icon)

The "On Your Profile" group and everything below it stays visible for all sections since those fields (Recruiting, Eligibility, Upcoming Game, Story) apply across sections.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

