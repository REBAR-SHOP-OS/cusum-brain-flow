
# Add Live Chat to rebar.shop

Embed an AI-powered chat widget on rebar.shop so website visitors can ask questions about rebar fabrication, get quotes, and learn about your services -- without needing to log in.

## How It Works

A single script tag is added to WordPress. It loads a floating chat bubble (bottom-right corner) that connects to your backend AI. Visitors type questions, the AI responds using your business knowledge.

```text
rebar.shop visitor clicks chat bubble
        |
        v
Chat widget (injected via script tag)
        |
        v
website-chat edge function (no auth required)
        |
        v
Lovable AI (Gemini Flash) with rebar.shop context
```

## What You'll See

- A floating chat bubble on every page of rebar.shop
- Visitors can ask about products, pricing, services, delivery areas
- AI responds with knowledge about your rebar fabrication business
- Styled to match rebar.shop branding (dark theme, your accent color)

## What Gets Built

### 1. New Edge Function: `website-chat`

A public (no auth) chat endpoint tailored for website visitors. Similar to `app-help-chat` but with a system prompt focused on:
- Rebar products and services
- Pricing inquiries (directing to quote requests)
- Delivery and service areas
- Company info and capabilities
- Encouraging visitors to call or request a quote

Includes IP-based rate limiting (simple in-memory) to prevent abuse since there's no authentication.

### 2. New Edge Function: `website-chat-widget`

Serves a self-contained JavaScript file that:
- Injects a floating chat bubble (bottom-right)
- Opens a chat panel on click
- Handles SSE streaming responses
- Styled with inline CSS (no external dependencies)
- Fully self-contained -- no React, no build tools needed

### 3. WordPress Integration

Add one line to your WordPress site (via theme header or plugin):

```html
<script src="https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/website-chat-widget" defer></script>
```

This can be added via:
- WordPress Appearance > Theme Editor > header.php
- Or a "Header Scripts" plugin
- Or Seomi can inject it via the WordPress API

## Technical Details

### `supabase/functions/website-chat/index.ts`
- No authentication required (public endpoint)
- System prompt with rebar.shop business context (products, services, contact info)
- Uses `LOVABLE_API_KEY` with `google/gemini-3-flash-preview` (same as app-help-chat)
- In-memory rate limit: max 10 messages per IP per minute
- Streams SSE responses back to the widget
- Max 10 messages per conversation (enforced server-side)

### `supabase/functions/website-chat-widget/index.ts`
- Returns `Content-Type: application/javascript`
- Self-contained JS that creates the chat UI via DOM manipulation
- Floating bubble: 56px circle, your brand color (#E97F0F orange)
- Chat panel: 380px wide, dark themed to match rebar.shop
- Handles Enter to send, streaming text display, loading states
- Mobile responsive (full-width on small screens)

### `supabase/config.toml`
- Add both functions with `verify_jwt = false`

### No database changes needed
- No new tables or migrations
- No RLS policies needed (stateless chat, no data stored)
