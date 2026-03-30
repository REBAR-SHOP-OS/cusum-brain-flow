

# Generate Video Editor Architecture PDF

## Overview
Generate a comprehensive Persian/English bilingual PDF documenting the full architecture of the REBAR SHOP OS Video Editor (Ad Director), covering all layers from data types to UI components, background services, edge functions, and the timeline system.

## Approach
Use ReportLab to generate a professional PDF with:
- Cover page with project branding
- Table of contents
- Architecture diagrams (text-based)
- Component hierarchy
- Data flow documentation
- Type definitions
- Edge function documentation
- Timeline system details

## Content Sections

1. **Cover Page** — "AI Video Editor — Architecture Document"
2. **System Overview** — High-level flow: User prompt → Script analysis → Storyboard → Video generation → Editor
3. **Component Hierarchy** — Full tree of React components (AdDirectorContent → ProVideoEditor → TimelineBar, dialogs, tabs)
4. **Data Model** — All TypeScript types (BrandProfile, ScriptSegment, StoryboardScene, ClipOutput, VideoOverlay, AudioTrackItem, etc.)
5. **State Management** — ProVideoEditor's 40+ state variables, refs, and memoized values
6. **Timeline Architecture** — TimelineBar internals (rAF playhead, ruler ticks, snap system, transport bar, zoom, drag system)
7. **Background Service** — BackgroundAdDirectorService singleton lifecycle
8. **Audio/Voiceover Pipeline** — TTS generation, two-pass fitting, sync with video
9. **Video Generation Pipeline** — Edge function generate-video (Wan/Sora/Veo routing with fallbacks)
10. **Video Stitching** — Client-side canvas-based stitching with overlays
11. **Overlay System** — Logo, text, image overlays with drag/resize
12. **Editor Tabs** — All sidebar panels (Media, Text, Music, BrandKit, Script, Card Editor, etc.)

## Technical
- Python script using ReportLab
- Output to `/mnt/documents/Video_Editor_Architecture.pdf`
- Professional dark-themed cover, clean body layout
- QA via pdftoppm inspection

