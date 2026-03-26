

# Add CC and BCC Fields to ComposeEmail and Gmail Send

## Problem
The email compose dialog only has a "To" field. The user wants CC and BCC support.

## Changes

| File | Change |
|---|---|
| `src/components/email/ComposeEmail.tsx` | Add `cc` and `bcc` state fields + Input fields after "To". Pass them to `sendGmailMessage`. |
| `src/lib/gmail.ts` | Add optional `cc` and `bcc` params to `sendGmailMessage` interface and forward them to the edge function. |
| `supabase/functions/gmail-send/index.ts` | Accept `cc`/`bcc` in schema. Add `Cc:` and `Bcc:` headers in `createRawEmail`. |

### UI Layout
- Add CC and BCC input fields between To and Subject in the form
- Collapsible: show a "CC/BCC" toggle link next to the To label; clicking it reveals the fields. This keeps the UI clean for simple emails.

### Edge Function (`createRawEmail`)
```
Cc: user@example.com
Bcc: user2@example.com
```
These are standard RFC 2822 headers added before the MIME-Version line.

