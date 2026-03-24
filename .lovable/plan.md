

## In-App Email Compose & Phone Transfer from Sales Lead Drawer

### Problem
1. **Email**: Clicking the email icon opens the external mail client (`mailto:`). User wants it to open the in-app compose dialog instead.
2. **Phone**: After calling, user wants to be able to transfer the call to their RingCentral mobile app. The Embeddable widget already supports transfer — but the widget needs to be shown after initiating the call.

### Changes

**File**: `src/components/inbox/ComposeEmailDialog.tsx`
- Add optional props: `initialTo?: string`, `initialSubject?: string`
- Use them to pre-fill the `to` and `subject` fields via `useEffect` when dialog opens

**File**: `src/components/sales/SalesLeadDrawer.tsx`
1. **Email button**: Replace `window.location.href = mailto:...` with opening `ComposeEmailDialog` inside the drawer
   - Add state `composeOpen` to control the dialog
   - Pre-fill `initialTo` with `lead.contact_email` and `initialSubject` with lead title
   - Import and render `ComposeEmailDialog`

2. **Phone button**: After calling `makeCall()`, also call `showWidget()` to bring up the RingCentral Embeddable widget — which has built-in transfer, hold, mute, and forward-to-phone controls
   - Already have `useRingCentralWidget` imported — just destructure `showWidget` alongside `makeCall`

| File | Change |
|---|---|
| `src/components/inbox/ComposeEmailDialog.tsx` | Add `initialTo` and `initialSubject` optional props |
| `src/components/sales/SalesLeadDrawer.tsx` | Open in-app compose dialog for email; show RC widget after call for transfer |

