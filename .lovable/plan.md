

## Plan: Create AZIN — Real-Time Interpreter Agent (EN ↔ FA)

### What
A new agent called **AZIN** that provides real-time bidirectional interpretation: listens via microphone, detects the language (English or Farsi), and displays the translation in the opposite language. No chat — purely a mic-based live interpreter.

### Changes

**1. Add AZIN agent image**
- Copy the uploaded image to `src/assets/helpers/azin-helper.png`

**2. Create `src/pages/AzinInterpreter.tsx`** — Dedicated interpreter page
- Full-screen interpreter UI with a large mic button
- Uses existing `useRealtimeTranscribe` hook (ElevenLabs Scribe v2 realtime)
- Displays two columns: **English** (left) and **فارسی** (right)
- Each committed transcript shows the detected language on one side and translation on the other
- Reuses existing `translate-message` edge function with `targetLangs: ["en", "fa"]`
- Clean, focused UI — no chat input, no agent selector
- Clear/reset button, connection status indicator

**3. Update `src/components/agent/agentConfigs.ts`**
- Add `azin` config entry with name "AZIN", role "Real-Time Interpreter", agentType "azin"

**4. Update `src/lib/agent.ts`**
- Add `"azin"` to the `AgentType` union

**5. Update `src/pages/Home.tsx`**
- Add AZIN to the `helpers` array with route `/azin-interpreter`

**6. Update `src/App.tsx`**
- Add route: `/azin-interpreter` → `AzinInterpreter` page

### UI Design
- Large centered microphone button with pulse animation when active
- Split-screen layout: English translations on left, Farsi on right
- Each entry shows timestamp + text, with the original on one side and translation on the other
- Status bar showing "Listening...", "Connecting...", or "Ready"
- Trash button to clear history

### No backend changes needed
- Reuses existing `elevenlabs-scribe-token` edge function for mic connection
- Reuses existing `translate-message` edge function for EN↔FA translation

### Files to create/modify
- **Copy**: uploaded image → `src/assets/helpers/azin-helper.png`
- **Create**: `src/pages/AzinInterpreter.tsx`
- **Edit**: `src/lib/agent.ts` (add type)
- **Edit**: `src/components/agent/agentConfigs.ts` (add config)
- **Edit**: `src/pages/Home.tsx` (add helper card)
- **Edit**: `src/App.tsx` (add route)

