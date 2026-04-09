

# Security Incident: Remove Unauthorized User & Add Server-Side Login Restriction

## Incident Report — aw.danandeh@gmail.com

| Field | Detail |
|---|---|
| **Name** | Amir AHD |
| **Email** | aw.danandeh@gmail.com |
| **Registered** | 2026-04-09 13:21:24 UTC (today, ~14 minutes ago) |
| **Method** | Google OAuth |
| **Roles** | None assigned |
| **Company** | Auto-assigned to default company |
| **Pages visited** | /shop-floor, /home, /timeclock (3 page visits total) |
| **Data access** | No data modifications, no chat sessions, no agent interactions |
| **Tokens/integrations** | None |

**How they got in**: Google OAuth creates the user in auth.users *before* the client-side whitelist check runs. The client then signs them out, but the auth record persists.

---

## Plan

### Step 1 — Delete User & Related Data (Migration)

Delete `aw.danandeh@gmail.com` from the system completely:

```sql
-- Delete activity events
DELETE FROM activity_events WHERE actor_id = '864b8382-9c57-4648-9d68-f958af801e01';

-- Delete profile (cascade from auth.users should handle this, but be explicit)
DELETE FROM profiles WHERE user_id = '864b8382-9c57-4648-9d68-f958af801e01';

-- Delete from auth.users (this cascades to all FK-linked tables)
DELETE FROM auth.users WHERE id = '864b8382-9c57-4648-9d68-f958af801e01';
```

### Step 2 — Server-Side Signup Restriction (Edge Function Hook)

Create a **database webhook / auth hook** that blocks unauthorized signups at the server level, so no user record is even created for non-whitelisted emails.

**Option A — Auth Hook (Custom Access Token)**: Not suitable here since we need to block *before* user creation.

**Option B — Database trigger on auth.users**: Create a `BEFORE INSERT` trigger on `auth.users` that checks the email against the allowed list and raises an exception if not whitelisted. This prevents the row from being created at all.

```sql
CREATE OR REPLACE FUNCTION public.restrict_signups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed_emails text[] := ARRAY[
    'sattar@rebar.shop', 'radin@rebar.shop', 'zahra@rebar.shop',
    'neel@rebar.shop', 'vicky@rebar.shop', 'kourosh@rebar.shop',
    'saurabh@rebar.shop', 'ben@rebar.shop', 'ai@rebar.shop',
    'tariq0001010@gmail.com'
  ];
BEGIN
  IF NOT (lower(NEW.email) = ANY(allowed_emails)) THEN
    RAISE EXCEPTION 'Signup not allowed for this email'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_allowed_signups
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_signups();
```

> **Note**: This is a trigger on `auth.users` (a reserved schema). This is one of the rare cases where it's justified — it acts as a hard security gate. However, if this causes issues with Supabase internals, we can fall back to a post-signup cleanup approach using a database webhook.

### Step 3 — Keep Client-Side Guards (No Changes)

The existing client-side guards in `auth.tsx`, `Login.tsx`, and `ProtectedRoute.tsx` remain as UX-level backup. No changes needed.

---

## Summary

- **1 migration**: Delete user + create signup restriction trigger
- **0 code changes**: Client-side whitelist already works correctly as UX gate
- **Result**: `aw.danandeh@gmail.com` fully removed; no unauthorized email can create an account

