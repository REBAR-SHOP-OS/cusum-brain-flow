

# Chatter Audit & Odoo-Identical UI Overhaul

## Findings

| Area | Status | Detail |
|------|--------|--------|
| lead_activities duplicates | 17 pairs | Same (lead_id, type, title, created_at) — from lead_events overlap |
| scheduled_activities duplicates | CLEAN | 0 (fixed in prior session) |
| lead_communications | CLEAN | 0 duplicates, 0 rows total |
| lead_events | CLEAN | 0 duplicates |
| Files/images not viewable | BUG | 9,362 Odoo images show "not yet migrated" placeholder — `odoo-file-proxy` edge function exists but is not used |
| No "Files" tab in drawer | GAP | `LeadFiles.tsx` component exists but is not wired into the drawer tabs |
| Chatter UI differs from Odoo | UX | Missing: inline image previews, file attachments shown in chatter stream, Odoo-style note backgrounds, proper "Files" tab |
| Duplicate components | DEBT | Both `OdooChatter.tsx` (665 lines) and `LeadTimeline.tsx` (528 lines) render nearly identical data with different UIs |

## Plan

### Step 1: Delete 17 duplicate lead_activities (SQL data fix)

Delete the extra row from 17 duplicate pairs, keeping the one with the lower id.

### Step 2: Add "Files" tab to LeadDetailDrawer

Add a 5th tab "files" to the drawer tab bar, rendering the existing `LeadFiles` component plus inline image preview for Odoo images via the file proxy.

### Step 3: Enable Odoo image preview in chatter

Replace the `OdooImagePreview` placeholder in both `OdooChatter.tsx` and `LeadTimeline.tsx` with an actual image component that loads from the `odoo-file-proxy` edge function:

```typescript
const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/odoo-file-proxy?id=${odooId}`;
// Use <img> with auth header via fetch + blob URL
```

This will render Odoo images inline in the chatter thread, identical to how Odoo shows them.

### Step 4: Show file attachments inline in chatter thread (Odoo parity)

In the `OdooChatter` thread, when a file is attached to a chatter message (via `lead_files` linked by timestamp proximity or `odoo_message_id`), show it inline below the message — images as thumbnails, documents as download cards. This mirrors Odoo's behavior where attachments appear directly in the conversation flow.

### Step 5: Style chatter to match Odoo

- Notes: amber/yellow background with left border (already partially done)
- Emails: show subject line prominently, body below
- Stage changes: compact arrow format with "from → to"
- System messages: subtle gray, smaller text
- Avatar with initials (already done)
- Timestamps: relative time ("2 hours ago") with absolute on hover

### Step 6: Consolidate timeline tab into chatter

The "timeline" tab (LeadActivityTimeline) and "chatter" tab (OdooChatter) show overlapping data. Merge the `lead_communications` query into `OdooChatter` (already done) and remove the redundant "timeline" tab. Final tabs: **Chatter | Activities | Files | Notes** — matching Odoo's layout.

| File | Change |
|------|--------|
| Database (data fix) | Delete 17 duplicate lead_activities |
| `src/components/pipeline/LeadDetailDrawer.tsx` | Add "files" tab, remove "timeline" tab, reorder to match Odoo |
| `src/components/pipeline/OdooChatter.tsx` | Use `odoo-file-proxy` for inline image previews, show files in thread |
| `src/components/pipeline/LeadTimeline.tsx` | Replace placeholder `OdooImagePreview` with proxy-based image loading |
| `src/components/pipeline/LeadFiles.tsx` | Add inline image preview using `odoo-file-proxy` for Odoo-sourced images |

