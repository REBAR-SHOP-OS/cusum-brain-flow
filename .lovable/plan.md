

# Switch Music Generation from ElevenLabs to Google Lyria 3

## Problem
The music generation button (🎵 icon) currently calls ElevenLabs API. User wants it to use Google's **Lyria 3** model via the Lovable AI gateway instead.

## Solution

### 1. New Edge Function: `supabase/functions/lyria-music/index.ts`
Create a new edge function that calls the Lovable AI gateway with the music generation model (`google/lyria`). The gateway endpoint supports music generation similar to image generation — send a text prompt, receive audio back.

However, Lyria 3 is **not** in the list of supported Lovable AI gateway models. The supported models are Gemini and GPT variants. Lyria 3 is a separate Google DeepMind model for music and is not available through the `ai.gateway.lovable.dev` endpoint.

**Alternative approach**: Use the **Gemini image generation model** pattern but for music — but Gemini models don't generate audio/music.

### Revised Approach
Since Lyria 3 is not available through the Lovable AI gateway, we have two options:

1. **Keep ElevenLabs** for music generation (it works and is already connected)
2. **Use Gemini to enhance the prompt**, then still use ElevenLabs for actual audio generation

Let me verify: does the user specifically want Lyria 3, or do they want the music icon to work properly?

## Clarification Needed
Lyria 3 is not available as a supported model in the Lovable AI gateway. The available models are text/image models (Gemini, GPT). Music generation requires either ElevenLabs (already connected) or a direct Google API key for Lyria 3.

**I need to ask the user which path to take.**

