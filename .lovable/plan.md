

# Fix RingCentral Calls Not Connecting

## Root Causes Found

Three issues are preventing calls from actually connecting:

### 1. Sattar has no RingCentral token
The super admin's account (`sattar@rebar.shop`, user ID `c9b3adc2-...`) has **zero entries** in `user_ringcentral_tokens`. So the edge function returns an error "RingCentral not connected" -- but the UI doesn't catch it (see issue 3).

**Fix**: This is a user action -- Sattar needs to reconnect RingCentral via Settings. But we should make the error visible (issue 3).

### 2. Empty `from.phoneNumber` in RingOut API call
The edge function sends `from: { phoneNumber: "" }` which causes RingCentral's API to reject the call with error `CMN-101`. The RingOut API requires either a valid direct number or the user's default number.

**Fix**: Query the user's extension phone numbers from RingCentral and use the first direct number, or omit the `from` field entirely to let RingCentral use the extension's default.

### 3. UI shows "Call initiated!" even when it fails
`supabase.functions.invoke` does not throw on HTTP 400 responses. The edge function returns `{ error: "..." }` with status 400, but the SDK puts that in `data`, not `error`. So the toast always says success.

**Fix**: Check `data.error` in the response before showing success.

## Technical Changes

### File 1: `supabase/functions/ringcentral-action/index.ts`

**A. Fix the `from` phone number for RingOut (line 126-128)**

Replace empty `from.phoneNumber` with a lookup of the user's actual phone number:

```typescript
// Before making the RingOut call, fetch the user's phone number
const extResp = await fetch(
  `${RC_SERVER}/restapi/v1.0/account/~/extension/~/phone-number`,
  { headers: { Authorization: `Bearer ${accessToken}` } }
);
let fromNumber = "";
if (extResp.ok) {
  const extData = await extResp.json();
  const directNum = extData.records?.find(
    (r) => r.usageType === "DirectNumber" && r.features?.includes("CallerId")
  );
  fromNumber = directNum?.phoneNumber || extData.records?.[0]?.phoneNumber || "";
}

// Use the fetched number in RingOut
body: JSON.stringify({
  from: { phoneNumber: fromNumber },
  to: { phoneNumber: phone },
  playPrompt: true,
})
```

**B. Same fix for SMS `from` number (line 154)**

Use the same lookup to get a valid SMS-enabled number:

```typescript
const smsNum = extData.records?.find(
  (r) => r.features?.includes("SmsSender")
);
fromNumber = smsNum?.phoneNumber || fromNumber;
```

**C. Add logging** so we can debug future issues:

```typescript
console.log("RingOut request:", { from: fromNumber, to: phone, userId });
```

### File 2: `src/pages/AgentWorkspace.tsx` (lines 174-178)

**Fix the success check** to handle edge function error responses:

```typescript
const { data, error } = await supabase.functions.invoke("ringcentral-action", {
  body: actionData,
});
if (error) throw error;
// Also check if the edge function returned an error in the body
if (data?.error) throw new Error(data.error);
toast.success(actionData.type === "ringcentral_call" ? "Call initiated!" : "SMS sent!");
```

## What This Won't Fix

Sattar still needs to connect his RingCentral account (his token doesn't exist in the database). But with these changes:
- He'll see a clear error message ("RingCentral not connected") instead of a false "Call initiated!" toast
- Once reconnected, calls will use his actual phone number instead of an empty string

## Scope
- 2 files modified
- `supabase/functions/ringcentral-action/index.ts` -- fix from-number lookup + add logging
- `src/pages/AgentWorkspace.tsx` -- fix false-success toast
- Redeploy `ringcentral-action` edge function
