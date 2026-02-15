

## Feature: Let Chat Inspect the Currently Open Page

### What This Does
Adds a new "Inspect Page" capability so the AI chat can fetch and analyze the live HTML content of whatever page is currently open in the preview iframe. Since the iframe loads rebar.shop (cross-origin), we can't read its DOM from the browser -- instead, the edge function fetches the page server-side and extracts the meaningful content.

### Changes

**1. Edge Function: `supabase/functions/admin-chat/index.ts`**

- Add a new read tool `wp_inspect_page` to the JARVIS_TOOLS array:
  - Parameter: `url` (string) -- the full URL or path on rebar.shop to inspect
  - Description: "Fetch and analyze the live HTML content of a page on rebar.shop"
- Add execution logic in `executeReadTool`:
  - Fetch the page HTML from `https://rebar.shop{path}`
  - Strip `<script>`, `<style>`, `<nav>`, `<footer>` tags to reduce noise
  - Extract text content, meta tags (title, description, OG tags), headings, links, and images
  - Return structured JSON with: `title`, `meta_description`, `headings`, `text_content` (truncated to ~4000 chars), `links`, `images`, `forms`
- Update the system prompt to mention the inspect capability and instruct the AI to use it when the user asks about what's on the current page
- Add `wp_inspect_page` to the progress labels map

**2. Frontend: `src/components/website/WebsiteChat.tsx`**

- Add an "Inspect Page" quick action button (eye icon) next to the existing quick actions
- When clicked, it sends a message like: `[Currently viewing: rebar.shop/path]\nInspect and analyze this page`
- Add "Inspect this page" to the QUICK_ACTIONS array so it appears as a suggestion chip

### How It Works

```text
User clicks "Inspect this page" or asks "what's on this page?"
    |
    v
Chat sends message with current path context
    |
    v
AI calls wp_inspect_page tool with the path
    |
    v
Edge function fetches https://rebar.shop/path server-side
    |
    v
Strips scripts/styles, extracts structured content
    |
    v
AI analyzes and summarizes the page content
```

### Technical Notes
- The fetch happens server-side in the edge function, so there are no CORS issues
- HTML is sanitized and truncated to stay within token limits (~4000 chars of text)
- Meta tags, headings, and link structure are extracted separately for structured analysis
- The AI can then answer questions like "what products are on this page?", "is the contact form working?", "what does this page look like?"

