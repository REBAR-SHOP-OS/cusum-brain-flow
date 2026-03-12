

## Integrate Google Cloud Video Intelligence API into Video Studio

The screenshot shows you have Cloud Video Intelligence API enabled with healthy quotas (180s backend time/min, 60 requests/min). This API analyzes videos — it doesn't generate them (Veo handles that). Here's the plan to add analysis capabilities to every generated video.

### What It Enables

After a video is generated, a new **"Analyze"** button appears. Clicking it sends the video to Google's Video Intelligence API and returns:

1. **Labels & Objects** — detected objects, actions, scenes (e.g., "construction site", "welding", "crane")
2. **Content Moderation** — explicit content flags (adult, violence, racy) with confidence levels
3. **Speech Transcription** — auto-generated captions/subtitles from spoken audio
4. **Shot Detection** — scene change timestamps for editing reference
5. **Text Detection (OCR)** — any text visible in the video frames

### Architecture

```text
VideoStudioContent.tsx
  └─ "Analyze" button (after completion)
       └─ POST /video-intelligence edge function
            └─ Google Video Intelligence API (annotateVideo)
                 └─ Returns labels, moderation, transcript, shots, OCR
       └─ VideoInsightsPanel.tsx (renders results)
```

### Implementation

**1. Create edge function `supabase/functions/video-intelligence/index.ts`**
- Accept `videoUrl` and optional `features[]` array (LABEL_DETECTION, EXPLICIT_CONTENT, SPEECH_TRANSCRIPTION, SHOT_CHANGE, TEXT_DETECTION)
- Use `GEMINI_API_KEY` (same Google Cloud key already configured) to call `https://videointelligence.googleapis.com/v1/videos:annotate`
- Submit async annotation job, return operation name
- Support `action: "poll"` to check operation status
- Parse results into structured response: labels, moderation scores, transcript segments, shot boundaries, detected text

**2. Create `src/components/social/VideoInsightsPanel.tsx`**
- Tabbed panel: Labels | Moderation | Captions | Shots | OCR
- Labels: list of detected labels with confidence bars
- Moderation: green/yellow/red status badges per category
- Captions: timestamped transcript lines with copy button
- Shots: timeline markers showing scene changes
- OCR: detected text snippets with frame timestamps

**3. Update `VideoStudioContent.tsx`**
- Add "Analyze Video" button in the completed video section (next to Download/Edit/Share)
- State: `analysisResults`, `analyzing` boolean
- On click: call edge function, poll for results, render `VideoInsightsPanel`
- Auto-generate suggested hashtags from detected labels (feed into social panel)

**4. Auto-moderation gate**
- Before "Share to Social" is enabled, run EXPLICIT_CONTENT check
- If flagged, show warning badge: "⚠️ Content flagged — review before publishing"

### Config

- Add to `supabase/config.toml`:
```toml
[functions.video-intelligence]
verify_jwt = false
```

### Files
- **Create**: `supabase/functions/video-intelligence/index.ts`
- **Create**: `src/components/social/VideoInsightsPanel.tsx`
- **Modify**: `src/components/social/VideoStudioContent.tsx`

No new API keys needed — uses existing `GEMINI_API_KEY`.

