

## Add Character/Person Image Upload to Ad Director

### What
Add a third upload zone labeled "Character" (with a person icon) between Intro and Outro in the ChatPromptBar. This lets users upload a reference photo of a person who should appear in the generated video as a product spokesperson.

### Changes

**File: `src/components/ad-director/ChatPromptBar.tsx`**

1. Add `characterImage` state + `characterRef` for file input
2. Add a third upload box between Intro and Outro with a `UserRound` icon and label "Character"
3. Update `onSubmit` prop signature to include `characterImage: File | null`
4. Pass `characterImage` in `handleSubmit` call

**File: `src/components/ad-director/AdDirectorContent.tsx`**

5. Update `handleSubmit` signature to accept `characterImage: File | null`
6. If `characterImage` is provided, upload it to storage and include the URL in the `analyze-script` and `write-cinematic-prompt` edge function calls as `characterImageUrl` — this tells the AI to feature this person in the video scenes
7. Add `characterImageUrl` to the `generate-clip` payload so the video generation model receives the person reference

### UI Layout
```text
[Intro Image]  [Character 👤]  [Outro Image]
```
The Character box uses the same dashed-border style as Intro/Outro but with a `UserRound` icon and slightly different accent color (purple tint) to distinguish it.

### Files
- `src/components/ad-director/ChatPromptBar.tsx` — add character upload zone + pass to onSubmit
- `src/components/ad-director/AdDirectorContent.tsx` — receive characterImage, upload to storage, include in AI pipeline calls

