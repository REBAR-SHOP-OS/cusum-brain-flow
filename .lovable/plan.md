

## Add RingCentral Call & Email Actions to Sales Lead Drawer

### Problem
The phone number and email in the lead drawer are plain links (`tel:` and `mailto:`). Users want to:
1. **Click-to-call** via RingCentral (using the Embeddable widget) directly from the lead drawer
2. **Send email** by clicking the email — open compose window

### Changes

**File**: `src/components/sales/SalesLeadDrawer.tsx`

1. **Import `useRingCentralWidget`** hook to get `makeCall` function
2. **Replace the phone `<a href="tel:...">` link** (line 156-158) with a row containing:
   - The phone number text (still displayed)
   - A small `Phone` icon button that calls `makeCall(lead.contact_phone)` to initiate a RingCentral call via the Embeddable widget
3. **Replace the email `<a href="mailto:...">` link** (line 148-150) with a row containing:
   - The email text (still displayed)
   - A small `Mail` icon button that opens `mailto:` compose

This uses the existing `useRingCentralWidget` hook already used in `LiveChat.tsx`. The Embeddable widget handles the actual call UI (transfer, hold, etc.) — clicking the button triggers the call and the widget pops up with full call controls including transfer capability.

### Result
- Phone number shows a call button that initiates a RingCentral call via the browser widget
- The RingCentral widget provides built-in transfer/hold/mute controls
- Email shows a button that opens the user's email client to compose

| File | Change |
|---|---|
| `src/components/sales/SalesLeadDrawer.tsx` | Add `useRingCentralWidget`, add call & email action buttons |

