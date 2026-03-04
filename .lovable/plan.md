

# Fix: Chatter Tab Empty — Missing `lead_communications` Data

## Root Cause

The **OdooChatter** component (shown in the "Chatter" tab) queries only two tables:
- `lead_activities` — returns `[]` (empty for this lead)
- `lead_events` — returns 2 records (stage_changed, contact_linked)

But the **Odoo-synced chatter history** (stage changes by specific users, field updates, emails, etc.) was imported into the `lead_communications` table. This table is only used by `LeadActivityTimeline`, which appears in a different tab section — not in the Chatter tab.

So the Chatter tab is nearly empty because it's missing the main data source.

## Fix

Integrate `lead_communications` into the `OdooChatter` component's unified thread.

### Changes to `src/components/pipeline/OdooChatter.tsx`

1. **Add a query for `lead_communications`** — fetch all communications for the lead, ordered by `created_at` desc.

2. **Add a new `ThreadItem` kind: `"comm"`** — map each communication record into the unified thread with its date.

3. **Render comm items in the thread** — display them with appropriate icons (email/call/note/meeting), showing:
   - Author (`created_by` or `contact_name`)
   - Subject line (if present)
   - Body preview
   - Direction badge (inbound/outbound)
   - Timestamp

4. **Merge into the existing sort** — communications join activities, events, and files in the single chronological thread, sorted newest-first.

### Key Snippet

```typescript
// New query
const { data: communications = [] } = useQuery({
  queryKey: ["lead-communications-chatter", lead.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("lead_communications")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

// Add to thread items
type ThreadItem =
  | { kind: "activity"; data: LeadActivity; date: Date }
  | { kind: "file"; data: ...; date: Date }
  | { kind: "comm"; data: LeadCommunication; date: Date };

// In thread memo, add:
...communications.map((c) => ({ kind: "comm" as const, data: c, date: new Date(c.created_at) })),
```

### File Changed

| File | Change |
|------|--------|
| `src/components/pipeline/OdooChatter.tsx` | Add `lead_communications` query, merge into unified thread, render comm items with icons/author/subject/body |

