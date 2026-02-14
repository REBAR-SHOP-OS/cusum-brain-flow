

# Comprehensive UI Audit Plan -- REBAR SHOP OS

## Scope

Full audit of all 52 pages across 7 route categories (Public, Core, Sales, Operations, System, Admin, Social/Comms), the shared layout system (TopBar, AppSidebar, MobileNavV2, IntelligencePanel), and the component library (shadcn/ui + custom components).

---

## Phase 1: Discovery and Inventory (Sprint 0)

### Page Inventory

Build a master spreadsheet of all routes with:
- URL path, page component file, user goal, required role(s), traffic tier (from analytics)
- Grouped by category: Public (Landing, Login, Signup, Privacy, Terms, Portal, Install, Unsubscribe), Core (Home, CEO, Inbox, Tasks, Phonecalls), Sales (Pipeline, Prospecting, Customers), Operations (ShopFloor, Cutter, Station, Pool, Pickup, Clearance, LiveMonitor, Deliveries, TimeClock, Transcribe, TeamHub), Accounting (AccountingWorkspace, CustomerAction), AI Agents (AgentWorkspace x17 agents), System (Brain, Integrations, Settings), Admin (AdminPanel, DbAudit, Machines, Cleanup, ConnectionsAudit, DataStoresAudit), Social (SocialMediaManager, EmailMarketing, DailySummarizer, FacebookCommenter), Standalone (OfficePortal, VizzyPage, LiveChat)

### Analytics Baseline

Pull 30-day analytics (pageviews, bounce rate, session duration) using the project analytics tool to identify high-traffic and high-drop pages.

---

## Phase 2: Heuristic Review

Evaluate each page against Nielsen's 10 heuristics. Known issues already identified from code review:

| Issue | Page(s) | Heuristic | Severity |
|---|---|---|---|
| `dangerouslySetInnerHTML` for hero title on Home | Home.tsx:141 | Error prevention / Security | High |
| No skip-to-content link | All pages (AppLayout) | Accessibility / Visibility | Medium |
| TopBar buttons missing `aria-label` | TopBar.tsx (Chat, Notifications) | Accessibility | Medium |
| 404 page links to `/` instead of `/home` for logged-in users | NotFound.tsx | Match between system and real world | Low |
| Inconsistent OAuth redirect: Apple login goes to `/inbox`, Google to `/home` | Login.tsx:77 vs :47 | Consistency | Medium |
| Google signup redirects to `/inbox`, Google login to `/home` | Signup.tsx:49 vs Login.tsx:47 | Consistency | Medium |
| Sidebar group labels invisible until hover (8px font, 40% opacity) | AppSidebar.tsx:148 | Visibility of system status | Low |
| Mobile "More" menu has no visible role-lock indicators | MobileNavV2.tsx | Help users recognize | Low |
| No loading/skeleton states visible in layout wrapper | AppLayout.tsx | Visibility of system status | Medium |
| Missing `<meta name="description">` on inner pages (SPA, but affects SSR/prerender) | All pages | SEO | Low |

---

## Phase 3: Accessibility Audit (WCAG 2.1 AA)

### Automated Checks (to run via browser tools)
- Color contrast ratios (target 4.5:1 for text, 3:1 for large text)
- Missing alt text on images
- Form label associations
- ARIA roles and landmarks

### Known Issues from Code Review

| Issue | Location | WCAG Criterion | Fix |
|---|---|---|---|
| No skip navigation link | AppLayout.tsx | 2.4.1 Bypass Blocks | Add `<a href="#main-content" class="sr-only focus:not-sr-only">` |
| TopBar Chat/Notifications buttons lack aria-label | TopBar.tsx:76,84 | 4.1.2 Name, Role, Value | Add `aria-label="Team chat"` and `aria-label="Notifications"` |
| Sidebar group labels at 8px are below minimum text size | AppSidebar.tsx:148 | 1.4.4 Resize Text | Increase to at least 10px |
| Workspace cards use `onClick` on `div` without keyboard role | Home.tsx:173 | 2.1.1 Keyboard | Add `role="button"` + `tabIndex={0}` + `onKeyDown` |
| Background image alt="" is correct (decorative) | Login.tsx:86 | 1.1.1 Non-text Content | Pass (already correct) |
| Google SVG icon missing title/aria-hidden | Login.tsx:109 | 1.1.1 | Add `aria-hidden="true"` |
| Mobile nav overlay has no focus trap | MobileNavV2.tsx:86 | 2.4.3 Focus Order | Add focus trap when "More" menu is open |
| HelperCard images lack meaningful alt text context | Home.tsx:218 | 1.1.1 | Change alt to `"{helper.name} - {helper.role}"` |

