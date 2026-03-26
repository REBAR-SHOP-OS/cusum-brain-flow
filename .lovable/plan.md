

# Fix: `notify-lead-assignees` crashes due to undefined `customerEmail`

## Problem
Line 314 references `customerEmail` which was removed in a previous fix (when we stopped auto-adding `contact_email` to recipients). This causes a runtime `ReferenceError`, crashing the function — **no one** gets email notifications for lead notes or stage changes.

## Fix
On line 314, replace the `customerEmail` check with a direct comparison against `lead.contact_email`. Since customers are no longer auto-added to `recipients`, this branch will almost never match (only if a customer is explicitly assigned AND @mentioned), but it needs to be valid code.

### Change in `supabase/functions/notify-lead-assignees/index.ts`

**Line 314** — replace:
```ts
const isCustomer = customerEmail && recipient.email.toLowerCase() === customerEmail;
```
with:
```ts
const isCustomer = lead.contact_email && recipient.email.toLowerCase() === lead.contact_email.toLowerCase();
```

This restores the logic: if the recipient happens to be the lead's contact (rare, only via @mention), send them the customer-safe email (no internal links). Everyone else gets the internal branded email.

## Result
- The function stops crashing
- Saurabh and all assignees will receive email notifications again
- One file changed: `supabase/functions/notify-lead-assignees/index.ts`

