
# Fix: SMS Threads Showing as Separate List Entries on /inbox

## Root Cause — Confirmed

The database query confirms this clearly. The `communications` table holds individual SMS messages, each as its own row, sharing a `thread_id` from RingCentral's `conversationId`. For example:

- Thread `8488319220902744000` → **13+ individual rows** (one SMS conversation with +14169909049)
- Thread `3257733667530446300` → **3+ individual rows** (one SMS conversation with +12895271076)
- Thread `8488365758606774000` → **2 rows** (one SMS conversation with +15198070753)

The `useCommunications` hook fetches all rows flat (no grouping). The `InboxView.allEmails` `useMemo` then maps each row 1:1 to a list item. No deduplication or thread-collapsing step exists anywhere.

**The fix is entirely client-side** — one new `useMemo` step added to `InboxView.tsx` that collapses SMS rows by `thread_id` before the list renders. No database changes, no hook changes, no other files touched.

## What Will Be Changed

**File:** `src/components/inbox/InboxView.tsx`

**Where:** Inside the `allEmails` `useMemo` (lines 294–337), **after** the existing `.map()` that converts communications to `InboxEmail` objects.

### The Grouping Logic

After mapping all communications to `InboxEmail` objects, a new pass groups SMS entries by their `threadId`:

1. Build a `Map<threadId, InboxEmail[]>` — collect all SMS items that share a `threadId`.
2. For each group, keep the **most recent** item (already first since the query orders by `received_at DESC`).
3. Set the representative item's `preview` to the most recent SMS text.
4. Set `isUnread = true` on the representative if **any** message in the group is unread.
5. Append a message count badge to `subject` when the group has >1 message (e.g., "Hey call me (4 messages)").
6. Non-SMS items (email, call) and SMS items with no `threadId` pass through unchanged.

### Exact Code Change

**Before** (line ~336, end of `allEmails` useMemo):

```tsx
  }, [communications]);
```

**After** — add the SMS thread-collapsing step before the `return`:

```tsx
  // Collapse SMS messages that share the same threadId into one list entry
  const smsThreadMap = new Map<string, typeof mapped[number][]>();
  const result: typeof mapped = [];

  for (const item of mapped) {
    if (item.commType === "sms" && item.threadId) {
      const key = item.threadId;
      if (!smsThreadMap.has(key)) smsThreadMap.set(key, []);
      smsThreadMap.get(key)!.push(item);
    } else {
      result.push(item);
    }
  }

  // For each SMS thread, emit one representative entry (most recent first, 
  // since the DB query orders by received_at DESC)
  for (const [, group] of smsThreadMap) {
    const representative = group[0]; // most recent
    const hasUnread = group.some((m) => m.isUnread);
    const count = group.length;
    result.push({
      ...representative,
      isUnread: hasUnread,
      subject: count > 1
        ? `${representative.preview || "SMS message"} (${count} messages)`
        : representative.preview || "SMS message",
      preview: representative.preview || "",
    });
  }

  return result;
  }, [communications]);
```

## What Is NOT Changed

- `useCommunications.ts` — the data fetching hook is untouched
- The database schema, RLS policies, or any edge functions
- The `InboxEmailList`, `SwipeableEmailItem`, or any other list/viewer component
- Email or call entries — only SMS items with a matching `threadId` are grouped
- The `InboxDetailView` thread-loading logic (already fetches by `thread_id` correctly for the detail view)
- Any sorting, filtering, search, or labeling logic — the collapsed entries participate normally in all existing filters

## Scope Summary

| File | Lines affected | Change |
|---|---|---|
| `src/components/inbox/InboxView.tsx` | ~294–337 (allEmails useMemo) | Add SMS thread-collapsing step after the `.map()` |

One file. One `useMemo`. No backend changes.
