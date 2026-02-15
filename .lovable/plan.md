

# Connect Brain AI Content to Support Knowledge Base

## Problem
The Brain AI platform contains your business knowledge (memories, documents, webpages) but the Support Knowledge Base -- which powers the AI chatbot and agent suggestions -- is empty. Brain AI doesn't have a public API, so we need a way to transfer that content.

## Solution
Add two import methods to the Knowledge Base editor so you can quickly populate it with Brain AI content:

### 1. Bulk Text Import
A new "Import" button in the Knowledge Base section that opens a dialog where you can:
- Paste multiple pieces of content from Brain AI (memories, documents, etc.)
- Each entry gets parsed and saved as a separate KB article
- Supports a simple format: title on the first line, content below (separated by blank lines for multiple entries)

### 2. URL Scrape Import
A "Scrape URL" option that:
- Accepts a webpage URL (e.g., the webpages stored in Brain AI)
- Uses the Firecrawl connector to fetch the page content as markdown
- Auto-populates a new KB article with the scraped content

## How It Works End-to-End

Once articles are in the Knowledge Base:
- Customer chatbot (`support-chat` edge function) already reads `kb_articles` and sends them as context to the AI
- Agent "Suggest Reply" (`support-suggest` edge function) already reads `kb_articles` for drafting responses
- No changes needed to the AI pipeline -- just populating the KB is enough

## Technical Details

### Changes to `KnowledgeBase.tsx`
- Add "Import" button next to the existing "+ Article" button
- New dialog with two tabs:
  - **Paste Content**: A textarea for bulk pasting. Format: entries separated by `---`. First line of each entry becomes the title, rest becomes content.
  - **Scrape URL**: An input for a URL + "Fetch" button. Calls `firecrawl-scrape` edge function and creates an article from the result.
- Each imported entry is inserted into `kb_articles` as a published article

### Firecrawl Integration
- The scrape feature uses the existing `firecrawl-scrape` edge function (already in the codebase)
- Requires the Firecrawl connector to be enabled (will check and prompt if needed)

### No database changes needed
- All content goes into the existing `kb_articles` table
- The existing AI reply logic automatically picks up new articles

