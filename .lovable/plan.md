

# Fix: Vizzy Avatar Image Has Orbital Rings Baked In

## Root Cause

The orbital rings are **not in the code** — they're embedded in the `vizzy-avatar.png` image itself. The face is tiny in the center of a large dark image with teal circles around it. No amount of code changes will fix this; the image file needs to be replaced.

## Solution

### Step 1: Generate a clean Vizzy face-only avatar

Use the AI image generation API (Nano banana pro) to create a clean, circular-ready avatar of the Vizzy character — just the face/head on a transparent or dark background, no orbital rings or decorations. The character has glasses, reddish-brown hair, and a friendly expression.

### Step 2: Replace the asset

Save the new clean image as `src/assets/vizzy-avatar.png`, replacing the current one.

### Step 3: Adjust FloatingVizzyButton styling

With a clean face image, remove the aggressive `scale(1.25)` and `objectPosition` hacks that were compensating for the rings. The image will naturally fill the 80px circle:

```tsx
<img
  src={vizzyAvatar}
  className="w-full h-full object-cover pointer-events-none"
  draggable={false}
/>
```

No other files need changes — `VizzyVoiceChat.tsx` and other consumers of the same import will also benefit automatically.

