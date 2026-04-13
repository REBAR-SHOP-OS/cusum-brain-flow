

# Eisenhower Agent: Merge Messages + Lock Input Until Date Selected

## What Changes

### 1. Merge welcome message + calendar into one message
Currently: Two separate elements — a welcome text bubble ("Hello! Please select your target date...") and then a separate `InlineDatePicker` component below the chat. 

**Fix**: Remove the separate welcome message. Instead, embed the `InlineDatePicker` directly inside the first agent message bubble so the greeting + calendar appear as one unified block.

### 2. Disable chat input until date is selected
Currently: The text input is always enabled. The user can type before selecting a date, which breaks the flow.

**Fix**: In `AgentWorkspace.tsx`, disable the `ChatInput` when `agentId === "eisenhower"` and no `selectedDate` is set yet. Add a placeholder like "Please select a date first..." when disabled.

### 3. Language behavior (already mostly correct — minor reinforcement)
The system prompt already says to respond in the user's language. The welcome message should also follow this (but since it's hardcoded in the frontend, we'll keep it in English as a neutral default — the AI will adapt after the first user message).

### 4. After date selection, prompt for both completed + planned tasks
The current date-selected message already says "list tasks you've completed and tasks you plan to do" — this is correct. No change needed in the prompt.

## Files to Edit

| File | Change |
|------|--------|
| `src/pages/AgentWorkspace.tsx` | 1) Change welcome message to include calendar instruction inline. 2) Move `InlineDatePicker` inside the chat thread area as part of the first message. 3) Disable `ChatInput` when eisenhower + no date selected. |
| `src/components/chat/ChatThread.tsx` | Add support for rendering an inline calendar widget within a message (or render it right after the welcome message in the thread). |

## Technical Details

**AgentWorkspace.tsx changes:**
- `autoStartEisenhower`: Change welcome content to a single combined message like "Hello! 👋 Select your target date to get started:"
- Move `InlineDatePicker` to render right after the welcome message inside the scroll area (not as a separate block after `ChatThread`)
- `ChatInput` disabled prop: `disabled={isLoading || (agentId === "eisenhower" && !selectedDate)}`
- ChatInput placeholder when locked: `"Select a date to start..."` instead of default

**No backend changes needed** — the system prompt already handles language detection and English-only final reports correctly.

