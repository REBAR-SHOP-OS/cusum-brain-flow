

## Auto-Generate Button: Align with Pixel Agent Quality

The current `auto-generate-post` edge function uses a simplified prompt compared to the Pixel agent. The key gaps:

| Area | Current Auto-Generate | Pixel Agent |
|------|----------------------|-------------|
| Image style | Generic "realistic construction" | Strict photorealistic rules, diverse styles, mandatory logo |
| Caption format | Basic with CTA | Strict order: image → caption → contact → hashtags → Persian |
| Forbidden words | None | "guaranteed", "ensure", "promise" etc. |
| Visual diversity | No guidance | Rotates between 12+ visual styles |
| Contact info | Listed but loosely used | Mandatory in every caption with emojis |

### Changes

**File: `supabase/functions/auto-generate-post/index.ts`**

Replace the system prompt (lines 161-206) with the Pixel agent's detailed rules:

1. **Image prompt rules** — Add photorealistic enforcement, diverse visual styles rotation, mandatory REBAR.SHOP logo exactly as original, forbidden CGI/cartoon/fantasy
2. **Caption rules** — Add forbidden words list ("guaranteed", "ensure", "promise"), mandatory contact info with emojis (📍 📞 🌐), strict output order
3. **Persian translation** — Add `farsi_translation` requirement matching Pixel's `---PERSIAN---` format
4. **Contact info format** — Change from plain text to emoji-prefixed:
   ```
   📍 9 Cedar Ave, Thornhill, Ontario
   📞 647-260-9403
   🌐 www.rebar.shop
   ```
5. **Image generation prompt** (line 251) — Enhance to match Pixel's detailed requirements: photorealistic, diverse compositions, English text overlays, specific style rotation

6. **Ensure address appears in content** — Add explicit instruction that the AI must embed contact info directly into the `content` field (not just as metadata), so the published post includes the address.

This is a single-file update to the edge function prompt. No structural/code logic changes needed — only the AI instructions change.

