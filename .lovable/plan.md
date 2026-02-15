

# Website Management Module

A dedicated `/website` page that gives you an Odoo-style visual website manager for rebar.shop -- combining a live site preview with AI-powered editing, all in one screen.

## What You Get

**A new "Website" entry in the sidebar** (under the Office group) that opens a full-screen workspace with three areas:

1. **Top Toolbar** -- Page selector dropdown (Home, Products, Contact, etc.), device preview toggles (Desktop/Tablet/Mobile), "Open in new tab" button, and a Refresh button
2. **Live Preview Panel** (left, ~70% width) -- An iframe showing rebar.shop pages in real-time. You can switch pages from the toolbar and see the actual live site
3. **AI Editor Panel** (right, ~30% width) -- A chat interface connected to JARVIS with the WordPress tools already built. Type things like "Update the About Us heading" or "Change product X price to $12" and the AI proposes the change with a confirmation card before executing

## How It Works

```text
+--------------------------------------------------------------+
|  [Page: Home v]  [Desktop|Tablet|Mobile]  [Open] [Refresh]   |
+--------------------------------------------------------------+
|                                    |                          |
|                                    |   AI Website Editor      |
|     Live Preview                   |                          |
|     (iframe: rebar.shop)           |   "Change the hero       |
|                                    |    heading to..."        |
|                                    |                          |
|                                    |   [Confirmation Card]    |
|                                    |   [Approve] [Cancel]     |
|                                    |                          |
+--------------------------------------------------------------+
```

When AI makes a change (e.g., updates a page title), the iframe auto-refreshes so you see the result immediately.

## Files to Create / Edit

### New Files

1. **`src/pages/WebsiteManager.tsx`** -- Main page component with:
   - Toolbar with page selector, device toggles, external link
   - Resizable split layout (iframe left, chat right) using `react-resizable-panels`
   - iframe pointing to rebar.shop pages
   - Device preview sizes (desktop: 100%, tablet: 768px, mobile: 375px)

2. **`src/components/website/WebsiteChat.tsx`** -- Dedicated chat panel that reuses `useAdminChat` hook but adds:
   - Auto-prefixed context: tells JARVIS which page is being viewed
   - Auto-refresh trigger: after a confirmed write action completes, refreshes the iframe
   - Same confirmation card UI as the existing Admin Console
   - Quick-action buttons: "List pages", "Check SEO", "Show products"

3. **`src/components/website/WebsiteToolbar.tsx`** -- Top toolbar with:
   - Page dropdown (predefined pages from rebar.shop: Home, About, Products, Contact, etc.)
   - Device preview toggle buttons (Desktop / Tablet / Mobile)
   - "Open in new tab" button
   - Refresh button

4. **`src/components/website/PageSelector.tsx`** -- Dropdown component listing known rebar.shop pages with their URLs

### Edited Files

5. **`src/App.tsx`** -- Add route: `/website` pointing to `WebsiteManager`

6. **`src/components/layout/AppSidebar.tsx`** -- Add "Website" nav item to the Office group with `Globe` icon, restricted to `admin` and `office` roles

## Technical Details

- The iframe loads `https://rebar.shop` pages directly -- no proxy needed
- Device preview works by constraining the iframe container width (768px for tablet, 375px for mobile) and centering it
- The chat panel uses the existing `useAdminChat` hook which already connects to the `admin-chat` edge function with all 10 WordPress tools
- After a successful write confirmation (`confirmAction`), the component calls `iframeRef.current.src = iframeRef.current.src` to force a reload
- The page selector stores common rebar.shop URLs (/, /about, /products, /contact, /shop, etc.)
- No new dependencies -- uses `react-resizable-panels` (already installed), existing UI components, and existing hooks
- No new edge functions or database changes needed

## Sidebar Placement

```text
Office
  Dashboard        /home
  CEO Portal       /ceo
  Website          /website    <-- NEW (Globe icon, admin + office roles)
  Pipeline         /pipeline
  Customers        /customers
  Accounting       /accounting
```
