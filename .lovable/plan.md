

## Add ai@rebar.shop as Super Admin

### What Changes

Add `ai@rebar.shop` to the `SUPER_ADMIN_EMAILS` array in all 5 files where it's defined:

1. `src/hooks/useSuperAdmin.ts` (client-side hook)
2. `src/components/office/DiagnosticLogView.tsx` (diagnostic logs access)
3. `supabase/functions/diagnostic-logs/index.ts` (edge function)
4. `supabase/functions/ringcentral-action/index.ts` (edge function)
5. `supabase/functions/ringcentral-sip-provision/index.ts` (edge function)

Each file's array changes from:
```
["sattar@rebar.shop", "radin@rebar.shop"]
```
to:
```
["sattar@rebar.shop", "radin@rebar.shop", "ai@rebar.shop"]
```

### Notifications, Emoji, Upload, Voice

These features are already available to **all authenticated users** -- they are not restricted by role. No changes needed:

- **Notifications** -- `useNotifications` and push subscriptions run for every logged-in user
- **Emoji Picker** -- available in the Team Hub message composer for all users
- **File Upload** -- the paperclip button in Team Hub works for all authenticated users
- **Voice-to-Text** -- the microphone button is available to all users
- **Text-to-Speech** -- the speaker icon on messages works for all users

### Technical Details

- 2 client-side files updated (React components/hooks)
- 3 edge functions redeployed with the updated email list
- No database changes required

