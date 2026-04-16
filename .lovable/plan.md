

## Plan: Play Intro Video on AI Video Director Page

### What
When the user clicks the "AI Video Director" card, the uploaded motion graphic video plays as a full-screen intro before showing the Ad Director content.

### Changes

**Step 1: Copy video asset**
- Copy `user-uploads://Create_motion_graphic_202604161038.mp4` to `public/videos/ad-director-intro.mp4`

**Step 2: Modify `src/pages/AdDirector.tsx`**
- Add `showIntro` state (default `true`)
- When `showIntro` is true, render a full-screen `<video>` element that auto-plays the intro video
- On video end (or click to skip), set `showIntro = false` to reveal the normal Ad Director content
- Include a "Skip" button in the corner so users can bypass the intro

### What stays the same
- All Ad Director functionality, editor, chat prompt bar — unchanged
- The home page card and navigation — unchanged
- The intro only plays once per visit (state resets on navigation away)

