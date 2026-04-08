

# Add Quotation Icon + Log Sent Quotes to Timeline

## Changes

### 1. `src/components/sales/LeadSmartButtons.tsx`

**Add "+" icon to Quotes smart button:**
- Import `Plus` from lucide-react, `useNavigate` from react-router-dom
- Add a small Plus icon button at the right edge of the Quotes card (both popover and empty states)
- On click: `navigate('/sales/quotations')` to create a new quotation

**Log sent quotes to timeline:**
- After successful quote send (line 79, after status update), insert a record into `sales_lead_activities`:
  - `sales_lead_id`: leadId
  - `company_id`: fetched from the lead or passed as new prop
  - `activity_type`: "email"
  - `subject`: "Quote {quotationNumber} sent"
  - `body`: "Quotation {quotationNumber} sent to {email}"
  - `completed_at`: now
- Invalidate chatter queries so the timeline updates immediately

### 2. `src/components/sales/SalesLeadDrawer.tsx`

- Pass `companyId={lead.company_id}` as a new prop to `<LeadSmartButtons>`

### Summary

| File | Change |
|------|--------|
| `LeadSmartButtons.tsx` | Add Plus icon for new quotation + insert activity on quote send |
| `SalesLeadDrawer.tsx` | Pass `companyId` prop to LeadSmartButtons |

