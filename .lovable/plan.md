

# Connect Pexels API for Stock Images & Videos

## Setup
1. **Store `PEXELS_API_KEY` secret** — I'll prompt you to enter your API key securely via the secrets tool
2. **Create `pexels-search` edge function** — proxies requests to Pexels API (keeps key server-side)
3. **Update `StockImagesTab.tsx`** — live search + results grid with photographer credit
4. **Update `StockVideoTab.tsx`** — live search + results grid with duration badges

## Edge Function: `supabase/functions/pexels-search/index.ts`
- Accepts `{ type: "photo" | "video", query: string, page?: number, per_page?: number }`
- Photos → `GET https://api.pexels.com/v1/search`
- Videos → `GET https://api.pexels.com/videos/search`
- Returns normalized results (thumbnail, full URL, photographer, duration for videos)

## UI Updates

**StockImagesTab**: Search bar triggers API call → grid of image cards with thumbnails, photographer name, click to select/use

**StockVideoTab**: Search bar triggers API call → grid of video thumbnails with duration badge, click to preview/use

Category buttons become pre-filled search queries (e.g. clicking "Nature" searches "nature").

## Files
- **Create**: `supabase/functions/pexels-search/index.ts`
- **Edit**: `src/components/ad-director/editor/StockImagesTab.tsx`
- **Edit**: `src/components/ad-director/editor/StockVideoTab.tsx`
- **Edit**: `supabase/config.toml` — add `[functions.pexels-search]`

