
# Fix: Add AI "Suggest What to Say" to Email Composition Interfaces

## Root Cause — Confirmed

The `AISuggestButton` component already declares `"email"` as a valid `contextType` and the `ai-inline-suggest` edge function already has a complete email system prompt. The component is used in `Tasks.tsx` for task descriptions and comments — but it was **never wired into any email composition interface**.

Three email composition surfaces exist, none of which use `AISuggestButton`:

| Component | Email body field | AI capability today | Missing |
|---|---|---|---|
| `EmailReplyComposer.tsx` | `replyText` textarea | AI Draft (full auto-generate) | Inline "Suggest" button on textarea label |
| `ComposeEmailDialog.tsx` | `body` textarea | AI Draft + prompt-to-draft | Inline "Suggest" button on textarea label |
| `TableRowActions.tsx` | Email popover body | None | Inline "Suggest" button on body field |

## The Fix — Three Files, Surgical Additions Only

### 1. `src/components/inbox/EmailReplyComposer.tsx`

Add `AISuggestButton` import and place it next to the textarea label row. When the user has typed partial text, clicking "Suggest" will call `ai-inline-suggest` with `contextType="email"` and context from the email thread (subject + sender). The suggestion replaces/fills `replyText`.

**Where:** In the textarea section (line ~246), add a label row above the `SmartTextarea` with the `AISuggestButton`:

```tsx
// Add import at top:
import { AISuggestButton } from "@/components/ui/AISuggestButton";

// Add above the SmartTextarea inside the px-4 div:
<div className="flex items-center justify-between mb-1">
  <span className="text-xs text-muted-foreground">Message</span>
  <AISuggestButton
    contextType="email"
    context={`Subject: ${email.subject}\nFrom: ${email.sender} <${email.senderEmail}>\nOriginal message: ${(email.body || email.preview || "").slice(0, 500)}`}
    currentText={replyText}
    onSuggestion={(text) => setReplyText(text)}
    label="Suggest"
    compact={false}
    disabled={drafting || sending}
  />
</div>
```

### 2. `src/components/inbox/ComposeEmailDialog.tsx`

Add `AISuggestButton` import and place it above the body `SmartTextarea`.

**Where:** In the body section (line ~318–326), add a label row above the textarea:

```tsx
// Add import at top:
import { AISuggestButton } from "@/components/ui/AISuggestButton";

// Add above the SmartTextarea inside the body section:
<div className="flex items-center justify-between mb-1">
  <span className="text-xs text-muted-foreground">Body</span>
  <AISuggestButton
    contextType="email"
    context={`To: ${to}\nSubject: ${subject}`}
    currentText={body}
    onSuggestion={(text) => setBody(text)}
    label="Suggest"
    compact={false}
    disabled={drafting || sending}
  />
</div>
```

### 3. `src/components/accounting/TableRowActions.tsx`

Add `AISuggestButton` import and place it on the email body field inside the email Popover.

**Where:** In the email popover (lines ~70–80), between the subject `Input` and the `SmartTextarea`:

```tsx
// Add import at top:
import { AISuggestButton } from "@/components/ui/AISuggestButton";

// Replace the label above SmartTextarea with a row:
<div className="flex items-center justify-between mb-1">
  <span className="text-xs text-muted-foreground">Body</span>
  <AISuggestButton
    contextType="email"
    context={`Row context: ${rowText}\nSubject: ${emailSubject}`}
    currentText={emailBody}
    onSuggestion={(text) => setEmailBody(text)}
    compact={true}
    disabled={false}
  />
</div>
```

## Scope

| File | Change |
|---|---|
| `src/components/inbox/EmailReplyComposer.tsx` | Add `AISuggestButton` import + label row with Suggest button above body textarea |
| `src/components/inbox/ComposeEmailDialog.tsx` | Add `AISuggestButton` import + label row with Suggest button above body textarea |
| `src/components/accounting/TableRowActions.tsx` | Add `AISuggestButton` import + compact Suggest button next to email body label in popover |

## What Is NOT Changed
- `AISuggestButton.tsx` — untouched (already supports `contextType="email"`)
- `ai-inline-suggest` edge function — untouched (already has email system prompt)
- All other pages, components, database, logic — strictly untouched
- The existing "AI Draft" and "Polish" buttons in EmailReplyComposer and ComposeEmailDialog — untouched
