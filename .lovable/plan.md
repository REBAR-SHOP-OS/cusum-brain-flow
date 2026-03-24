

## Add Synology NAS Integration

### What
Add a "Synology NAS" integration card to the Integrations page. When connected, it enables file browsing, NAS monitoring, media access, and team file sharing via the Synology DSM API (using DDNS hostname `RSIC.synology.me` and QuickConnect ID `RSI1`).

### Architecture

The Synology DSM exposes a REST API (`/webapi/entry.cgi`) for authentication, file operations, and system info. We will:

1. Store the NAS credentials as secrets (URL, username, password)
2. Create an edge function that proxies requests to the Synology API (avoids CORS and keeps credentials server-side)
3. Add UI for browsing files, monitoring NAS status, and sharing

### Changes

**File**: `src/components/integrations/integrationsList.ts`
- Add a new `synology-nas` integration entry with fields for NAS URL, DSM username, and DSM password

**File**: `src/components/integrations/IntegrationIcons.tsx`
- Add a Synology NAS icon (server/storage icon in Synology blue `#4B9FD5`)

**File**: `src/hooks/useIntegrations.ts`
- Add `synology-nas` to the OAuth integrations list (uses the connect dialog flow)
- Add handler in `startOAuth` for `synology-nas` that calls the edge function to verify connection

**File**: `supabase/functions/synology-proxy/index.ts` (new)
- Edge function that authenticates with Synology DSM API and proxies requests
- Supports actions: `login` (test connection), `list-files` (browse shared folders), `system-info` (disk usage, health, uptime), `download` (proxy file download)
- Uses secrets: `SYNOLOGY_URL`, `SYNOLOGY_USERNAME`, `SYNOLOGY_PASSWORD`
- Base URL: `https://RSIC.synology.me:5001` (HTTPS port)

**File**: `src/pages/SynologyNAS.tsx` (new)
- Dashboard page with tabs: **Files** (browse shared folders), **Status** (disk health, CPU, RAM), **Team Files** (shared folder access for team)
- File browser with breadcrumb navigation, download links, and folder tree
- System status cards showing disk usage, health status, temperature

**File**: `src/App.tsx`
- Add route `/synology` pointing to the new page

### Secrets Required
| Secret | Value | Description |
|---|---|---|
| `SYNOLOGY_URL` | `https://RSIC.synology.me:5001` | DSM HTTPS endpoint |
| `SYNOLOGY_USERNAME` | (user provides) | DSM admin username |
| `SYNOLOGY_PASSWORD` | (user provides) | DSM admin password |

### Files Changed

| File | Change |
|---|---|
| `src/components/integrations/integrationsList.ts` | Add Synology NAS integration definition |
| `src/components/integrations/IntegrationIcons.tsx` | Add Synology server icon |
| `src/hooks/useIntegrations.ts` | Add synology-nas connect handler |
| `supabase/functions/synology-proxy/index.ts` | New edge function for DSM API proxy |
| `src/pages/SynologyNAS.tsx` | New NAS dashboard page |
| `src/App.tsx` | Add `/synology` route |

