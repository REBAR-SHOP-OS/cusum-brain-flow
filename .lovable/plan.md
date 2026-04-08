

# Rename Azin → Nila & Remove Non-Interpreter Functionality

## Summary

Nila is ONLY a real-time interpreter (EN↔FA). All "Azin" references must be renamed to "Nila", and the general-purpose voice assistant (NilaVoiceAssistant) that acts as a chatbot must be removed since Nila has no assistant/chat role.

## Changes

### 1. Rename asset file
- Copy `src/assets/helpers/azin-helper.png` → `src/assets/helpers/nila-helper.png`

### 2. Rename component directory & files
- `src/components/azin/` → `src/components/nila-interpreter/`
  - `AzinVoiceOrb.tsx` → `NilaVoiceOrb.tsx` (rename exports)
  - `AzinVoiceChatButton.tsx` → `NilaVoiceChatButton.tsx` (rename exports)
  - `AzinInterpreterVoiceChat.tsx` → `NilaInterpreterVoiceChat.tsx` (rename exports)
  - `LanguageMicButton.tsx` stays as-is (no Azin in name)
  - Update all imports from `azin-helper` → `nila-helper`

### 3. Rename page & route
- `src/pages/AzinInterpreter.tsx` → `src/pages/NilaInterpreter.tsx`
  - Remove NilaVoiceAssistant import and overlay (the chatbot button in bottom bar)
  - Remove `showVoiceChat` state
  - Update all imports to use renamed components
- `src/App.tsx`: route `/azin-interpreter` → `/nila-interpreter`, update import

### 4. Rename hook
- `src/hooks/useAzinVoiceRelay.ts` → `src/hooks/useNilaVoiceRelay.ts`
  - Rename exported function `useAzinVoiceRelay` → `useNilaVoiceRelay`

### 5. Remove general-purpose voice assistant (NOT the interpreter)
These files implement a chatbot/assistant — Nila is only an interpreter:
- **Delete**: `src/components/nila/NilaVoiceAssistant.tsx`
- **Delete**: `src/components/nila/NilaHeader.tsx`
- **Delete**: `src/components/nila/NilaMicButton.tsx`
- **Delete**: `src/components/nila/NilaChatMessages.tsx`
- **Delete**: `src/components/nila/NilaTextInput.tsx`
- **Delete**: `src/components/nila/NilaVoiceSelector.tsx`
- **Delete**: `src/components/nila/NilaWaveVisualizer.tsx`
- **Delete**: `src/hooks/useNilaVoiceAssistant.ts`
- **Delete**: `src/lib/nilaI18n.ts`
- **Delete**: `supabase/functions/nila-chat/index.ts` (edge function)

### 6. Rename edge function
- `supabase/functions/elevenlabs-azin-token/` → rename functionName in code to `elevenlabs-nila-token`

### 7. Update references across codebase
- `src/components/agent/agentConfigs.ts`: key `azin` → `nila`, import `nilaHelper`, `agentType: "nila"`
- `src/pages/Home.tsx`: id `azin` → `nila`, import `nilaHelper`, route → `/nila-interpreter`
- `src/lib/agent.ts`: `AgentType` union — replace `"azin"` with `"nila"`

### 8. Remove unused chatbot avatar button from interpreter
- In the new `NilaInterpreter.tsx`, remove the center avatar button that opened the voice assistant overlay — keep only the EN mic and FA mic buttons in the bottom bar

| Area | Change |
|------|--------|
| Asset | Rename `azin-helper.png` → `nila-helper.png` |
| Components | `src/components/azin/` → `src/components/nila-interpreter/`, rename all Azin→Nila |
| Page | `AzinInterpreter.tsx` → `NilaInterpreter.tsx`, remove assistant overlay |
| Hook | `useAzinVoiceRelay` → `useNilaVoiceRelay` |
| Route | `/azin-interpreter` → `/nila-interpreter` |
| Agent config | Key `azin` → `nila` everywhere |
| Delete | All 7 `src/components/nila/` files, `useNilaVoiceAssistant.ts`, `nilaI18n.ts`, `nila-chat` edge function |
| Edge function | Rename `elevenlabs-azin-token` → `elevenlabs-nila-token` |

