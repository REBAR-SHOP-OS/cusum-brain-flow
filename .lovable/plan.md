
# Notification Sound: Mockingjay Whistle

## What This Does

Every time a new notification arrives in real-time, the app will play the iconic Mockingjay 4-note whistle from The Hunger Games. No more silent notifications -- you'll hear it instantly.

## Implementation

### 1. Generate the Mockingjay whistle sound effect

Use the ElevenLabs Sound Effects API (already integrated) via a new backend function to generate a short Mockingjay-style whistle and save it as a static audio file in `public/sounds/`.

Alternatively, since this is a one-time asset, we can create a simple synthesized version using the Web Audio API (4 ascending/descending notes mimicking the whistle) -- no external dependency needed and it works offline.

**Recommended approach**: Use the Web Audio API to synthesize the 4-note Mockingjay whistle directly in the browser. This is lightweight, instant, and doesn't require any API calls or audio files.

### 2. Create a sound utility: `src/lib/notificationSound.ts`

A small module that synthesizes the iconic 4-note whistle pattern using the Web Audio API:
- Note 1: G5 (short)
- Note 2: B5 (short) 
- Note 3: A5 (longer, slight vibrato)
- Note 4: D5 (descending, fade out)

The function creates an `AudioContext`, schedules the 4 sine-wave tones with smooth transitions, and plays them in sequence (~1.5 seconds total).

### 3. Hook into real-time notifications: `src/hooks/useNotifications.ts`

In the existing realtime subscription (line 118), when `payload.eventType === "INSERT"`, call the whistle sound function. This means every new notification -- whether from timeclock alerts, agent suggestions, or anything else -- triggers the Mockingjay whistle.

A simple guard ensures the sound only plays once per notification and respects browser autoplay policies (sound activates after the user's first interaction with the page).

## Technical Details

| Item | Detail |
|------|--------|
| New file | `src/lib/notificationSound.ts` |
| Modified file | `src/hooks/useNotifications.ts` (add sound trigger on INSERT) |
| Dependencies | None -- uses built-in Web Audio API |
| Sound duration | ~1.5 seconds |
| Browser support | All modern browsers |
