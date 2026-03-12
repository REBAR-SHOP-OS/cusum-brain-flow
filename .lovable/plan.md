

# Add "Auto Generate Story" Button (9:16 Vertical)

## What
Add an "Auto Generate Story" button below the Generate video row in the PostReviewPanel. When clicked, it generates a **9:16 vertical Story image** using the same AI image pipeline but with a portrait aspect ratio instruction.

## Changes

### 1. `src/components/social/PostReviewPanel.tsx`
- Add state: `const [showStoryGen, setShowStoryGen] = useState(false);`
- Add a new button row after the video buttons (line ~438), with a `BookImage` (or `Smartphone`) icon and label "Auto Generate Story"
- Add a new `ImageGeneratorDialog` instance with a `storyMode` prop:
  ```
  <ImageGeneratorDialog
    open={showStoryGen}
    onOpenChange={setShowStoryGen}
    storyMode
    onImageReady={(url) => {
      setShowStoryGen(false);
      handleMediaReady(url, "image");
    }}
  />
  ```

### 2. `src/components/social/ImageGeneratorDialog.tsx`
- Add `storyMode?: boolean` to props
- When `storyMode` is true:
  - Change dialog title to "AI Story Generator"
  - Skip `ensureSquare` — instead apply `ensurePortrait` (9:16 crop)
  - Pass `aspectRatio: "9:16"` to the edge function
- Auto-populate a story-appropriate prompt when opened in story mode (e.g., from post title if available, or a default)

### 3. `src/lib/imageWatermark.ts`
- Add `ensurePortrait` function that crops/pads to 9:16 aspect ratio using Canvas (similar to `ensureSquare` but with 9:16 ratio)

### 4. `supabase/functions/generate-image/index.ts`
- Accept optional `aspectRatio` param from request body
- In `buildAdPrompt`, conditionally set the aspect ratio rule:
  - `"9:16"` → "The image MUST be VERTICAL (9:16 portrait aspect ratio), suitable for Instagram/Facebook Stories."
  - Default `"1:1"` → current square rule

