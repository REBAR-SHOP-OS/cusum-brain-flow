

## Plan: Enforce Construction Industry Hashtag Strategy in Caption Generation

### What Changes

Update the hashtag generation logic in `supabase/functions/regenerate-post/index.ts` to use a curated pool of construction/rebar industry hashtags instead of letting the AI freely generate hashtags.

### Changes — Single File

**File: `supabase/functions/regenerate-post/index.ts`**

**Change 1: Add a hashtag pool constant** (top of file, after imports)

Define the 6 hashtag categories as arrays:
- **Core**: #rebar, #rebarshop, #steelreinforcement, #reinforcedconcrete, #construction, #constructionlife, #constructionindustry, #buildingmaterials, #constructionproject, #rebarinstallation
- **B2B**: #generalcontractor, #constructionbusiness, #builderlife, #commercialconstruction, #contractorsofinstagram, #constructioncompany, #projectmanagement, #infrastructure, #civilengineering, #sitework
- **Viral**: #reelsinstagram, #constructionreels, #viralreels, #explorepage, #instareels, #trendingreels, #reelvideo, #videooftheday, #viralcontent
- **Location**: #toronto, #torontoconstruction, #torontobuilder, #canada, #canadaconstruction, #ontarioconstruction, #vaughanconstruction, #richmondhillconstruction, #gtaconstruction
- **Content**: #constructionwork, #worksite, #jobsite, #constructionworkers, #heavyequipment, #timelapseconstruction, #beforeandafter, #buildingprocess, #steelwork
- **Niche**: #rebarcage, #rebarfabrication, #rebarwork, #structuralsteel, #steelbars, #concretereinforcement, #formwork, #barbending, #constructiondetail

Add a `generateHashtags()` function that picks 15 hashtags by randomly sampling from each category (ensuring mix), then joins them space-separated.

**Change 2: Update caption-only prompt** (line ~302-327)

- Remove "Write 8-12 relevant hashtags" instruction from the prompt
- Remove `hashtags` from the expected JSON response
- After parsing AI response, call `generateHashtags()` to produce the 15 hashtags deterministically from the pool

**Change 3: Update full regeneration prompt** (line ~391-420)

- Same change: remove hashtag instruction from prompt, remove `hashtags` from JSON schema
- After parsing, use `generateHashtags()` for hashtags

**Change 4: Update content assembly**

Both paths currently read `newCap.hashtags` / `newContent.hashtags`. Replace with the output of `generateHashtags()`.

### What Stays the Same
- Caption text generation (AI still writes captions)
- Persian translation
- Image slogan logic
- Video-to-social flow (separate edge function, not affected)
- Frontend code — no changes needed

### Result
Every "Regenerate caption" click will produce exactly 15 industry-relevant hashtags from the curated pool, mixed across all 6 categories, with no generic tags like #love or #happy.