---

## Phase 4: Performance Audit

### Targets
- LCP < 2.0s
- CLS < 0.1
- TBT < 200ms

### Known Concerns from Code Review
- Landing page loads `InteractiveBrainBg` component (likely canvas/animation) -- may impact LCP
- Home page imports 17 helper character images eagerly -- should lazy-load below the fold
- Login/Signup pages animate a background image with CSS pulse -- minor GPU cost
- No visible code-splitting beyond route-level React lazy (need to verify if pages use `React.lazy`)
- `vite-plugin-image-optimizer` and `vite-plugin-pwa` are installed (good)

---

## Phase 5: SEO and Content Audit

### Current State (Good)
- Structured data (JSON-LD) on index.html for SoftwareApplication and Organization
- Open Graph and Twitter Card meta tags present
- sitemap.xml covers 5 public URLs
- robots.txt allows all crawlers
- Proper canonical URL set

### Gaps
- sitemap.xml only lists 5 URLs -- missing `/portal`, `/install`, `/data-deletion`, `/unsubscribe`
- No dynamic page titles per route (SPA limitation -- consider react-helmet or similar)
- Landing page headings are well-structured (h1 > h2 > h3) -- good

---

## Phase 6: Forms and Validation

| Form | Location | Issues |
|---|---|---|
| Login | Login.tsx | No password visibility toggle; no "forgot password" link; no input validation feedback beyond browser defaults |
| Signup | Signup.tsx | Password requirements shown but no strength indicator; no confirm password field |
| All forms | Throughout | Need to verify consistent error message styling and inline validation patterns |

---

## Implementation Roadmap

### Sprint 1 -- Critical Fixes (1-2 days)
1. Fix OAuth redirect inconsistency (Login Apple -> `/inbox` should be `/home`)
2. Fix Google signup redirect (`/inbox` -> `/home`)
3. Add `aria-label` to TopBar buttons
4. Add skip-to-content link in AppLayout
5. Add keyboard support to Workspace cards on Home page
6. Remove `dangerouslySetInnerHTML` from Home hero (use React elements instead)

### Sprint 2 -- Accessibility (2-3 days)
1. Add focus trap to mobile "More" menu
2. Improve sidebar label legibility (font size, contrast)
3. Add `aria-hidden="true"` to decorative SVG icons
4. Improve HelperCard alt text
5. Add loading/skeleton states to page transitions
6. Add focus-visible styles across all interactive elements

### Sprint 3 -- Performance (1-2 days)
1. Lazy-load helper character images on Home page
2. Audit and optimize InteractiveBrainBg on Landing
3. Verify route-level code splitting is active
4. Add preload hints for critical fonts (Inter, JetBrains Mono)

### Sprint 4 -- SEO and Content (1 day)
1. Update sitemap.xml with all public routes
2. Add per-route document titles (react-helmet-async or useEffect)
3. Review and improve meta descriptions for public pages

### Sprint 5 -- Design Consistency (2-3 days)
1. Audit all button variants across pages for consistency
2. Standardize card patterns (HelperCard vs workspace cards vs feature cards)
3. Document component usage in a design system reference
4. Ensure consistent spacing, typography, and color usage

---

## Deliverables

1. **Prioritized Backlog** -- All issues above ranked by severity and effort
2. **Accessibility Fix Tracker** -- WCAG criterion, element, fix, status
3. **Component Gap Analysis** -- Current vs. ideal for buttons, cards, forms, navigation
4. **Analytics Instrumentation Checklist** -- Key events to track (CTA clicks, form submits, agent selections, page transitions)
5. **Updated sitemap.xml** -- All public routes included

---

## Technical Notes

- The app uses shadcn/ui components (Radix primitives) which provide good baseline accessibility -- most issues are in custom components and layout wrappers
- Tailwind config is well-structured with semantic color tokens and CSS custom properties -- design consistency fixes should leverage these existing tokens
- The role-based navigation system (AppSidebar, MobileNavV2) is well-implemented but needs accessibility annotations (locked items need `aria-disabled`)
- PWA configuration is already in place (service worker, manifest, VAPID push) -- no changes needed there

