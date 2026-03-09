

# Glasses Capture — Cross-Platform Web Page

## Problem
iOS Shortcuts only work on iPhone. User needs Android and iOS Chrome support.

## Solution
Build a **`/glasses`** page inside the existing PWA that:
1. Opens the phone camera (using `<input type="file" capture="environment">`)
2. Lets user snap a photo or pick from gallery (Meta View album)
3. Sends it to `vizzy-glasses-webhook` for Gemini analysis
4. Shows the AI analysis result inline
5. Lists recent captures from `glasses_captures` table

Since the app is already a PWA, users on **any device** (Android, iOS Chrome, Samsung Internet) can install it to their home screen and use camera capture.

## Implementation

### 1. Create `src/pages/GlassesCapture.tsx`
- Camera capture button (native file input with `accept="image/*"`)
- Optional text prompt field
- Submit → convert to base64 → call webhook
- Display analysis result
- List of recent captures from DB

### 2. Create `src/components/glasses/GlassesCaptureForm.tsx`
- Camera/gallery picker
- Base64 conversion utility
- POST to webhook with `GLASSES_WEBHOOK_KEY` header

### 3. Create `src/components/glasses/GlassesCaptureHistory.tsx`
- Query `glasses_captures` table
- Show image thumbnails + analysis text
- Realtime subscription for new captures

### 4. Add route to `App.tsx`
- `/glasses` → `GlassesCapture` page

### 5. Store webhook key approach
- The webhook key is a secret — we'll call the webhook via a thin edge function proxy (`vizzy-glasses-submit`) that adds the key server-side, so the web client never exposes it
- OR: since the user is authenticated in the PWA, we create an authenticated version that bypasses the webhook key

**Recommended**: Create a simple authenticated wrapper — if user is logged in, the edge function trusts the JWT instead of the webhook key. This is cleaner for in-app usage.

### Files to create/edit
- `src/pages/GlassesCapture.tsx` — main page
- `src/components/glasses/GlassesCaptureForm.tsx` — capture form
- `src/components/glasses/GlassesCaptureHistory.tsx` — history list
- `src/App.tsx` — add route
- Update `vizzy-glasses-webhook` to also accept JWT auth (not just webhook key)

