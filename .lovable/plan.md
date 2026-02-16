

# Rename "Job Site" back to "Website" and Move to Home Page Only

## What Changes

1. **Rename all "Job Site" labels back to "Website"** across the app UI
2. **Remove "Website" and "SEO" from the sidebar and mobile nav** -- they will no longer appear as navigation items
3. **Add "Website" and "SEO" as workspace cards on the Home page** so users can still access them

## Detailed Changes

### 1. Sidebar — Remove Website and SEO entries
**File: `src/components/layout/AppSidebar.tsx`** (lines 112-113)
- Remove the "Job Site" nav item (`{ name: "Job Site", href: "/website", ... }`)
- Remove the "SEO" nav item (`{ name: "SEO", href: "/seo", ... }`)

### 2. Mobile Nav — Remove Website and SEO entries
**File: `src/components/layout/MobileNavV2.tsx`** (lines 29-30)
- Remove `{ name: "Job Site", href: "/website", ... }`
- Remove `{ name: "SEO", href: "/seo", ... }`

### 3. Home Page — Add Website and SEO workspace cards
**File: `src/pages/Home.tsx`** (lines 173-177)
- Add two new cards to the Workspaces grid:
  - "Website" with a Globe icon, linking to `/website`
  - "SEO" with a Search icon, linking to `/seo`

### 4. Rename "Job Site" to "Website" in remaining UI labels
- **`src/components/website/WebsiteChat.tsx`**: "AI Job Site Editor" to "AI Website Editor", "edit your job site" to "edit your website"
- **`src/pages/WebsiteManager.tsx`**: iframe title "Job Site Preview" to "Website Preview"
- **`src/hooks/useActiveModule.ts`**: Module name "Job Site" to "Website"
- **`src/components/integrations/AutomationsSection.tsx`**: "Job Site Manager" to "Website Manager"
- **`src/components/agent/agentConfigs.ts`**: Placeholder and capabilities referencing "job site" to "website"
- **`src/components/agent/agentSuggestionsData.ts`**: "job site" to "website" in suggestion text

### 5. Page map update
**File: `supabase/functions/_shared/pageMap.ts`** (line for /office)
- The /website entry description already says "AI-powered WordPress/WooCommerce editor" which is fine; no change needed there

## What stays the same
- All routes remain unchanged (`/website`, `/seo`)
- All file names stay the same
- All backend/edge function names stay the same
- The SEO and Web Builder agent helpers on the home page remain as-is (they link to agent chat pages, not the manager pages)
