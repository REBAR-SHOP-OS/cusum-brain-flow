

# Show Welcome Video on Ad Director Entry

## What
When a user enters the Ad Director page, display the uploaded intro video (motion graphic) as a welcome/demo reel before they interact with the prompt bar. The video auto-plays muted, and the user can dismiss it or it transitions to the normal idle state after playback ends.

## Changes

### 1. Copy the video asset
Copy `user-uploads://Create_motion_graphic_202603261204_1.mp4` to `public/videos/ad-director-intro.mp4` so it can be referenced via `staticFile` or direct URL.

### 2. `src/components/ad-director/AdDirectorContent.tsx`

In the `flowState === "idle"` block, add a welcome video section above the existing content:

- Add state: `const [showIntro, setShowIntro] = useState(true)`
- When `showIntro` is true and `flowState === "idle"`, render a `<video>` element that:
  - Auto-plays, muted, with controls visible
  - Has a rounded container with subtle styling
  - Shows a "Skip" button overlay (top-right corner)
  - On `onEnded`, sets `showIntro = false`
  - On skip click, sets `showIntro = false`
- When `showIntro` is false, show the normal idle UI (Film icon, prompt bar, history)
- Use `sessionStorage` to only show the intro once per session (check on mount, set flag after first view)

### Layout
```text
┌──────────────────────────────┐
│  [video player - autoplay]   │
│                    [Skip ▸]  │
└──────────────────────────────┘
```
After video ends or skip → normal idle state with prompt bar.

| File | Change |
|---|---|
| `public/videos/ad-director-intro.mp4` | Copy uploaded video |
| `AdDirectorContent.tsx` | Add intro video state + conditional render in idle block, sessionStorage guard |

