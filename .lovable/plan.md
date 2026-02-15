

# Give AI Website Editor Full WooCommerce Read/Write Access

## Problem

The AI Website Editor says "WooCommerce is not currently active" when you ask to list products. Two root causes:

1. **Auth bug in wpClient.ts** -- WooCommerce endpoints that don't end with `/` (like `/wc/v3/products`) fail the auth check on line 64, falling back to Basic Auth instead of using WC Consumer Key/Secret. Also, if Basic Auth doesn't have WC permissions, the call returns 401 which gets swallowed as "WooCommerce not available."
2. **Silent error swallowing** -- The `listProducts` method catches ALL errors and returns a friendly "not available" message, hiding the real problem.
3. **Missing tools** -- No create/delete product, no create post, no individual get tools for direct lookups.

## Fix Plan

### 1. Fix WC Auth in `supabase/functions/_shared/wpClient.ts`

- Fix the auth condition to match any endpoint starting with `/wc/v3` (with or without trailing slash)
- Add fallback: if WC consumer keys fail (401), retry with Basic Auth
- Remove the silent error swallowing in `listProducts` and `listOrders` -- let errors propagate with real messages
- Add `createProduct`, `deleteProduct`, `createPost` convenience methods

### 2. Add Missing Tools to `supabase/functions/admin-chat/index.ts`

Add these new tool definitions and their execution handlers:

**New READ tools:**
- `wp_get_product` -- Get a single product by ID (full details)
- `wp_get_page` -- Get a single page by ID  
- `wp_get_post` -- Get a single post by ID

**New WRITE tools (require confirmation):**
- `wp_create_product` -- Create a new WooCommerce product (name, regular_price, description, status, stock_quantity, images)
- `wp_delete_product` -- Delete/trash a WooCommerce product
- `wp_create_post` -- Create a new blog post (title, content, status, categories)

Add these to WRITE_TOOLS set and JARVIS_TOOLS array, plus execution handlers in `executeReadTool` and `executeWriteTool`.

### 3. Improve Error Logging

Add `console.error` calls in WC methods so failures show up in edge function logs instead of being silently swallowed.

### 4. Update System Prompt

Add explicit WC capabilities section listing all new tools so the AI knows it can create/delete products.

## Files Modified

1. `supabase/functions/_shared/wpClient.ts` -- Fix WC auth, add create/delete methods, remove silent error swallowing
2. `supabase/functions/admin-chat/index.ts` -- Add 6 new tools (3 read, 3 write), update prompt

## Expected Outcome

- "List products" will work and show actual WooCommerce products
- AI can create, update, and delete products
- AI can create blog posts
- Errors show real messages instead of "WooCommerce not available"

