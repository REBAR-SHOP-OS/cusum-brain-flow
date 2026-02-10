

## AI Meeting OS -- MVP Implementation Plan

This transforms the existing meeting system into a full AI-powered meeting OS where meetings automatically produce transcripts, notes, action items, and CEO reports.

---

### What Already Exists

- Jitsi/RingCentral video meetings via MeetingRoom component
- `summarize-meeting` edge function (post-meeting AI summary using Gemini)
- `useSpeechRecognition.ts` hook (browser Web Speech API)
- `translate-message` edge function for real-time translation
- `team_meetings` table with `ai_summary`, `participants`, `duration_seconds`
- `knowledge` table (Brain) for storing meeting notes

### What This Plan Adds

1. **Live transcription** during meetings with speaker attribution
2. **Live AI notes panel** (key points, decisions, actions -- updated in real time)
3. **Audio recording** via MediaRecorder API
4. **Enhanced post-meeting AI processing** (structured CEO report, auto-task creation)
5. **CEO Meeting Dashboard** (decisions, action items, patterns over time)
6. **External guest support** (join via link without account)

---

### Phase 1: Database Changes

**Extend `team_meetings` table:**
- `recording_url` (text, nullable) -- path to recorded audio in storage
- `transcript` (jsonb, nullable) -- array of `{ speaker, text, timestamp }` entries
- `structured_report` (jsonb, nullable) -- CEO report data (summary, decisions, actions, risks)
- `is_external` (boolean, default false) -- whether external guests were invited
- `share_settings` (jsonb, default '{}') -- who gets what level of report

**New table: `meeting_action_items`**
- `id` (uuid), `meeting_id` (FK team_meetings), `title` (text)
- `assignee_name` (text) -- extracted from transcript (may not match a profile)
- `assignee_profile_id` (uuid, nullable, FK profiles) -- matched if possible
- `due_date` (date, nullable), `priority` (text: low/medium/high)
- `status` (text: draft/approved/completed, default 'draft')
- `confidence` (numeric) -- AI confidence in extraction
- `company_id` (uuid), `created_at`
- RLS: company admins read/write, assignees read own

**New table: `meeting_transcript_entries`**
- `id` (uuid), `meeting_id` (FK team_meetings)
- `speaker_name` (text), `speaker_profile_id` (uuid, nullable)
- `text` (text), `timestamp_ms` (integer) -- ms from meeting start
- `is_final` (boolean, default true)
- `language` (text, default 'en')
- `created_at`
- RLS: company members can read meetings in their channels

**New storage bucket: `meeting-recordings`**
- Private bucket for audio recordings
- Organized as `meeting-recordings/{meeting_id}/audio.webm`

Enable realtime on `meeting_transcript_entries` for live transcript updates.

---

### Phase 2: Live Transcription System

**New hook: `src/hooks/useMeetingTranscription.ts`**

Uses the existing browser Speech Recognition API (`useSpeechRecognition` pattern) but enhanced for meetings:
- Starts when meeting begins, stops when meeting ends
- Each finalized transcript segment is inserted into `meeting_transcript_entries` in real time
- Speaker is attributed as the current user (since browser STT only captures the local mic)
- Other participants' browsers also run transcription, so all speakers get captured
- Realtime subscription shows all participants' transcript entries in the live panel

**New hook: `src/hooks/useMeetingRecorder.ts`**

Uses browser MediaRecorder API:
- Captures audio from the user's microphone stream
- Records as WebM/Opus (small, good quality)
- On meeting end, uploads to `meeting-recordings` storage bucket
- Only the meeting creator records (to avoid duplicates)

---

### Phase 3: Live AI Notes Panel

**New component: `src/components/teamhub/MeetingNotesPanel.tsx`**

A collapsible side panel shown during active meetings:
- Subscribes to `meeting_transcript_entries` in real time
- Every 60 seconds (or every 10 new transcript entries), sends accumulated transcript to an edge function for live analysis
- Displays AI-generated:
  - Key Points (bullet list, updates as meeting progresses)
  - Decisions (highlighted in green)
  - Action Items (with inferred assignee)
  - Questions / Open Items
- Private to the meeting host by default, can be shared
- Shows a live scrolling transcript at the bottom

**New edge function: `supabase/functions/meeting-live-notes/index.ts`**

Called periodically during the meeting with the latest transcript chunk:
- Uses `google/gemini-3-flash-preview` for speed
- Receives full transcript so far + previous notes
- Returns updated structured notes (incremental, not from scratch)
- Lightweight -- designed to be called frequently without high cost

---

### Phase 4: Enhanced Post-Meeting Processing

**Rewrite: `supabase/functions/summarize-meeting/index.ts`**

The existing function gets a major upgrade. When a meeting ends:

1. Fetch all `meeting_transcript_entries` for the meeting (not just chat messages)
2. Fetch the audio recording URL if available
3. Generate a comprehensive structured report using `google/gemini-2.5-flash`:
   - Executive Summary (5-8 bullets max)
   - Decisions Made (with context)
   - Action Items (task, owner, due date, priority, confidence)
   - Open Risks / Blockers
   - Follow-ups Required
   - Participant Contributions (who said what, talk time %)
