

## Audit and Fix: Job Site Editor Links, Mobile Navigation, and Responsive Layout

### Issues Found

**1. Missing Mobile Navigation Links (MobileNavV2.tsx)**
The mobile "More" menu is missing links for Job Site (/website), SEO (/seo), and Support Inbox (/support-inbox). These exist in the desktop sidebar but were never added to the mobile nav, so users on phones cannot reach these pages.

**2. WebsiteManager Layout Broken on Mobile (WebsiteManager.tsx)**
The horizontal `ResizablePanelGroup` (70/30 split) is unusable on small screens -- both panels are too narrow to use. On mobile, the page should show either the preview or the chat, with a toggle to switch between them instead of side-by-side panels.

**3. WebsiteToolbar Overflow on Mobile (WebsiteToolbar.tsx)**
The toolbar crams the page selector, 3 device toggle buttons, refresh, and external link into a single row. On mobile this overflows or gets clipped. Needs `flex-wrap` and tighter spacing on small screens.

**4. Landing Page Header Not Mobile-Friendly (Landing.tsx)**
The header navigation (Sign In + Get Started buttons) can overflow on very small screens. Needs responsive wrapping or smaller button sizing.

**5. Landing Page Hero Buttons Don't Wrap (Landing.tsx)**
The CTA buttons ("Start Free" + "Watch Demo") use `flex` without `flex-wrap`, so they overflow on narrow screens.

**6. LandingFooter Row 2 Has 4 Children in 3-Column Grid (LandingFooter.tsx)**
The second row declares `md:grid-cols-3` but has 4 children (Contact, Service Area, Quick Links, Follow Us). The 4th item wraps awkwardly. Should be `md:grid-cols-2 lg:grid-cols-4` for proper layout.

---

### Plan

**File 1: `src/components/layout/MobileNavV2.tsx`**
- Add Job Site (Globe icon), SEO, and Support to the `moreItems` array with appropriate role restrictions matching the desktop sidebar

**File 2: `src/pages/WebsiteManager.tsx`**
- Import `useIsMobile` hook
- On mobile (below 768px): hide the resizable split layout
- Instead show a tabbed interface: "Preview" tab shows the iframe, "Chat" tab shows the chat panel (full width)
- Keep desktop layout unchanged

**File 3: `src/components/website/WebsiteToolbar.tsx`**
- Add `flex-wrap` to the toolbar container
- Hide device toggle buttons on mobile (they don't make sense when the preview is already on a phone)
- Make the page selector narrower on small screens

**File 4: `src/pages/Landing.tsx`**
- Add `flex-wrap` to hero CTA buttons container
- Make header buttons responsive: smaller on mobile, use `gap-2` instead of `gap-4`

**File 5: `src/components/landing/LandingFooter.tsx`**
- Change footer row 2 grid to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` for proper wrapping

---

### Technical Details

In `WebsiteManager.tsx`, the mobile layout replaces the `ResizablePanelGroup` with a simple state toggle:

```text
+----------------------------------+
| WebsiteToolbar (page selector)   |
+----------------------------------+
| [Preview] [Chat/Speed]  <- tabs  |
+----------------------------------+
|                                  |
|   Full-width content area        |
|   (either preview or chat)       |
|                                  |
+----------------------------------+
```

In `MobileNavV2.tsx`, additions to `moreItems`:
```typescript
{ name: "Job Site", href: "/website", icon: Globe, roles: ["admin", "office"] },
{ name: "SEO", href: "/seo", icon: Search, roles: ["admin", "office"] },
{ name: "Support", href: "/support-inbox", icon: Headset, roles: ["admin", "office"] },
```

