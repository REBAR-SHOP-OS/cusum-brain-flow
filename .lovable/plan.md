

# Fix: Stop Sending Internal Notes/Logs to Customers

## Problem
The `notify-lead-assignees` function (lines 77-84) unconditionally adds the lead's `contact_email` to the recipient list. This means customers receive emails about every note and stage change — including internal discussions. Only @mentioned external parties should receive emails.

## Changes

### `supabase/functions/notify-lead-assignees/index.ts`
- **Remove** the automatic `contact_email` addition block (lines 77-84)
- Customers should only receive emails if they are explicitly assigned to the lead AND @mentioned (already handled by the external assignee logic on lines 67-74)
- Internal `@rebar.shop` assignees continue to receive all notifications as before

### Before (lines 77-84):
```typescript
// Add customer (contact_email) as recipient if available
const customerEmail = lead.contact_email?.trim().toLowerCase() || "";
if (customerEmail) {
  const alreadyIncluded = recipients.some(r => r.email.toLowerCase() === customerEmail);
  if (!alreadyIncluded) {
    recipients.push({ email: lead.contact_email, full_name: lead.contact_name || lead.contact_email });
  }
}
```

### After:
Remove this entire block. No replacement needed — external recipients are already handled by the @mention logic above.

## Result
- Internal `@rebar.shop` assignees: always notified (unchanged)
- External assignees: notified only when @mentioned (unchanged)
- Customers (`contact_email`): no longer auto-notified — they only get emails if explicitly assigned AND @mentioned

| File | Change |
|---|---|
| `supabase/functions/notify-lead-assignees/index.ts` | Remove auto-add of contact_email to recipients |

