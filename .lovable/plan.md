

## Plan: Background Agent Task Persistence

### Problem
When a user sends a command to an agent (e.g., "create a quote") and navigates away (e.g., goes to Home), the in-flight request completes but the response is lost because `setMessages` runs on an unmounted component. The agent's work is wasted.

### Solution
Create a singleton **BackgroundAgentService** that outlives component lifecycles. When a request is in-flight and the user navigates away, the service saves the agent's response directly to the database. When the user returns, it loads from the persisted session.

### Changes

**1. New file: `src/lib/backgroundAgentService.ts`**
- Singleton class with a `Map<string, Promise>` tracking in-flight requests
- `enqueue(sessionId, agentType, message, history, ...)` — wraps `sendAgentMessage`, saves response to `chat_messages` via Supabase even if the UI component is gone
- `isProcessing(sessionId)` — check if a session has pending work
- `getResult(sessionId)` — retrieve completed-but-undelivered results
- Uses `addMessage` logic (direct Supabase insert) independent of React state

**2. Update: `src/pages/AgentWorkspace.tsx`**
- Import and use `backgroundAgentService.enqueue()` instead of calling `sendAgentMessage` directly
- On mount, check if there's a pending/completed background result for the active session and hydrate messages
- On unmount, in-flight requests continue in the background service

**3. Update: `src/pages/EmpireBuilder.tsx`**
- Same pattern: route sends through background service

**4. Update: `src/components/accounting/AccountingAgent.tsx`**
- Same pattern for Penny agent

**5. Update: `src/components/chat/CalChatInterface.tsx`**
- Same pattern for Cal agent

### Technical Details
- The background service is a plain TypeScript singleton (not React) so it survives navigation
- It writes directly to `chat_sessions` / `chat_messages` tables using the Supabase client
- When the component remounts and loads session messages from DB, the agent response is already there
- A small toast notification ("Blitz is still working...") shows if the user returns while a request is still in-flight
- No changes to the edge function or database schema needed

