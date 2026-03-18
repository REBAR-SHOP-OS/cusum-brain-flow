

## Plan: Enforce Short Image Slogans + Service-Focused Captions

### Problem
From the screenshot, two issues are visible:
1. **Image text is too long** — "Spring into Action with with Ontario Steels! New Beginnings, Stronger Builds. Happy Nowruz & First Day of Spring!" plus a sub-line. Should be a short billboard tagline (max 6 words).
2. **Caption repeats the image text** — Should instead describe the company's services and value proposition, not echo the slogan.

### Changes — `supabase/functions/_shared/agents/marketing.ts`

**1. Strengthen image slogan rules (around line 87-88)**
- Add explicit enforcement: "The text overlay on the image MUST be a SHORT billboard tagline — MAXIMUM 6 WORDS. Examples: 'Build Stronger. Build Smarter.' or 'Steel You Can Trust'. NEVER write full sentences, event greetings, or multi-line paragraphs on the image. If an event/occasion is relevant, weave it into ONE short tagline, not a paragraph."
- Add to the generate_image prompt instructions: "In your prompt to generate_image, specify that the text overlay must be exactly ONE short line of max 6 words. Do NOT request multiple lines of text on the image."

**2. Make caption service-focused (around lines 117, 136)**
- Update caption rule: "The caption MUST describe REBAR.SHOP's services and products — what the company offers, why customers should choose it, how it helps their projects. It must NOT repeat or paraphrase the image slogan. Use a fresh angle: highlight delivery speed, product range, project support, or customer benefits."
- Add examples of good vs bad captions to guide the AI.

### Single file change
- `supabase/functions/_shared/agents/marketing.ts`

