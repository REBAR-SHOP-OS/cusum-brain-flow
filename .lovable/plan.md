
# Give Seomi Full SEO Access -- Fix, Edit, Post, Audit

Upgrade Seomi from a chat-only advisor to a fully operational SEO agent with real WordPress tools and live page scraping, matching the pattern already used by Vizzy in admin-chat.

## What Changes

Seomi will be able to:
- **Read** all posts, pages, and products from rebar.shop
- **Edit** meta titles, descriptions, content, slugs (with confirmation)
- **Create** new blog posts for SEO content strategy
- **Audit** any live page by scraping it and analyzing on-page SEO
- **Fix** issues directly (update headings, add alt text, fix meta tags)

## Architecture

Seomi uses the existing `ai-agent` edge function (not admin-chat). The ai-agent already supports tool calling. We add WordPress + Firecrawl tools specifically for the `seo` agent type.

```text
User (Seomi chat) --> ai-agent edge function
                         |
                         +--> WP Read Tools (list posts/pages, get single page)
                         +--> WP Write Tools (update post/page content, create post)
                         +--> Firecrawl Scrape (live on-page SEO audit)
                         +--> create_notifications (existing)
```

## Files to Edit

### 1. `supabase/functions/ai-agent/index.ts`

**A) Add SEO tools array** (around line 4088, alongside existing tools):

When `agent === "seo"`, append these tools:

**Read tools** (execute immediately):
- `wp_list_posts` -- list/search blog posts
- `wp_list_pages` -- list/search pages
- `wp_get_post` -- get single post with full content
- `wp_get_page` -- get single page with full content
- `wp_list_products` -- list WooCommerce products
- `scrape_page` -- scrape any rebar.shop URL via Firecrawl for live SEO audit (title, meta, headings, content)

**Write tools** (execute directly since ai-agent doesn't use confirmation flow -- but require user approval in the prompt):
- `wp_update_post` -- update post title, content, slug, meta
- `wp_update_page` -- update page title, content, slug
- `wp_create_post` -- create a new blog post (draft by default)

**B) Add tool execution handlers** (around line 4182, in the tool_calls loop):

For each WP tool call:
- Instantiate `WPClient` from `../_shared/wpClient.ts` (already imported pattern from admin-chat)
- Execute the WordPress API call
- Log changes to `wp_change_log` table
- Return result as tool response to the AI for a follow-up message

For `scrape_page`:
- Call the Firecrawl API via `FIRECRAWL_API_KEY` env var
- Return markdown content for the AI to analyze

**C) Enhance Seomi's system prompt** (line 1463):

Add actionable tool instructions:
- "You have direct access to rebar.shop via WordPress API tools"
- "Always scrape a page first before suggesting SEO fixes"
- "When fixing SEO issues, use wp_update_post/wp_update_page to apply changes"
- "Create blog posts as drafts using wp_create_post"
- "Always tell the user what you're about to change before doing it"
- SEO best practices checklist the agent must follow

### 2. `src/components/agent/agentConfigs.ts`

Update Seomi's capabilities list to reflect new powers:
```
capabilities: [
  "Live page SEO audit",
  "Edit meta titles & descriptions",
  "Create & publish blog posts",
  "Fix on-page SEO issues",
  "Keyword optimization",
  "Content analysis"
]
```

### 3. `src/components/agent/agentSuggestionsData.ts`

Update SEO suggestions to include actionable items:
- "Audit the homepage SEO"
- "Fix meta descriptions on all pages"
- "Create a blog post about rebar sizes"
- "Check all pages for missing H1 tags"
- "List all draft posts"

## Technical Details

- The `WPClient` is already in `supabase/functions/_shared/wpClient.ts` and works with the existing `WP_BASE_URL`, `WP_USERNAME`, `WP_APP_PASSWORD` secrets
- Firecrawl uses the `FIRECRAWL_API_KEY` secret (needs to be connected via the Firecrawl connector if not already)
- The ai-agent tool call loop already handles `create_notifications` and `send_email` -- we add WP and scrape handlers in the same pattern
- Write operations log to `wp_change_log` table (already exists from the Website Manager implementation)
- No new database tables or migrations needed
- No new edge functions needed -- everything goes into the existing `ai-agent` function
