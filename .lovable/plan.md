

# Fix: Allow Zahra to Publish Without Approval Gate

## Problem
The frontend correctly allows `zahra@rebar.shop` and `radin@rebar.shop` to click "Publish Now" (`canPublish`), but the **edge function** (`social-publish/index.ts`) has a hard gate at line 128-135 that blocks ALL users when `neel_approved = false`. This causes the "requires approval from Neel or Sattar" error.

## Change

### File: `supabase/functions/social-publish/index.ts` (lines 128-135)

Before the `neel_approved` check, look up the publishing user's email. If the user is `radin@rebar.shop` or `zahra@rebar.shop`, skip the approval gate (same logic as the frontend `canPublish`).

```typescript
// Look up publisher's email for canPublish bypass
const { data: publisher } = await supabaseAdmin
  .from("profiles")
  .select("email")
  .eq("user_id", userId)
  .maybeSingle();
const publisherEmail = publisher?.email || "";
const canBypassApproval = ["radin@rebar.shop", "zahra@rebar.shop"].includes(publisherEmail);

// HARD GATE: require neel_approved unless user has publish bypass
if (!existing?.neel_approved && !canBypassApproval) {
  // ... existing 403 response
}
```

This aligns the server-side gate with the existing frontend permission, fixing the error for Zahra.

