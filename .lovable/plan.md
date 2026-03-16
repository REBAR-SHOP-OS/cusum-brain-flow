

# Fix: No Persian Text in Images, Mandatory Logo, Story = No Caption

## Problems Identified
1. **Persian/Farsi text in images**: The `generate-image` edge function and `agentToolExecutor.ts` prompts don't explicitly forbid non-English text in images. The agent's `marketing.ts` prompt mentions "Farsi image text" which can leak into image generation prompts.
2. **Logo not always present**: The `generate-image` function passes `logoUrl` but doesn't always enforce it. The `agentToolExecutor.ts` already includes logo logic but the `generate-image` standalone function needs stronger enforcement.
3. **Story posts should have no caption**: When content_type is "story", the system still generates and displays captions. Stories should be image-only.

## Changes

### 1. `supabase/functions/generate-image/index.ts` — Add "English only" rule to prompt
In `buildAdPrompt()`, add explicit instruction forbidding non-English text:
```
- ALL text on the image MUST be in ENGLISH ONLY. ABSOLUTELY NO Persian, Farsi, Arabic, or any non-Latin script text.
```

### 2. `supabase/functions/_shared/agentToolExecutor.ts` — Add English-only rule to image prompt
After the aspect ratio injection (line ~615), add:
```typescript
imagePrompt += "\n\nLANGUAGE RULE: ALL text rendered on the image MUST be in ENGLISH ONLY. NO Persian, Farsi, Arabic, or any non-Latin script text is allowed in the image.";
```

### 3. `supabase/functions/_shared/agents/marketing.ts` — Remove Farsi image text requirement
Update the prompt to clarify that Persian translations are for captions only, NOT for image text. Remove the `imageTextFa` from image generation context.

### 4. `src/components/social/PostReviewPanel.tsx` — Hide caption for Story content type
- When `localContentType === "story"`, hide the Content section (title, content, hashtags)
- When content_type is story and using `handleMediaReady`, skip auto-caption generation
- In the story gen callback, auto-set content_type to "story"

### 5. `src/components/social/ImageGeneratorDialog.tsx` — Story mode: auto-set content_type
When `storyMode` and user clicks "Use in Post", pass a signal so the parent knows to set content_type to "story" and clear any caption.

## Summary
- Add "ENGLISH ONLY" rules to both `generate-image` and `agentToolExecutor` image prompts
- Hide caption UI for story-type posts in PostReviewPanel
- Skip caption generation when content_type is "story"
- Ensure logo is always referenced in prompts

