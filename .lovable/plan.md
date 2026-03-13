

# Add Image Aspect Ratio Selector to Pixel Chat

## Overview
Add two aspect ratio toggle buttons (Landscape 16:9 and Square 1:1) next to the Products section in the Pixel agent's chat input. The selected ratio flows through the pipeline to control generated image dimensions.

## Changes

### 1. `src/components/chat/ChatInput.tsx`
- Add `imageAspectRatio` and `onImageAspectRatioChange` props to `ChatInputProps`
- Add two toggle buttons after the Products section: a landscape icon (RectangleHorizontal) for "16:9" and a square icon (Square) for "1:1" (default)
- Style them similarly to the existing Style/Products groups with a "SIZE" label

### 2. `src/pages/AgentWorkspace.tsx`
- Add `imageAspectRatio` state (default `"1:1"`)
- Pass it to both `ChatInput` instances as prop
- Include `imageAspectRatio` in `extraContext` when agent is "social"

### 3. `supabase/functions/ai-agent/index.ts`
- Read `imageAspectRatio` from `userContext`
- When generating images via Gemini, inject aspect ratio instruction into the image prompt
- When using OpenAI gpt-image-1, map "16:9" → `"1536x1024"` and "1:1" → `"1024x1024"` for the `size` parameter

### 4. `supabase/functions/regenerate-post/index.ts`
- Same aspect ratio handling as ai-agent for regeneration path

