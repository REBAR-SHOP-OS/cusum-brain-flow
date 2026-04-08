

# Delete User swapnil.m183@gmail.com — Permanent Removal

## What will happen

The user `swapnil.m183@gmail.com` will be completely removed from the system:
- Auth account deleted (no login possible)
- Profile removed from database
- All access config references removed from code
- Will no longer appear in Time Clock, Team Status, or anywhere in the app

## Steps

### 1. Remove from access policies (`src/lib/accessPolicies.ts`)
- Remove from `externalEstimators` map
- Remove from `allowedLoginEmails` array

### 2. Remove from user access config (`src/lib/userAccessConfig.ts`)
- Delete the `"swapnil.m183@gmail.com"` config block (lines 167-170)

### 3. Delete auth user via admin API
- Use the admin edge function or service client to delete auth user `64d0fce5-70da-4369-9d31-6bf14a25b0ef`
- This will cascade-delete the profile `61f3d1a2-7a37-40ae-8f6b-793dbd99ef88` (thanks to the FK migration we just applied)
- References in `sales_lead_activities` and other tables will be set to NULL (preserving history)

### Files Modified
| File | Change |
|------|--------|
| `src/lib/accessPolicies.ts` | Remove from `externalEstimators` and `allowedLoginEmails` |
| `src/lib/userAccessConfig.ts` | Remove config block |
| Database | Delete auth user (cascades to profile) |

