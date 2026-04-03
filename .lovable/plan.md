

# Fix Website Support Widget — Not Starting Conversations

## Problem
The support widget on rebar.shop shows "We could not start the conversation right now" error. Investigation reveals:

1. The `support-chat` edge function works correctly — tested directly, returns valid `conversation_id`
2. The current `generateWidgetJs` produces a **simple widget** with no error message display and silent failure handling
3. The website is serving a **cached older version** of the widget (via BunnyCDN/optimizer) that has a fancier UI with the error text
4. The widget JS on rebar.shop is loaded via a deferred script loader (`bv-dl-scripts-list`) which may interfere with execution timing

## Root Causes
- **Cache staleness**: The website's CDN optimizer cached an older widget JS version that has different error handling
- **Script loader interference**: The widget script is loaded through BunnyCDN's deferred script loader, which may cause timing issues with the `async` IIFE pattern
- **Silent failures**: The current simple widget has `catch(e){ started=false; }` with zero user feedback

## Plan

### 1. Upgrade `generateWidgetJs` to a modern, robust widget
Replace the simple widget generator in `supabase/functions/support-chat/index.ts` (lines 676-822) with a production-grade widget that:

- Has the modern UI matching the app's design language (gradient header, branded styling, "LIVE" badge)
- Shows clear error messages when conversation start fails (with retry button)
- Handles network timeouts gracefully
- Adds a retry mechanism for the `start` action
- Displays the welcome message from config immediately while the conversation initializes
- Works correctly when loaded via deferred script loaders

### 2. Add `Cache-Control: no-cache` to widget JS response
Change line 54 from `max-age=300` to `no-cache, no-store, must-revalidate` temporarily to force cache busting, ensuring websites pick up the new version immediately. Can be reverted to a short cache later.

### 3. Add error recovery in the widget
- If `start` fails, show a friendly message with a "Retry" button
- Add a 10-second timeout on the fetch call
- Retry automatically once before showing error
- When conversation starts successfully, show the proactive greeting normally

### Files changed
| File | Change |
|------|--------|
| `supabase/functions/support-chat/index.ts` | Replace `generateWidgetJs` function with modern widget + fix cache headers |

### Safety
- Edge function logic (start, send, poll, AI reply) is unchanged — only the generated widget JS output changes
- Fallback behavior preserved: widget still works if AI greeting fails
- No database changes needed

