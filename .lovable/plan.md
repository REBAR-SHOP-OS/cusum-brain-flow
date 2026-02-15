

# Recover Speed After Air Lift Plugin Removal

## The Problem

Air Lift was handling page caching, asset optimization (CSS/JS minification), and possibly CDN integration. Removing it without a replacement means every page load now hits PHP and the database directly, causing the speed drop you're seeing.

## What We Can Do

### 1. Add "Post-Air Lift Recovery" checklist items to the Speed Dashboard

Add new critical health checklist items specifically for the Air Lift removal situation, guiding you through the replacement steps:

- **Install replacement caching plugin** (Critical) -- "Install LiteSpeed Cache (if on LiteSpeed server) or WP Super Cache. Enable page caching, browser caching, and GZIP compression. This alone recovers 60-80% of the lost speed."
- **Clean up Air Lift leftovers** (Warning) -- "Remove leftover Air Lift database tables and wp-content files. Use Advanced Database Cleaner to find orphaned tables prefixed with the plugin name. Check wp-content for any remaining Air Lift folders."
- **Re-enable CSS/JS minification** (Warning) -- "Install Autoptimize to restore CSS/JS minification and deferral that Air Lift was handling. Enable 'Aggregate CSS', 'Aggregate JS', and 'Defer JS'."

### 2. Update the speed audit recommendations

Update the `website-speed-audit` edge function to prioritize the caching plugin recommendation higher (priority 0) since there is currently no active caching solution.

### 3. Run a fresh speed audit after changes

Trigger the audit to get updated TTFB numbers so you can compare before/after installing the replacement plugin.

## What You Need To Do On the Server

These actions require WordPress admin access (we cannot install plugins via the REST API):

1. Go to **Plugins > Add New** in WordPress admin
2. Search for **"LiteSpeed Cache"** (if your host uses LiteSpeed) or **"WP Super Cache"**
3. Install and activate it
4. Enable page caching in the plugin settings
5. Optionally install **Autoptimize** for CSS/JS minification

## Technical Details

### Files Modified

| File | Change |
|------|--------|
| `src/components/website/SpeedDashboard.tsx` | Add 3 new recovery checklist items to `SERVER_HEALTH_ITEMS` for the Air Lift removal situation |
| `supabase/functions/website-speed-audit/index.ts` | Add a high-priority "no caching plugin detected" recommendation and an Air Lift cleanup recommendation |

### SpeedDashboard.tsx

Add to `SERVER_HEALTH_ITEMS` array:

```text
- id: "replace_cache_plugin"
  severity: critical
  title: "Install Replacement Caching Plugin"
  description: "Air Lift was removed. Install LiteSpeed Cache or WP Super Cache immediately to restore page caching, browser caching, and GZIP. This is the #1 fix for the speed drop."

- id: "airlift_cleanup"
  severity: warning
  title: "Clean Up Air Lift Leftovers"
  description: "Check database for orphaned Air Lift tables using Advanced Database Cleaner. Remove any leftover files in wp-content/plugins/ and wp-content/cache/."

- id: "restore_minification"
  severity: warning  
  title: "Restore CSS/JS Minification"
  description: "Install Autoptimize to replace Air Lift's asset optimization. Enable Aggregate CSS, Aggregate JS, and Defer JS loading."
```

### website-speed-audit/index.ts

Add before existing recommendations:

```text
- action: "replace_caching_plugin"
  priority: 0
  title: "URGENT: Install replacement caching plugin"
  description: "No active caching plugin detected after Air Lift removal. Install LiteSpeed Cache or WP Super Cache to restore page caching. This is the single most impactful fix for the current speed regression."
  requires_server_access: true
```

