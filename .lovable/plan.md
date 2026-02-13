

# Security Hardening -- Remaining Audit Items

## Status of Previously Fixed Items (no changes needed)
- S1 (Admin PIN): Already server-side via `supabase.rpc("verify_admin_pin")`
- S4 (Customer portal): Already scoped with `delivery_stops!inner` + `.eq("delivery_stops.customer_id")`
- S10 (CEO Portal): Already has admin-only guard via `useUserRole`
- S3, S5, S6, S7 (RLS policies): Already applied via migration

---

## Remaining Changes

### 1. AdminPanel.tsx -- Harden PIN useEffect
**File**: `src/pages/AdminPanel.tsx` (lines 67-83)

Add error handling for RPC failures and a cleanup flag to prevent state updates after unmount:

```typescript
useEffect(() => {
  let cancelled = false;
  if (pinValue.length === 4) {
    supabase.rpc("verify_admin_pin", { _pin: pinValue }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || data !== true) {
        setPinError(true);
        setTimeout(() => {
          if (!cancelled) {
            setPinValue("");
            setPinError(false);
          }
        }, 800);
      } else {
        setPanelUnlocked(true);
        setPinError(false);
      }
    });
  }
  return () => { cancelled = true; };
}, [pinValue]);
```

### 2. Office Portal -- Add Role Guard
**File**: `src/pages/OfficePortal.tsx`

Add admin/office role check at top of component (same pattern as CEOPortal):

```typescript
import { useUserRole } from "@/hooks/useUserRole";
import { Shield } from "lucide-react";

export default function OfficePortal() {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  // ... existing code

  if (roleLoading) return null;
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Shield className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">Only administrators can access the Office Portal.</p>
        </div>
      </div>
    );
  }
  // ... rest of component
}
```

### 3. Edge Functions -- config.toml JWT Hardening

**File**: `supabase/config.toml`

Categorize all 62 functions and set `verify_jwt` accordingly:

| Category | Functions | verify_jwt |
|----------|----------|------------|
| **Webhooks** (external callbacks, no JWT possible) | gmail-webhook, ringcentral-webhook, facebook-data-deletion | `false` |
| **OAuth redirects** (browser redirect flows) | google-oauth, ringcentral-oauth, quickbooks-oauth, facebook-oauth, linkedin-oauth, tiktok-oauth | `false` |
| **Cron/automation** (service-role or secret auth) | daily-summary, archive-odoo-files, comms-alerts, email-activity-report, process-rfq-emails, relink-orphan-invoices | `false` |
| **MCP server** (API key auth, not JWT) | mcp-server | `false` |
| **All other user-facing functions** (37 functions) | ai-agent, gmail-sync, gmail-send, gmail-delete, ringcentral-sync, summarize-call, ringcentral-recording, ringcentral-ai, ringcentral-video, google-vision-ocr, pdf-to-images, import-crm-data, draft-email, log-machine-run, manage-machine, shape-vision, extract-manifest, handle-command, manage-extract, manage-inventory, smart-dispatch, translate-message, diagnostic-logs, summarize-meeting, pipeline-ai, generate-video, generate-image, social-publish, auto-generate-post, face-recognize, payroll-engine, meeting-live-notes, transcribe-translate, elevenlabs-conversation-token, vizzy-photo-analyze, vizzy-erp-action, generate-suggestions, relay-pipeline | `false` (keep as-is) |

**Important note on verify_jwt**: Because this project uses Lovable Cloud's signing-keys system, `verify_jwt = true` does **not** work correctly -- it causes 401 errors for all requests. Per the platform guidelines, the correct pattern is `verify_jwt = false` with in-code JWT validation via `getClaims()` or `requireAuth()`. Therefore **no changes to config.toml are needed**. The existing internal auth checks (`requireAuth()` in `_shared/auth.ts`) are the correct approach.

Instead, the hardening focus should be on ensuring the unprotected endpoints (webhooks, cron) validate their callers:

**3a. Cron endpoints** -- already handled:
- `archive-odoo-files`: Now accepts service-role key (fixed in previous session)
- `daily-summary`, `comms-alerts`, `email-activity-report`: Called via `pg_cron` with service-role key in Authorization header

**3b. Webhook endpoints** -- already have provider-specific validation:
- `gmail-webhook`: Validates Google Pub/Sub message format
- `ringcentral-webhook`: Handles RC validation token handshake
- `facebook-data-deletion`: Facebook-signed callback

No config.toml changes are safe to make given the signing-keys constraint.

### 4. Validation Checklist

After implementation, verify:

| Check | Method |
|-------|--------|
| Admin PIN works for admin users | Navigate to /admin, enter 7671 |
| PIN error handling works | Enter wrong PIN, verify reset after 800ms |
| Non-admin blocked from /ceo | Log in as non-admin, navigate to /ceo |
| Non-admin blocked from /office | Log in as non-admin, navigate to /office |
| Customer portal scoped correctly | Check deliveries query includes customer filter |
| No hardcoded PIN in source | Search codebase for "7671" -- should only exist in DB function |

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/pages/AdminPanel.tsx` | Add cleanup flag + error handling to PIN useEffect |
| `src/pages/OfficePortal.tsx` | Add admin-only role guard |
| `supabase/config.toml` | No changes (verify_jwt must stay false due to signing-keys) |

Total: 2 files modified, 0 new files, 0 database changes.
