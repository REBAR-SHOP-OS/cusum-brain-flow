

## Fix DM Creation and Enhance Team Hub Chat

### Problem 1: DM Creation Fails (RLS on `team_channels`)

The screenshot shows: `"new row violates row-level security policy for table 'team_channels'"`.

The current INSERT policy on `team_channels` checks `company_id = get_user_company_id(auth.uid())`. While this should work for users with profiles, there's a potential timing/caching issue. The fix is to also allow the channel creator (matching `created_by = auth.uid()`) as a fallback, consistent with the `team_channel_members` fix already applied.

**Database migration:**
```sql
DROP POLICY IF EXISTS "Users can create channels in their company" ON public.team_channels;
CREATE POLICY "Users can create channels in their company"
  ON public.team_channels FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
    OR company_id IS NULL
    OR created_by = auth.uid()
  );
```

### Problem 2: Team Hub Chat Missing Features

The Team Hub `MessageThread` composer is a bare textarea with only a Send button. It lacks the emoji, voice input, and file upload features that exist in the AI agent `ChatInput`. The following features will be added to the Team Hub message composer:

---

### Feature A: Emoji Picker

Reuse the existing `EmojiPicker` component (from `src/components/chat/EmojiPicker.tsx`) in the `MessageThread` composer toolbar.

### Feature B: Voice-to-Text Input

Reuse the existing `VoiceInputButton` and `useSpeechRecognition` hook to add a microphone button to the composer. When the user speaks, transcribed text is appended to the message input.

### Feature C: Text-to-Speech (TTS) Playback

Add a small speaker icon on each message bubble. Clicking it calls the ElevenLabs TTS edge function to read the message aloud.

**New edge function:** `supabase/functions/elevenlabs-tts/index.ts` -- a simple proxy that accepts `{ text, voiceId }`, calls the ElevenLabs API, and returns MP3 audio. The `ELEVENLABS_API_KEY` secret is already configured.

### Feature D: File Attachments

Add a paperclip button to the composer for uploading files. Files will be stored in a new storage bucket (`team-chat-files`). The `team_messages` table will get an optional `attachments` JSONB column to store file metadata. Uploaded files will render as clickable links/previews in message bubbles.

---

### Technical Steps

1. **Database migration:**
   - Fix `team_channels` INSERT policy (add `created_by = auth.uid()` fallback)
   - Add `attachments jsonb DEFAULT '[]'` column to `team_messages`
   - Create `team-chat-files` storage bucket with RLS

2. **Create edge function:** `supabase/functions/elevenlabs-tts/index.ts` for TTS playback

3. **Update `MessageThread.tsx`:**
   - Add emoji picker, voice input button, and file upload button to the composer toolbar
   - Add TTS play button on each message
   - Display file attachments in message bubbles
   - Import and use existing `EmojiPicker`, `VoiceInputButton`, `useSpeechRecognition`

4. **Update `GlobalChatPanel.tsx`:**
   - Add emoji picker to the mini chat input for consistency

5. **Update `useTeamChat.ts`:**
   - Include `attachments` field in `TeamMessage` type and `useSendMessage` mutation

