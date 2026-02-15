
# Fix Chat Message Text Overflowing the Frame

## Problem
Message bubbles in the chat (both user and assistant) overflow horizontally. Long text like error stack traces and attached file URLs extend beyond the visible chat area. The current `overflow-hidden` and `break-words` are not sufficient -- the text still pushes past the container.

## Changes

### `src/components/website/WebsiteChat.tsx`

1. **ScrollArea container (line 205)**: Add `overflow-hidden` to prevent the scroll area from expanding beyond its parent:
   - `<ScrollArea className="flex-1 overflow-hidden">`

2. **Messages wrapper div (line 206)**: Add `overflow-hidden` to constrain all children:
   - `<div className="p-3 space-y-3 w-full overflow-hidden">`

3. **Message bubble div (line 233)**: Add `[overflow-wrap:anywhere]` and `[word-break:break-all]` to force long strings to wrap:
   - Add `[overflow-wrap:anywhere] [word-break:break-all]` to the className

4. **User message paragraph (line 242)**: Add `break-all` and `[overflow-wrap:anywhere]` so long URLs and error text wrap inside user bubbles:
   - `<p className="whitespace-pre-wrap break-all [overflow-wrap:anywhere]">`

These are CSS-only fixes. The key issue is that `break-words` alone does not break long unbreakable strings like URLs and stack traces -- `overflow-wrap: anywhere` and `word-break: break-all` are needed to force wrapping at any character.
