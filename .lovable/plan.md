

# QA War Simulation Round 7 -- Deep Module Audit

## Scope

This round targets areas NOT covered in Rounds 1-6: XSS vulnerabilities, orphan cascade risks on delete operations, the `completed_pieces` absolute-write concurrency bug, and missing validation in critical flows.

---

## BUG R7-1 -- HIGH: XSS vulnerability in CampaignReviewPanel (unsanitized HTML rendering)

**File**: `src/components/email-marketing/CampaignReviewPanel.tsx` line 149

```typescript
dangerouslySetInnerHTML={{ __html: campaign.body_html || "<p>No content yet</p>" }}
```

`campaign.body_html` is rendered without DOMPurify sanitization. Every other `dangerouslySetInnerHTML` usage in the codebase (`InboxEmailThread`, `EmailViewer`, `InboxEmailViewer`) correctly uses `DOMPurify.sanitize()`. This one does not. If an AI-generated campaign or a user-edited campaign contains malicious script tags, they will execute in the reviewer's browser.

**Fix**: Import DOMPurify and wrap the HTML:
```typescript
import DOMPurify from "dompurify";
// ...
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(campaign.body_html || "<p>No content yet</p>") }}
```

**Severity**: HIGH -- stored XSS in an admin-facing component.

---

## BUG R7-2 -- MEDIUM: Customer delete in `Customers.tsx` does not cascade to child records

**File**: `src/pages/Customers.tsx` lines 207-211

```typescript
const { error } = await supabase.from("customers").delete().eq("id", id);
```

The `ProductionQueueView.tsx` version correctly deletes `contacts` before deleting the customer (line 116-117). But `Customers.tsx` does not. If the database has foreign key constraints with `RESTRICT` (not `CASCADE`), deleting a customer with contacts/orders/leads will fail silently or throw an unhandled error. If constraints are `CASCADE`, it works but inconsistently across UI paths.

**Fix**: Before deleting a customer, delete or check for dependent `contacts`, `orders`, `leads`, and `projects`. Or add a pre-delete check that warns the user if the customer has related records.

**Severity**: MEDIUM -- data integrity risk on delete.

---

## BUG R7-3 -- MEDIUM: `completed_pieces` still uses absolute write (concurrency risk)

**File**: `src/components/shopfloor/CutterStationView.tsx` lines 246-252 and 327-332

Two locations write `completed_pieces` as an absolute value:

1. **Stroke handler** (line 248): `update({ completed_pieces: newCompleted })`
2. **Complete run** (line 330): `update({ completed_pieces: newCompleted })`

If two operators work on the same cut plan item (e.g., after machine reassignment), the second operator's write overwrites the first's progress. The `completedAtRunStart` guard (line 43) mitigates this for a single session but does NOT protect against cross-session writes.

**Fix**: Create a database RPC function:
```sql
CREATE OR REPLACE FUNCTION increment_completed_pieces(
  p_item_id UUID,
  p_increment INT
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new INT;
BEGIN
  UPDATE cut_plan_items
  SET completed_pieces = LEAST(completed_pieces + p_increment, total_pieces)
  WHERE id = p_item_id
  RETURNING completed_pieces INTO v_new;
  RETURN v_new;
END;
$$;
```

Then replace absolute writes with `supabase.rpc("increment_completed_pieces", { p_item_id: currentItem.id, p_increment: piecesThisStroke })`.

**Severity**: MEDIUM -- data corruption under concurrent use.

---

## BUG R7-4 -- LOW: `AccountingCustomers.tsx` delete also lacks child cascade

**File**: `src/components/accounting/AccountingCustomers.tsx` line 64

Same pattern as R7-2. Deletes customer without removing dependent contacts first. Additionally, it attempts to sync QuickBooks deletion after local delete -- if the local delete succeeds but QB sync fails, data becomes inconsistent (customer gone locally but still in QB).

**Fix**: Delete children first, then customer, then QB sync. Wrap in a try-catch that rolls back (re-creates) if QB sync is critical.

**Severity**: LOW -- accounting module delete is less frequently used.

---

## Implementation Plan

### Step 1: Fix R7-1 (XSS) -- Highest priority
- Import `DOMPurify` in `CampaignReviewPanel.tsx`
- Wrap `campaign.body_html` in `DOMPurify.sanitize()`

### Step 2: Fix R7-3 (Concurrency) -- Requires schema change
- Create `increment_completed_pieces` RPC via database migration
- Update `CutterStationView.tsx` stroke handler (line 248) and complete handler (line 330) to use RPC
- Keep `completedAtRunStart` as a UI-level guard but use atomic increment for DB writes

### Step 3: Fix R7-2 (Customer delete cascade)
- Add pre-delete child record cleanup in `Customers.tsx` (match `ProductionQueueView.tsx` pattern)
- Add user confirmation showing count of related records that will be affected

### Step 4: Fix R7-4 (Accounting customer delete)
- Add child record cleanup before customer delete in `AccountingCustomers.tsx`

---

## Technical Details

### Files to modify:
1. `src/components/email-marketing/CampaignReviewPanel.tsx` -- add DOMPurify import + sanitize call
2. `src/components/shopfloor/CutterStationView.tsx` -- replace absolute writes with RPC calls
3. `src/pages/Customers.tsx` -- add child record deletion before customer delete
4. `src/components/accounting/AccountingCustomers.tsx` -- add child record deletion before customer delete

### Database migration:
- Create `increment_completed_pieces` RPC function

### Do NOT touch:
- `InboxEmailThread.tsx`, `EmailViewer.tsx`, `InboxEmailViewer.tsx` (already sanitized)
- `ProductionQueueView.tsx` (already handles cascade correctly)
- `StopIssueDialog.tsx`, `PODCaptureDialog.tsx` (delivery logic unchanged)
- Any realtime channel scoping (completed in Round 6)

---

## Updated Technical Debt Score: 3.2/10

| Category | Score | Delta |
|----------|-------|-------|
| Security (XSS) | 8/10 | -1 (CampaignReviewPanel gap) |
| Multi-tenant isolation | 9/10 | unchanged |
| Data integrity | 8/10 | -1 (delete cascades + absolute writes) |
| Concurrency safety | 5/10 | unchanged until RPC created |
| Code quality | 8/10 | unchanged |

