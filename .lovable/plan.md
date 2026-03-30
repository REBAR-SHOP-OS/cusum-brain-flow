

# Generate Website Manager Architecture PDF

## What
Create a comprehensive PDF document documenting the architecture of the Website Manager module — covering frontend components, backend edge functions, data flow, AI chat integration, speed dashboard, and WordPress integration.

## Content Structure

1. **Overview** — Module purpose: visual WordPress site editor with AI chat and speed optimization
2. **Frontend Architecture**
   - `WebsiteManager.tsx` — main page with resizable split panels, 4 layout modes (normal, fullscreen, minimized, mobile)
   - `WebsiteToolbar.tsx` — page selector, device mode toggle (desktop/tablet/mobile), hero repair button, refresh/external link
   - `WebsiteChat.tsx` — AI chat with file attachments (images, PDFs, ZIPs), quick actions, confirmation cards for write operations, grammar check
   - `SpeedDashboard.tsx` — TTFB metrics, image optimizer (dry-run/live), WordPress health checklist, media audit
3. **Backend Edge Functions**
   - `admin-chat` — SSE streaming AI chat with 20+ tools (WordPress CRUD, memory, speed audit, RingCentral)
   - `website-agent` — Customer-facing website chatbot
   - `website-speed-audit` — TTFB measurement, issue detection, recommendations
   - `wp-speed-optimizer` — Image lazy loading, dimensions, fetchpriority injection
   - `wp-fix-hero` — SR7 slider CSS repair injection via WordPress REST API
4. **Data Flow Diagram** — User → Frontend → Edge Functions → WordPress REST API → rebar.shop
5. **Key Hooks** — `useAdminChat` (SSE streaming, tool confirmation, localStorage persistence)
6. **Security** — Auth modes, RBAC, write confirmation UX pattern

## Implementation
- Use `reportlab` to generate a professional PDF with the Rebar Shop OS branding
- Write to `/mnt/documents/Website_Manager_Architecture.pdf`
- Visual QA via `pdftoppm`

## Files
- No project files changed — artifact generation only