4. Auto-create entries in `meeting_action_items` table (status: 'draft')
5. Store structured report in `team_meetings.structured_report`
6. Save to Brain (`knowledge` table) with rich metadata
7. Return the formatted CEO report

---

### Phase 5: UI Changes

**Modified: `src/components/teamhub/MeetingRoom.tsx`**

Add to the meeting interface:
- "Record" toggle button (red dot when active)
- "AI Notes" toggle button to show/hide the notes panel
- Live transcript bar at the bottom (showing last 2-3 lines of speech)
- "Transcription active" indicator

**New component: `src/components/teamhub/MeetingNotesPanel.tsx`**
- Split view: AI Notes (top) + Live Transcript (bottom)
- AI notes auto-update every 60s
- Transcript shows speaker name + text with timestamps
- Collapsible, slides in from the right

**New component: `src/components/teamhub/MeetingReportDialog.tsx`**

Shown after meeting ends (or accessible from meeting history):
- Formatted CEO report with sections
- Action items list with approve/edit/dismiss buttons
- "Share Report" button with role-based presets:
  - CEO: full report
  - Managers: decisions + actions
  - Team: summary only
- Export: PDF / Email / Copy link
- Edit capability before sharing (CEO can redact)

**New component: `src/components/teamhub/MeetingTranscriptView.tsx`**

Full transcript viewer:
- Speaker-attributed entries with timestamps
- Click timestamp to reference the recording position
- Filter by speaker
- Search within transcript

**Modified: `src/pages/TeamHub.tsx`**

- After meeting ends, show the MeetingReportDialog automatically
- Add "Meeting History" section in channel sidebar showing past meetings with AI summaries
- Badge on meetings that have unreviewed action items

---

### Phase 6: CEO Meeting Dashboard

**New component: `src/components/ceo/MeetingIntelligence.tsx`**

Added to the existing CEO Dashboard:
- This Week's Meetings: count, total hours, key decisions
- Unreviewed Action Items: from all meetings, filterable
- Decision Tracker: all decisions made across meetings this month
- Pattern Detection: "Recurring topic: production delays mentioned in 3/5 meetings"
- One-click approve all draft action items

---

### External Guest Support

For meetings with external participants:
- Meeting creator can toggle "Allow external guests" when starting
- Generates a shareable join link (Jitsi URL -- already works without auth)
- External guests appear in transcript as "Guest" or by name if provided
- External guests do NOT get access to AI notes or reports
- Reports can be sanitized before sharing externally

---

### File Summary

| Action | File |
|--------|------|
| Migration | Extend `team_meetings`, new tables `meeting_action_items` + `meeting_transcript_entries`, storage bucket |
| New hook | `src/hooks/useMeetingTranscription.ts` |
| New hook | `src/hooks/useMeetingRecorder.ts` |
| New edge fn | `supabase/functions/meeting-live-notes/index.ts` |
| Rewrite edge fn | `supabase/functions/summarize-meeting/index.ts` |
| New component | `src/components/teamhub/MeetingNotesPanel.tsx` |
| New component | `src/components/teamhub/MeetingReportDialog.tsx` |
| New component | `src/components/teamhub/MeetingTranscriptView.tsx` |
| New component | `src/components/ceo/MeetingIntelligence.tsx` |
| Modified | `src/components/teamhub/MeetingRoom.tsx` (add record/notes/transcript controls) |
| Modified | `src/pages/TeamHub.tsx` (post-meeting report flow, meeting history) |
| Modified | `src/components/teamhub/StartMeetingDialog.tsx` (external guest toggle) |
| Config | `supabase/config.toml` (add meeting-live-notes) |

---

### Technical Approach

**Live Transcription**: Uses the browser's built-in Web Speech API (already proven in `useSpeechRecognition.ts`). Each participant's browser captures their own speech, inserts into `meeting_transcript_entries`, and all participants see the combined transcript via Supabase Realtime. This avoids needing external STT services.

**Audio Recording**: Uses browser MediaRecorder API to capture the local audio stream. Only the meeting creator records to avoid duplicate storage. Stored as WebM in a private storage bucket.

**AI Processing**: All AI calls go through Lovable AI gateway (Gemini models). Live notes use `gemini-3-flash-preview` for speed. Post-meeting summary uses `gemini-2.5-flash` for quality. No external API keys needed.

**Action Item Auto-Creation**: AI extracts tasks with assignee names, matches against `profiles` table where possible, creates as `draft` status. Managers review and approve before they become official tasks.

---

### Design Principles

- AI never decides -- everything is draft, human approves
- Raw transcript data is preserved and never modified
- Meeting recordings are private and encrypted at rest
- External guests cannot see AI analysis
- CEO gets the richest view; reports are role-filtered for others
- Follows existing TeamHub visual style (dark theme, clean panels)
- Browser-native APIs first (no external service dependencies for MVP)

