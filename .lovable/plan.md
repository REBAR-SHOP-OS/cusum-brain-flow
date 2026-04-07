

# Restrict Sales Lead Assignees to Neel and Saurabh Only

## Problem
The Lead Form modal in the Sales Pipeline shows all active profiles in the "Assign To" dropdown. Per business rules, only **Neel Mahajan** (`neel@rebar.shop`) and **Saurabh Seghal** (`saurabh@rebar.shop`) should appear as assignable members.

## Change

**File: `src/components/pipeline/LeadFormModal.tsx`** (line 73)

Replace the current `activeProfiles` filter:
```typescript
const activeProfiles = (profiles ?? []).filter(p => p.is_active);
```

With an email-based whitelist filter:
```typescript
const SALES_ASSIGNEE_EMAILS = ["neel@rebar.shop", "saurabh@rebar.shop"];
const activeProfiles = (profiles ?? []).filter(
  p => p.is_active && p.email && SALES_ASSIGNEE_EMAILS.includes(p.email.toLowerCase())
);
```

This ensures only Neel and Saurabh appear in the assignee picker for new and edited leads. One line change, no other files affected.

