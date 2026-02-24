

## Fix: Show Detailed Error Messages in Sales Receipt Tab

### Problem
When the Sales Receipts tab encounters an error (e.g., QuickBooks API failure, expired token), it shows a generic red toast like "Error loading sales receipts" with a vague message such as "Edge Function returned a non-2xx status code" instead of the actual error (e.g., "QuickBooks API error (401): query?query=SELECT * FROM SalesReceipt...").

### Root Cause
The edge function (`quickbooks-oauth`) correctly returns structured JSON errors like `{ error: "QuickBooks API error (401): ..." }` with a 500 status code. However, `supabase.functions.invoke()` wraps non-2xx responses into a `FunctionsHttpError` object where `.message` is generic. The actual error details are in the response body, which the component never reads.

In `AccountingSalesReceipts.tsx`, both `loadReceipts` and `handleCreate` catch the error and display `e.message` -- which is the generic SDK message, not the server's error detail.

### Solution

**File: `src/components/accounting/AccountingSalesReceipts.tsx`**

Update both `try/catch` blocks in `loadReceipts` and `handleCreate` to use `getErrorMessage` from `@/lib/utils` and also parse the response body from the edge function error when available.

Specifically:
1. Import `getErrorMessage` from `@/lib/utils`
2. In `loadReceipts` (line 46-58): After `supabase.functions.invoke`, check if the response `data` itself contains an `error` field (for cases where the function returns 200 but with an error payload). Also, in the catch block, attempt to read `e.context?.body` (the response text from Supabase SDK) to extract the real error message.
3. In `handleCreate` (line 63-86): Apply the same pattern -- extract the real error message from the response or the caught error.

### Technical Details

| File | Change |
|---|---|
| `src/components/accounting/AccountingSalesReceipts.tsx` | Import `getErrorMessage`; update both catch blocks to parse `e.context?.body` for the real server error message before falling back to `getErrorMessage(e)` |

The key pattern is:

```typescript
} catch (e: any) {
  // supabase.functions.invoke wraps non-2xx in FunctionsHttpError
  // The real error is in the response body
  let msg = getErrorMessage(e);
  try {
    const body = e?.context?.body ? await e.context.body.text() : null;
    if (body) {
      const parsed = JSON.parse(body);
      if (parsed.error) msg = parsed.error;
    }
  } catch { /* use fallback msg */ }
  toast({ title: "Error loading sales receipts", description: msg, variant: "destructive" });
}
```

This ensures the actual QuickBooks error message (e.g., "QuickBooks API error (401)") is shown to the user instead of a generic "Edge Function returned a non-2xx status code".

### What is NOT Changed
- No edge function changes needed -- it already returns structured errors
- No database changes
- No changes to other accounting tabs (though they may benefit from the same pattern later)
