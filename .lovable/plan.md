

## Plan: Fix Edge Function System Message Bug

### Problem
Line 33 of `personaplex-voice/index.ts` extracts the last message with `role === "user" || m.role === "system"` — this means hidden `[TOOL_RESULTS_READY]` system messages get treated as the user's speech input, causing the reconnect loop. The conversation history also includes noisy tool/hidden messages.

The frontend (`useVizzyStreamVoice.ts`) is already correct from the previous patch — no frontend changes needed.

### Changes — `supabase/functions/personaplex-voice/index.ts`

**1. Fix user message extraction (line 33)**
Only find `role === "user"` — never treat system messages as user input:
```typescript
const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
```

**2. Filter conversation history (lines 44-46)**
Remove hidden and tool messages, limit to last 12 for token efficiency:
```typescript
const conversationHistory = messages
  .filter((m: any) => m.content && !m.content.startsWith("[TOOL_") && !m.hidden)
  .slice(-12)
  .map((m: any) => `${m.role}: ${m.content}`)
  .join("\n");
```

**3. Add debug log (after line 62)**
```typescript
console.log("[personaplex-voice]", {
  hasSystemPrompt: !!systemPrompt,
  messageCount: messages.length,
  textLength: text.length,
});
```

### What Does NOT Change
- Frontend code (already patched)
- Audio playback logic
- Vizzy One API endpoints
- Auth mode, CORS

### Result
System/tool messages no longer hijack the user text field. Conversation history is clean. The reconnect loop caused by `[TOOL_RESULTS_READY]` being sent as user speech is eliminated.

