

## Optimize Pixel Social Media Agent with Document Strategy

### Summary

Integrate the content strategy from your uploaded document into the Pixel social media system. This adds the specific daily schedule (5 posts/day at fixed times), product catalog, company details, bilingual requirements, and image rules -- applied **only** to the social media agent and auto-generate function.

### What Changes

**1. Update Pixel agent system prompt** (`supabase/functions/ai-agent/index.ts`, social section ~line 1061-1113)

Add these rules from your document to the existing Pixel system prompt:

- **Daily 5-post schedule with fixed times:**
  - 06:30 AM -- Motivational / self-care / start of work day
  - 07:30 AM -- Creative promotional post
  - 08:00 AM -- Inspirational (emphasizing strength and scale)
  - 12:30 PM -- Inspirational (emphasizing innovation and efficiency)
  - 02:30 PM -- Creative promotional for company products

- **Allowed product catalog** (random selection per post):
  - Rebar Fiberglass Straight, Rebar Stirrups, Rebar Cages, Rebar Hooks, Rebar Hooked Anchor Bar, Wire Mesh, Rebar Dowels, Standard Dowels 4x16, Circular Ties/Bars, Rebar Straight

- **Company details baked into prompts:**
  - Address: 9 Cedar Ave, Thornhill, Ontario
  - Phone: 647-260-9403
  - Web: www.rebar.shop

- **Content rules:**
  - All content must be in English
  - Farsi translation shown but NOT uploaded
  - Company logo MUST appear in every image
  - Images must be realistic (construction-focused), inspired by nature, minimalist art
  - Captions should be scientific, promotional, beautiful language
  - Each of the 5 posts must feature a DIFFERENT product
  - Hashtags required on every post

- **Regeneration guidance:** Instruct Pixel that users can request regeneration of individual images/captions

**2. Update auto-generate-post edge function** (`supabase/functions/auto-generate-post/index.ts`)

Replace the current generic schedule with the 5 fixed time slots from the document:

- Generate exactly 5 posts per day (not per-platform)
- Each post assigned to a specific time slot (06:30, 07:30, 08:00, 12:30, 14:30)
- Each post randomly picks a different product from the allowed catalog
- Image prompts include "must include REBAR.SHOP logo" instruction
- `scheduled_date` set to the correct time for each post

**3. Save strategy as Brain knowledge** (one-time database insert)

Insert the full content strategy document into the `knowledge` table with:
- `category: "social-strategy"`
- `title: "Pixel Daily Content Strategy"`
- Content: the full rules (schedule, products, brand guidelines, bilingual requirements)

This way the Pixel agent can reference it from Brain context.

### Files Modified

| File | Scope | What Changes |
|------|-------|-------------|
| `supabase/functions/ai-agent/index.ts` | Lines ~1061-1113 (social prompt only) | Add daily schedule, product catalog, company info, image rules, bilingual requirement |
| `supabase/functions/auto-generate-post/index.ts` | Full file | Generate 5 posts at fixed times, random product per post, logo requirement in image prompts |
| Database migration | One-time insert | Save strategy doc to `knowledge` table |

### What Is NOT Changed
- All other agents remain untouched
- No frontend UI changes needed
- No changes to social-publish or other edge functions

### Technical Details

**ai-agent social prompt addition** (appended to existing prompt):

```
## DAILY CONTENT SCHEDULE (5 Posts Per Day)
| Time | Theme |
|------|-------|
| 06:30 AM | Motivational / self-care / start of work day |
| 07:30 AM | Creative promotional post |
| 08:00 AM | Inspirational - strength & scale |
| 12:30 PM | Inspirational - innovation & efficiency |
| 02:30 PM | Creative product promotional |

## ALLOWED PRODUCTS (rotate randomly, each post different)
Rebar Fiberglass Straight, Rebar Stirrups, Rebar Cages, Rebar Hooks,
Rebar Hooked Anchor Bar, Wire Mesh, Rebar Dowels, Standard Dowels 4x16,
Circular Ties/Bars, Rebar Straight

## MANDATORY IMAGE RULES
- Company logo (REBAR.SHOP) MUST appear in every image
- Images must be REALISTIC (construction scenes, shop floor, products)
- Inspired by nature + minimalist art aesthetic
- Scientific and promotional text overlays inside images

## BILINGUAL RULE
- All content created in English
- Provide Farsi translation for display only (not for upload)

## COMPANY INFO (include in every post)
Address: 9 Cedar Ave, Thornhill, Ontario
Phone: 647-260-9403
Web: www.rebar.shop
```

**auto-generate-post changes:**
- Replace `platforms` loop with a `timeSlots` array of 5 entries
- Each slot picks a random product from the catalog
- Image prompt includes logo requirement
- `scheduled_date` computed as `postDate + timeSlot offset`

