

# Enable File Attachment for All AI Agents

## Problem
File upload is currently restricted to only the Estimating and Social agents in `AgentWorkspace.tsx`. The condition `agentId === "estimating" || agentId === "social"` prevents other agents from showing the attachment button.

## Fix

### File: `src/pages/AgentWorkspace.tsx`

Change `showFileUpload` from the conditional check to `true` in both places where `ChatInput` is rendered (lines 392 and 416):

```
// Before:
showFileUpload={agentId === "estimating" || agentId === "social"}

// After:
showFileUpload={true}
```

This is a two-line change (the prop appears twice due to a responsive/conditional render). No other files need changes — the `ChatInput` component, file upload logic, and the `ai-agent` edge function already support file attachments for any agent.

## Scope
- One file modified: `src/pages/AgentWorkspace.tsx` (2 lines)
- No backend changes needed

