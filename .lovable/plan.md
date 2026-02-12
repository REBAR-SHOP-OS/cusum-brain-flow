

# Give Penny Access to QuickBooks Financial Reports

## Problem
Penny says she can't provide monthly financial reports because `fetchQuickBooksLiveContext` only fetches customers, open invoices, recent payments, and company info. It does NOT fetch QuickBooks **reports** (Profit & Loss, Balance Sheet, expense accounts). So when you ask for a January financial report, she literally doesn't have the data.

## Solution
Add QuickBooks Report API calls to the `fetchQuickBooksLiveContext` helper so Penny (and Vizzy) automatically receive P&L and Balance Sheet data in their context.

## Technical Changes

### File: `supabase/functions/ai-agent/index.ts`

**1. Add Profit & Loss report fetch** (inside `fetchQuickBooksLiveContext`, after the company info fetch ~line 1808):

Query the QuickBooks Reports API for the Profit & Loss report. The API supports date filtering, so we fetch the requested period (defaulting to prior month):

```
GET /v3/company/{realmId}/reports/ProfitAndLoss
  ?start_date=2025-01-01&end_date=2025-01-31
  &accounting_method=Accrual
```

Since the agent doesn't know ahead of time which month the user will ask about, we'll fetch:
- **Current fiscal year P&L** (Jan 1 to today) with `summarize_column_by=Month` so Penny gets monthly breakdown
- **Balance Sheet** as of today

This gives Penny all the data she needs to answer "give me January financials" or any other month.

```typescript
// Fetch Profit & Loss (full year, monthly columns)
try {
  const fiscalYearStart = `${new Date().getFullYear()}-01-01`;
  const today = new Date().toISOString().split("T")[0];
  const plRes = await fetch(
    `${qbApiBase}/v3/company/${config.realm_id}/reports/ProfitAndLoss?start_date=${fiscalYearStart}&end_date=${today}&summarize_column_by=Month&accounting_method=Accrual`,
    { headers: { "Authorization": `Bearer ${config.access_token}`, "Accept": "application/json" } }
  );
  if (plRes.ok) {
    const plData = await plRes.json();
    context.qbProfitAndLoss = plData;
  }
} catch (e) { console.error("[QB] Failed to fetch P&L:", e); }

// Fetch Balance Sheet
try {
  const today = new Date().toISOString().split("T")[0];
  const bsRes = await fetch(
    `${qbApiBase}/v3/company/${config.realm_id}/reports/BalanceSheet?date_macro=Today&accounting_method=Accrual`,
    { headers: { "Authorization": `Bearer ${config.access_token}`, "Accept": "application/json" } }
  );
  if (bsRes.ok) {
    const bsData = await bsRes.json();
    context.qbBalanceSheet = bsData;
  }
} catch (e) { console.error("[QB] Failed to fetch Balance Sheet:", e); }

// Fetch all accounts (for expense breakdown)
try {
  const acctRes = await fetch(
    `${qbApiBase}/v3/company/${config.realm_id}/query?query=SELECT * FROM Account WHERE Active = true MAXRESULTS 100`,
    { headers: { "Authorization": `Bearer ${config.access_token}`, "Accept": "application/json" } }
  );
  if (acctRes.ok) {
    const acctData = await acctRes.json();
    context.qbAccounts = (acctData.QueryResponse?.Account || []).map((a) => ({
      id: a.Id, name: a.Name, type: a.AccountType, subType: a.AccountSubType,
      balance: a.CurrentBalance, classification: a.Classification,
    }));
  }
} catch (e) { console.error("[QB] Failed to fetch accounts:", e); }
```

**2. Update Penny's system prompt** (~line 766-776) to tell her about the new data:

Add to the "READ Operations" section:
```
8. **Profit & Loss Report**: Available in `qbProfitAndLoss` — full year P&L with monthly columns. Use this for revenue, COGS, gross profit, expenses, and net income for any month.
9. **Balance Sheet**: Available in `qbBalanceSheet` — current balance sheet with assets, liabilities, equity.
10. **Chart of Accounts**: Available in `qbAccounts` — all active accounts with type, classification, and current balance.
```

Update the "When Answering Questions" section to add:
```
- For monthly financial reports: Use qbProfitAndLoss data, extract the relevant month's column, and present Revenue, COGS, Gross Profit, Operating Expenses (broken down by account), and Net Profit.
- For balance sheet questions: Use qbBalanceSheet data.
- For expense breakdowns: Combine qbProfitAndLoss expense rows with qbAccounts for category details.
```

## Scope
- One file modified: `supabase/functions/ai-agent/index.ts`
- Three new QB API calls added to `fetchQuickBooksLiveContext`
- Penny's prompt updated with new data references
- Redeploy `ai-agent` edge function

