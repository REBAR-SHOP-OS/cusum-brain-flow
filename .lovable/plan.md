

# Add Character/Spokesperson Photo Upload to Ad Director

## What
Add a 👤 Character upload box alongside the existing Intro/Outro image uploads in the ChatPromptBar. This lets users upload a photo of a person who will act as the product spokesperson in the generated video.

## Changes

### 1. `src/components/ad-director/ChatPromptBar.tsx`
- Add `characterImage` state + `characterRef` file input
- Add a third upload box (styled with a User/UserRound icon) between Intro and Outro, labeled "Character 👤"
- Update `onSubmit` signature to include `characterImage: File | null`
- Pass `characterImage` in `handleSubmit`

### 2. `src/components/ad-director/AdDirectorContent.tsx`
- Update `handleSubmit` callback signature to accept `characterImage: File | null`
- When `characterImage` is provided, upload it to storage and include the URL in the `analyze-script` and `write-cinematic-prompt` edge function calls as `characterImageUrl` so the AI knows to incorporate the spokesperson

### Visual Layout
The three upload boxes will appear in a row: **Intro Image** — **Character 👤** — **Outro Image**, with the character box using a distinct person icon (UserRound from lucide).

