

# Fix: Voice Vizzy Action Tags Not Triggering Approval Button

## Problem
When Vizzy speaks via voice (ElevenLabs), she correctly outputs `[VIZZY-ACTION]` tags in her responses. However, the voice chat page (`VizzyPage.tsx`) never parses these tags from the transcript. The action-tag parsing and approval dialog only exist in the text chat page (`AgentWorkspace.tsx`). This is why no approval button ever appears during voice conversations.

## Solution
Add `[VIZZY-ACTION]` tag parsing to the voice chat's `agent_response` handler, and render the `VizzyApprovalDialog` component on the voice page.

## Technical Changes

### File 1: `src/pages/VizzyPage.tsx`

**A. Import the approval dialog and related types** (top of file)

Add imports for `VizzyApprovalDialog`, `PendingAction`, and `supabase` client (if not already imported), plus `toast` from sonner.

**B. Add state for pending actions**

```typescript
const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
```

**C. Parse action tags in the `agent_response` handler** (around line 245-258)

When the agent responds, check the text for `[VIZZY-ACTION]...[/VIZZY-ACTION]`. If found:
1. Parse the JSON inside the tags
2. Create a `PendingAction` with an `approve/deny` callback
3. Set it in state so the approval dialog appears
4. Strip the action tag from the displayed transcript text

The approve callback will call `supabase.functions.invoke("ringcentral-action", { body: actionData })` -- same logic as the text chat version in `AgentWorkspace.tsx`.

**D. Render the `VizzyApprovalDialog`** in the component's JSX

Add `<VizzyApprovalDialog pendingAction={pendingAction} />` to the voice page layout, positioned so it's visible over the voice UI.

### No other files need changes

The edge function (`ringcentral-action`) and the approval dialog component (`VizzyApprovalDialog`) already work correctly. We just need to wire them into the voice page.

## Scope
- 1 file modified: `src/pages/VizzyPage.tsx`
- No backend changes
- No new components needed

