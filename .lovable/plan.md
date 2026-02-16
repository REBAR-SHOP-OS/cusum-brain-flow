

# Customer Presence, City Tracking, Page-Aware AI Guide, and Add-to-Cart

## Overview

Upgrade both chat widget systems so agents can see:
- Whether a customer is **online** (green dot) or offline
- Which **city** they are from (via IP geolocation)
- Which **page** they are currently browsing

The AI will also gain the ability to **guide customers through the website** and **add products to their WooCommerce cart** via direct links.

## What Changes

### 1. Visitor Presence and City Detection (Backend)

**support-chat edge function** (`supabase/functions/support-chat/index.ts`):
- On `handleStart`: capture visitor IP from request headers, call a free geolocation API (ip-api.com) to resolve city/country, and store in `metadata` as `{ city, country, current_page, last_seen_at }`
- On `handleSend`: update `metadata.last_seen_at` timestamp and `metadata.current_page` on every message so agents always know when the visitor was last active

**New heartbeat action**: Add `action=heartbeat` endpoint that the widget calls every 30 seconds with `conversation_id`, `visitor_token`, and `current_page`. This updates `metadata.last_seen_at` and `metadata.current_page` so agents see real-time presence.

### 2. Widget JS Updates (Page Tracking + Heartbeat)

**Support chat widget** (generated JS in `support-chat/index.ts` `generateWidgetJs`):
- Capture `window.location.href` and send it with the start request
- After conversation starts, send a heartbeat every 30 seconds with current page URL
- Listen for URL changes (popstate + polling) to keep current page fresh

**External rebar.shop widget** (`website-chat-widget/index.ts`):
- Send `window.location.href` alongside messages in the POST body to `website-agent`
- The website-agent will inject "Visitor is currently on: {url}" into the system prompt

### 3. Website Agent -- Page-Aware AI + Add to Cart

**System prompt update** (`website-agent/index.ts`):
- Add instructions: "You can see which page the visitor is on. Reference it when helping them navigate."
- Add guidance for add-to-cart: "When a customer wants to buy, provide a direct add-to-cart link."

**New tool -- `add_to_cart`**:
- Takes `product_id` and `quantity`
- Returns a WooCommerce cart URL: `https://rebar.shop/?add-to-cart={product_id}&quantity={qty}`
- The AI presents it as "Click here to add to your cart: [link]"

**New tool -- `navigate_to`**:
- Takes a page description (e.g. "products", "contact", "mesh")
- Returns the appropriate rebar.shop URL so the AI can guide the visitor

**Request body change**: Accept `current_page` from widget and inject into system prompt context.

### 4. Agent Inbox UI -- Online Status, City, and Current Page

**SupportConversationList.tsx**:
- Show a green/grey dot next to visitor name (green = `last_seen_at` within last 60 seconds)
- Show city below visitor name (from `metadata.city`)

**SupportChatView.tsx**:
- Display a badge in the conversation header showing: online/offline status, city, and current page (clickable link)
- Subscribe to realtime changes on `support_conversations` metadata to auto-refresh presence

### 5. Support Chat AI -- Page Context in Auto-Replies

Update `triggerAiReply` in `support-chat/index.ts`:
- Include `metadata.current_page` in the AI system prompt so the bot knows what page the visitor is on and can provide contextual help

## Technical Details

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/support-chat/index.ts` | Add heartbeat action, IP geolocation on start, page/presence tracking in metadata, page context in AI prompt |
| `supabase/functions/website-chat-widget/index.ts` | Send `current_page` with messages |
| `supabase/functions/website-agent/index.ts` | Accept `current_page`, add `add_to_cart` and `navigate_to` tools, update system prompt |
| `src/components/support/SupportConversationList.tsx` | Add online dot + city display |
| `src/components/support/SupportChatView.tsx` | Add current page badge + online indicator in header |

### No Database Migrations Required

The `metadata` JSONB column already exists on `support_conversations`. We store:
```json
{
  "city": "Sydney",
  "country": "AU",
  "current_page": "https://rebar.shop/product/n16-deformed-bar/",
  "last_seen_at": "2026-02-16T12:34:56Z"
}
```

### IP Geolocation

Using the free ip-api.com endpoint (no API key needed, 45 req/min limit):
```
GET http://ip-api.com/json/{ip}?fields=city,country,countryCode
```
This runs once on conversation start only, so rate limits are not a concern.

### Online/Offline Logic

- **Online**: `metadata.last_seen_at` is within the last 60 seconds
- **Away**: `last_seen_at` is 1-5 minutes ago
- **Offline**: `last_seen_at` is older than 5 minutes or missing

### WooCommerce Add-to-Cart URLs

WooCommerce natively supports:
```
https://rebar.shop/?add-to-cart=PRODUCT_ID&quantity=QTY
```
The `add_to_cart` tool validates the product exists via WP API first, then returns the formatted URL for the AI to share as a clickable link in chat.

### Heartbeat Flow

```text
Widget (every 30s) --> support-chat?action=heartbeat
  { conversation_id, visitor_token, current_page }
    --> UPDATE support_conversations SET metadata = metadata || { last_seen_at, current_page }

Agent Inbox (realtime subscription)
  --> sees updated metadata --> renders online dot + page
```
