

## Plan: Wire Intro & Outro Reference Images Into Video Generation

### Problem
The "Intro reference" and "Outro reference" cards (left + right) currently accept image uploads but the AI doesn't actually use them as the **first frame** and **last frame** of the generated video. They appear cosmetic — the generation ignores them.

User wants: when intro/outro images are uploaded, the video MUST start from the intro image and end on the outro image.

### Investigation Needed
Before finalizing changes, I need to confirm:
1. How `ChatPromptBar` currently passes intro/outro uploads to the generation pipeline
2. Whether the storyboard generator (`ad-director-ai`) accepts `firstFrameUrl` / `lastFrameUrl` per scene
3. Whether the video engine (Wan 2.6 i2v via DashScope) supports first-frame + last-frame conditioning (it does — `wan2.6-i2v` accepts `first_frame_url` and `last_frame_url`)

### Changes (high-level)

**1. `ChatPromptBar` / generation entrypoint**
- When intro reference is set → mark **Scene 1** with `firstFrameUrl = introUrl` and force `generationMode = "image-to-video"`
- When outro reference is set → mark **last scene** with `lastFrameUrl = outroUrl` (and if engine supports both, also `firstFrameUrl` from previous scene's last frame for continuity)
- If a scene already has its own reference asset, intro/outro takes precedence on first/last scene only

**2. Storyboard generation (`ad-director-ai` write-script / generate-storyboard)**
- Pass intro/outro context into the prompt so the AI writes Scene 1 as a natural continuation of the intro image and the final scene as leading into the outro frame
- Add system instruction: "Scene 1 must visually start from the provided intro reference. Final scene must end on the provided outro reference."

**3. Video engine call (DashScope Wan 2.6 i2v)**
- For Scene 1: send `model=wan2.6-i2v`, `first_frame_url=introUrl`, prompt = scene 1 cinematic prompt
- For final scene: send `last_frame_url=outroUrl` (use i2v with last-frame conditioning)
- For middle scenes: unchanged (text-to-video or existing reference-continuation)

**4. UI feedback**
- Add a small badge/indicator on intro & outro cards when set: "Locked to Scene 1" / "Locked to final scene"
- In the storyboard view, show "🎬 Starts from intro reference" on Scene 1 and "🎬 Ends on outro reference" on last scene when applicable

### What stays the same
- All other chips (style, products, duration, ratio) — unchanged
- Character reference (middle card) — unchanged behavior
- AI Prompt dialog — unchanged
- Middle scenes generation — unchanged

### Investigation Step Before Coding
I'll first read these files to confirm exact wiring points:
- `src/components/ad-director/ChatPromptBar.tsx` — find where intro/outro state lives
- `src/components/ad-director/AdDirectorContent.tsx` — find generation orchestration
- `supabase/functions/ad-director-ai/index.ts` — find storyboard generation logic
- The DashScope i2v call site (likely `supabase/functions/dashscope-video/index.ts` or similar)

Then apply minimal, surgical edits per the Surgical Execution Law (additive only, no refactoring of stable architecture).

### Result
Upload intro image → Scene 1 is generated **starting from that exact frame**.
Upload outro image → Final scene **ends on that exact frame**.
The generated video genuinely opens and closes on the user's chosen frames — not just "uses them as inspiration."

