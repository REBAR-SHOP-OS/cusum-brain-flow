

# Use Uploaded Mockingjay MP3 for Notification Sound

## Overview
Replace the current synthesized Web Audio API whistle with the uploaded `mockingjay.mp3` file for notification sounds.

## Changes

### 1. Copy the MP3 file to the public folder
- Copy `user-uploads://mockingjay.mp3` to `public/mockingjay.mp3`
- Using `public/` because the service worker (`sw-push.js`) also needs access to it, and service workers cannot use bundled imports

### 2. Update `src/lib/notificationSound.ts`
- Replace the entire Web Audio API synthesis with a simple `Audio` playback:
  ```typescript
  export function playMockingjayWhistle(): void {
    try {
      const audio = new Audio("/mockingjay.mp3");
      audio.volume = 0.5;
      audio.play();
    } catch { }
  }
  ```
- This removes ~50 lines of oscillator/gain node code in favor of a clean 5-line implementation

### 3. Update `public/sw-push.js` (optional enhancement)
- No change strictly needed -- the service worker shows OS-native notifications which use the device's default sound
- The MP3 is available at `/mockingjay.mp3` if we want to reference it in the future

## Technical Notes
- The file must go in `public/` (not `src/assets/`) because `new Audio()` needs a URL path, not a bundled module reference
- Browser autoplay policies require a prior user interaction before audio can play; the existing flow (user has the app open and interacting) satisfies this

