

## Remove "On Your Profile" Fields for Non-Identity Sections

Currently when Performance, Develop, Pulse, or Connect is active, the "On Your Card" section shows a Coming Soon placeholder — but the entire "On Your Profile" group (Recruiting, Eligibility, Upcoming Game, Story) still renders below it. Those fields are identity-specific and should be hidden for the other four sections.

### Change — `src/features/builder/components/IdentityForm.tsx`

Wrap the "On Your Profile" group and all its child sections (Recruiting, Eligibility, Upcoming Game, Story — lines 517–653) inside the same `activeSection === "identity"` conditional. When a non-identity section is active, only the "On Your Card" Coming Soon placeholder renders — nothing else.

Result: Performance, Develop, Pulse, and Connect each show only the Coming Soon card. Identity remains completely untouched.

### Files modified
- `src/features/builder/components/IdentityForm.tsx`

