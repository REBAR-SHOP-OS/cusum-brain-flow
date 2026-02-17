

# Add File Upload (Paperclip) to All Agents

## Audit Results

| Agent | Location | Has Upload? | Issue |
|-------|----------|-------------|-------|
| Sales, Support, Collections, Social, Copywriting, etc. | AgentWorkspace.tsx | Partial | ChatInput shows paperclip but files are NEVER passed to the AI -- they get uploaded to storage then silently dropped |
| Penny (Accounting) | AccountingAgent.tsx | No | Uses raw textarea, no file upload at all |
| Jarvis (Website) | WebsiteChat.tsx | Yes | Working correctly |
| Architect (Empire) | EmpireBuilder.tsx | Yes | Working correctly |
| Cal (Estimation) | CalChatInterface.tsx | Yes | Working correctly |
| Inbox | Inbox.tsx | Yes | Working correctly |

## Two Fixes Required

### Fix 1: AgentWorkspace -- Wire uploaded files to the AI (all 10+ agents)

Currently `handleSend` ignores the `files` parameter from `ChatInput.onSend`. Files are uploaded to storage but never sent to the AI agent.

**File: `src/pages/AgentWorkspace.tsx`**

- Update `handleSend` to accept the optional `UploadedFile[]` parameter
- Update `handleSendInternal` to accept and forward `attachedFiles`
- Pass `attachedFiles` to `sendAgentMessage()` instead of `undefined`

This single fix enables file upload for: Sales, Support, Collections, Social, Copywriting, SEO, Growth, Legal, BizDev, Eisenhower, Talent, Shopfloor, Delivery, Email, Data, Commander agents.

### Fix 2: AccountingAgent (Penny) -- Add paperclip file upload

**File: `src/components/accounting/AccountingAgent.tsx`**

- Add `Paperclip` icon import from lucide-react
- Add file input ref, attachments state, and upload logic (same pattern as WebsiteChat)
- Add paperclip button next to the textarea
- Add attachment preview strip above the input
- Wire uploaded file URLs into `sendAgentMessage()` calls as `attachedFiles`
- Support paste-to-attach for images

## Technical Details

### AgentWorkspace Change

```typescript
// Before
const handleSend = useCallback((content: string) => {
    handleSendInternal(content);
}, [handleSendInternal]);

// After
const handleSend = useCallback((content: string, files?: UploadedFile[]) => {
    handleSendInternal(content, undefined, files);
}, [handleSendInternal]);
```

```typescript
// Before (in handleSendInternal)
const response = await sendAgentMessage(config.agentType, content, history, extraContext, undefined, slotOverride);

// After
const attachedFiles = files?.map(f => ({ name: f.name, url: f.url }));
const response = await sendAgentMessage(config.agentType, content, history, extraContext, attachedFiles, slotOverride);
```

### AccountingAgent Change
- Add hidden file input accepting images, PDFs, ZIPs
- Add Paperclip button before the textarea
- Add attachment preview row with remove buttons
- Upload files to `clearance-photos/chat-uploads/` bucket (same as WebsiteChat)
- Forward file URLs as `attachedFiles` in all `sendAgentMessage("accounting", ...)` calls

## Files Changed

| File | Change |
|------|--------|
| `src/pages/AgentWorkspace.tsx` | Wire files from ChatInput through to sendAgentMessage |
| `src/components/accounting/AccountingAgent.tsx` | Add full paperclip upload UI + wire files to AI |

