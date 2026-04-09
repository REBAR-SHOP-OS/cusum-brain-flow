

# Add "From:" and "To:" Labels to Email Detail View

## Problem
The email detail view shows the sender name/email and "To:" address, but lacks a clear "From:" label — making it hard to distinguish sender from recipient at a glance.

## Change

**File: `src/components/inbox/InboxEmailViewer.tsx`**, lines 328-333

Replace the current sender/recipient block with explicitly labeled "From:" and "To:" lines:

```tsx
<div>
  <div className="flex items-center gap-2">
    <span className="text-xs text-muted-foreground font-medium">From:</span>
    <span className="font-medium text-sm">{email.sender}</span>
    <span className="text-xs text-muted-foreground">&lt;{email.senderEmail}&gt;</span>
  </div>
  <div className="flex items-center gap-2">
    <span className="text-xs text-muted-foreground font-medium">To:</span>
    <span className="text-xs text-muted-foreground">{email.toAddress}</span>
  </div>
</div>
```

This adds a visible "From:" label before the sender name and keeps the existing "To:" line, making both fields clearly labeled like a standard email client.

