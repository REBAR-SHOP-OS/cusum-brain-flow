## Problem

Two issues with the 5-Stories generator in `supabase/functions/auto-generate-post/index.ts`:

1. **No banner text** — current prompt explicitly says *"ABSOLUTELY NO text overlay, NO slogan, NO caption inside the image."* The user now wants each story to look like a marketing **banner** with a short headline + brand text **baked into the image**.
2. **Visual repetition risk** — the 5 stories per run cycle through 5 fixed `STORY_ANGLES` strings and use no per-image uniqueness token. Across multiple runs (or even within one run when the model latches onto a similar composition) images can look nearly identical.

## Fix (single file, edge function only)

Edit only `supabase/functions/auto-generate-post/index.ts` inside the `mode === "story"` branch.

### 1. Banner headlines baked into the image

- Add a small array of short banner headline templates (≤4 words each), e.g. `"Built to Last"`, `"Industrial Grade"`, `"Made in Ontario"`, `"Order Today"`, `"Precision Steel"`. These rotate per slot alongside the angle.
- Switch the model from `openai/gpt-image-2` (low) to **`openai/gpt-image-2` with `quality: "medium"`** — gpt-image-2's headline strength is legible in-image typography, but `low` quality renders text poorly. Medium is required for clean banner text. Size stays `1024x1536` (portrait 2:3, the closest gateway-supported aspect to 9:16).
- Rewrite the prompt to **require** baked-in text:
  - Large bold sans-serif headline (the rotating phrase) in the upper third, high-contrast over a darkened gradient strip.
  - Small "REBAR.SHOP" wordmark + product name strip in the lower third.
  - Headline color picked from the brand kit primary if available, else white on dark.
  - All text must be spelled exactly as given; no extra text, no lorem ipsum, no decorative gibberish.

### 2. Hard anti-repetition

- Add a wider pool: 12 `STORY_ANGLES` (up from 5), 10 `STORY_LIGHTING` moods, 8 `STORY_PALETTES`, 8 `STORY_HEADLINES`. For each of the 5 slots, randomly draw **without replacement** one angle + one lighting + one palette + one headline → 5 unique combinations per run.
- Inject a per-image **uniqueness token** into the prompt: `Variation seed: <crypto.randomUUID()>. This image must be visually distinct from any other generation — different angle, lighting, palette, and headline.`
- After generation, before saving, compute a SHA-256 of the PNG bytes; if the same hash appears twice in the same run, retry that slot once with a fresh seed. (Cheap defense; gpt-image-2 almost never repeats but it's a real guard.)
- Keep per-run state in a `Set<string>` of used hashes scoped to the request handler.

### 3. Keep everything else identical

- Placeholder row creation, time slots, `content_type: "story"`, `content: ""`, parallel BATCH=2 generation loop, upload path `images/story-<uuid>.png`, DB update via `image_url` — all unchanged.
- Non-story branches (`mode !== "story"`) — unchanged.

## Out of scope

- Frontend (`SocialMediaManager.tsx`, `useAutoGenerate.ts`) — no UI changes; cards already render `image_url`.
- Regenerating historical stories — only new generations get banner text.
- Switching image provider away from Lovable AI Gateway.
- Adding a user-facing field to customize the headline text (not requested).

## Verification

1. Click pink 5-Stories icon → pick date + product → wait for generation.
2. Each of the 5 new cards should show:
   - Portrait 2:3 aspect (taller than wide).
   - A clear bold headline baked **into** the image (e.g. "Built to Last").
   - Small "REBAR.SHOP" wordmark + product name visible.
3. Compare the 5 cards side by side → angle, lighting, palette, and headline must all differ.
4. Run the 5-Stories generator a **second** time on a different date with the same product → the new 5 should not visually match the first 5 (different angle/lighting/headline draws).
5. Edge function logs should show no duplicate-hash retries in normal runs; if a retry fires, it should also succeed.

## Technical notes

- gpt-image-2 `quality: "medium"` ~3–4× cost vs `low` but is the only reliable way to get readable typography. Worth it for banners.
- 1024x1536 (2:3) remains the closest gateway-supported portrait. True 9:16 (1080x1920) is not exposed; stories will be center-displayed with negligible crop on IG/FB.
- Anti-repetition via `crypto.randomUUID()` + no-replacement draws + post-hash check is deterministic and adds no external dependency.
