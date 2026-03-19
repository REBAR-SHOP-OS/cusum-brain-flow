

# Fix: FloatingVizzyButton Avatar Display

## Problem
The floating Vizzy button (bottom-right orbital button) displays the avatar with excessive zoom (`scale(1.8)`) and offset positioning (`objectPosition: "center 38%"`), making the agent's face look cropped/distorted.

## Change

### File: `src/components/vizzy/FloatingVizzyButton.tsx`

Remove the aggressive `transform: scale(1.8)` and `objectPosition` from the avatar `<img>` tag (line 180). Replace with a natural fit:

```tsx
<img
  src={vizzyAvatar}
  alt="Vizzy AI"
  className="w-full h-full object-cover pointer-events-none"
  draggable={false}
/>
```

This will display the full agent avatar naturally within the circular button without distortion.

