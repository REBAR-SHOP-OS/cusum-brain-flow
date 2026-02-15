

# AI-Driven WordPress Management Module for rebar.shop

## Overview

Extend the existing JARVIS (admin-chat) AI assistant with WordPress management tools, enabling the CEO to manage rebar.shop content, products, and orders directly from the chat interface -- using the same confirmation-first pattern already established for ERP write operations.

## Architecture Decision: Edge Function Extension (Recommended)

Rather than building a separate system, this plan extends the existing `admin-chat` edge function with new WP-specific tools. This is the best fit because:

- WP credentials are already stored as secrets
- The `wp-test` function already validates connectivity
- JARVIS already has a mature tool-calling + confirmation pattern
- Admin role checks and rate limiting are already in place
- No new infrastructure needed

## What Gets Built

### Phase 1: WordPress API Client (Shared Utility)

**New file: `supabase/functions/_shared/wpClient.ts`**

A reusable WordPress REST API client that:
- Reads `WP_BASE_URL`, `WP_USERNAME`, `WP_APP_PASSWORD` from environment
- Provides typed methods for common operations (GET/POST/PUT/DELETE)
- Handles Basic Auth, pagination, error formatting
- Includes WooCommerce API support (`/wp-json/wc/v3/`)
- Rate-limits outbound calls (max 5 concurrent requests)

### Phase 2: WordPress Tools for JARVIS

**Edit: `supabase/functions/admin-chat/index.ts`**

Add 10 new tools to `JARVIS_TOOLS`:

**Read tools (execute immediately):**
1. `wp_list_posts` -- List/search posts with status and category filters
2. `wp_list_pages` -- List/search pages
3. `wp_list_products` -- List WooCommerce products with stock/status filters
4. `wp_list_orders` -- List WooCommerce orders with status/date filters
5. `wp_get_site_health` -- Check broken links, missing images, SEO issues on a page

**Write tools (require confirmation):**
6. `wp_update_post` -- Update post title, content, status, or slug
7. `wp_update_page` -- Update page content or status
8. `wp_update_product` -- Update product price, stock, status, or description
9. `wp_update_order_status` -- Update WooCommerce order status
10. `wp_create_redirect` -- Create a 301 redirect (via meta or plugin API)

Write tools follow the existing confirmation-first pattern -- JARVIS proposes the action, the UI shows a Confirmation Card, and execution only happens after the user approves.

### Phase 3: Automation Safety Layer

Built into the shared WP client:

- **Idempotency**: Before updating, fetch current state; skip if already at target value
- **Rollback logging**: Before each write, store the previous value in a new `wp_change_log` database table
- **Rate limiting**: Max 10 WP API calls per minute per user session
- **SEO guards**: Refuse to delete published pages; warn when changing slugs (suggest redirect); preserve meta fields

### Phase 4: Database Table for Audit Trail

**New table: `wp_change_log`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Who initiated |
| endpoint | text | WP API endpoint called |
| method | text | GET/POST/PUT/DELETE |
| entity_type | text | post, page, product, order |
| entity_id | text | WordPress entity ID |
| previous_state | jsonb | Snapshot before change |
| new_state | jsonb | What was sent |
| result | text | success/failed |
| error_message | text | Error details if failed |
| created_at | timestamptz | When it happened |

RLS: Admin-only read/write access.

### Phase 5: ERP-to-WooCommerce Sync (Optional, Deferred)

A dedicated `wp-sync` edge function that can be triggered on a schedule or manually:
- Syncs inventory levels from the `inventory_lots` table to WooCommerce product stock
- Syncs order status changes bidirectionally
- Uses the `wp_change_log` for audit trail

This phase is documented but not built in the initial rollout -- it requires mapping SKUs between systems first.

## System Prompt Addition

The JARVIS system prompt will be extended with:

```
WORDPRESS MANAGEMENT:
- You can read and modify content on rebar.shop via WordPress REST API
- Use wp_list_* tools to inspect current state before making changes
- All write operations require user confirmation (same as ERP actions)
- When changing URLs/slugs, always suggest creating a redirect first
- Never delete published content without explicit confirmation
- Changes are logged to wp_change_log for audit and rollback
```

## What Does NOT Change

- No changes to the frontend `useAdminChat.ts` hook -- it already handles the confirmation flow
- No changes to the chat UI -- pending actions already render as Confirmation Cards
- No changes to existing JARVIS tools (machines, deliveries, etc.)
- No changes to `wp-test` function (kept as standalone health check)
- No new dependencies

## Section Order of Implementation

1. Create `wp_change_log` table with RLS
2. Create `_shared/wpClient.ts` utility
3. Add WP read tools to admin-chat
4. Add WP write tools with confirmation pattern
5. Update system prompt
6. Update `config.toml` if needed
7. Test via JARVIS chat: "show me recent posts on rebar.shop"

## Technical Details

### WP Client Example

```typescript
// supabase/functions/_shared/wpClient.ts
export class WPClient {
  private baseUrl: string;
  private authHeader: string;

  constructor() {
    const url = Deno.env.get("WP_BASE_URL")!;
    const user = Deno.env.get("WP_USERNAME")!;
    const pass = Deno.env.get("WP_APP_PASSWORD")!;
    this.baseUrl = url;
    this.authHeader = `Basic ${btoa(`${user}:${pass}`)}`;
  }

  async get(endpoint: string, params?: Record<string, string>) {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), {
      headers: { Authorization: this.authHeader }
    });
    if (!res.ok) throw new Error(`WP API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async put(endpoint: string, body: Record<string, unknown>) {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "PUT",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`WP API ${res.status}: ${await res.text()}`);
    return res.json();
  }
}
```

### Tool Registration Pattern (matches existing)

```typescript
{
  type: "function",
  function: {
    name: "wp_list_products",
    description: "List WooCommerce products from rebar.shop with optional filters.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["publish", "draft", "pending"], description: "Filter by status" },
        search: { type: "string", description: "Search term for product name" },
        stock_status: { type: "string", enum: ["instock", "outofstock"], description: "Filter by stock" },
      },
      additionalProperties: false,
    },
  },
}
```

### Rollback Flow

When a write tool executes after confirmation:
1. Fetch current entity state from WP API
2. Store snapshot in `wp_change_log.previous_state`
3. Execute the update
4. Store the sent payload in `wp_change_log.new_state`
5. If the API call fails, log error and return failure message

To rollback: Admin says "undo last WordPress change" and JARVIS reads the most recent `wp_change_log` entry, uses `previous_state` to restore.

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Accidental content deletion | Write tools cannot delete; only status changes allowed |
| SEO damage from slug changes | JARVIS warns and suggests redirect before slug changes |
| API rate limiting by host | Built-in throttle (max 10 calls/min) |
| Credential exposure | Secrets stored in environment, never logged |
| Stale data in chat | Read tools always fetch fresh data from WP API |
| WooCommerce not installed | Tools gracefully degrade with "WooCommerce not available" message |

