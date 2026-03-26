

# Add Looping Background Video to Ad Director

## What
The uploaded video (`Series_of_pictures_202603261228.mp4`) should play continuously as a muted, looping background behind the Ad Director idle screen. The content (title, prompt bar, history) overlays on top of it.

## Changes

### 1. Copy uploaded video to project
Copy `user-uploads://Series_of_pictures_202603261228.mp4` to `public/videos/ad-director-bg.mp4`.

### 2. `src/components/ad-director/AdDirectorContent.tsx`

In the idle state (after intro ends, lines 380-398), wrap the content in a relative container and add a `<video>` element behind everything:

- Add a `fixed inset-0 z-0` video element with `autoPlay loop muted playsInline` and `object-cover`
- Add a dark overlay (`bg-black/50`) on top of the video for readability
- Place existing content (title, prompt bar, history) in a `relative z-10` container

The background video plays on ALL states (idle, analyzing, generating, result) — always visible behind everything. It stays muted and loops infinitely.

### Structure
```text
┌─────────────────────────────┐
│  <video> bg (fixed, loop)   │  ← z-0
│  ┌───────────────────────┐  │
│  │  dark overlay bg/50   │  │  ← z-[1]
│  │  ┌─────────────────┐  │  │
│  │  │  actual content  │  │  │  ← z-10
│  │  └─────────────────┘  │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

| File | Change |
|---|---|
| `public/videos/ad-director-bg.mp4` | Copy uploaded video |
| `AdDirectorContent.tsx` | Add looping background video behind all content |

