

# Add "Send Message" and "WhatsApp" Buttons to Sales Lead Chatter

## What
Add two new action buttons to the SalesLeadChatter timeline tab — **Send Message** (opens the existing ComposeEmailDialog) and **WhatsApp** (opens WhatsApp Web with the lead's phone number pre-filled) — matching the Odoo-style button bar shown in the reference screenshot.

## Changes

### 1. `src/components/sales/SalesLeadChatter.tsx`
- Add `contact_email`, `contact_phone`, and `lead_title` to the Props interface
- Add `onComposeEmail` callback prop (to trigger the ComposeEmailDialog in the parent drawer)
- Add a **Send Message** button (Mail icon) that calls `onComposeEmail`
- Add a **WhatsApp** button (MessageCircle icon) that opens `https://wa.me/{phone}` in a new tab (stripping non-numeric chars from `contact_phone`)
- Reorder buttons: **Send Message** | **Log Note** | **WhatsApp** | **Schedule Activity**
- WhatsApp button is hidden if no `contact_phone` is available

### 2. `src/components/sales/SalesLeadDrawer.tsx`
- Pass `contact_email`, `contact_phone`, `lead_title` and `onComposeEmail={() => setComposeOpen(true)}` to `SalesLeadChatter`

## Button Layout
```text
[ ✉ Send Message ] [ 💬 Log Note ] [ WhatsApp ] [ 📅 Schedule Activity ]
```

## Files Changed

| File | Change |
|---|---|
| `src/components/sales/SalesLeadChatter.tsx` | Add props + 2 new buttons |
| `src/components/sales/SalesLeadDrawer.tsx` | Pass contact info + compose callback |

