

# Add Clickable Quick-Reply Suggestions to Vizzy

## What You'll Get

After every Vizzy response, you'll see 2-4 tappable suggestion buttons below the message — actionable next steps you can click instead of typing. Vizzy will always offer choices for you to pick from.

## How It Works

### 1. Prompt Update — Tell Vizzy to Always Offer Choices

**File: `supabase/functions/_shared/vizzyIdentity.ts`**

Add to `VIZZY_CORE_IDENTITY` (after the DISCIPLINE section):

```
═══ RESPONSE FORMAT — ALWAYS OFFER CHOICES ═══
At the END of every response, include 2-4 clickable follow-up options using this exact format:
[QUICK_REPLIES]
- Approve and send it
- Show me the details first
- Hold — let me think about it
- What's the risk if we wait?
[/QUICK_REPLIES]

Rules:
- EVERY response must end with [QUICK_REPLIES]
- Options must be specific to the conversation context (not generic)
- Options should represent real next actions the CEO would take
- Keep each option under 8 words
- Include at least one "dig deeper" and one "take action" option
- For diagnosis: offer different investigation paths
- For recommendations: offer approve/reject/modify
- For updates: offer drill-down or move-on options
```

### 2. Parse Suggestions from Vizzy's Response

**File: `src/lib/parseQuickReplies.ts` (NEW)**

A utility that extracts the `[QUICK_REPLIES]...[/QUICK_REPLIES]` block from assistant messages, returning:
- `content`: the message text without the quick replies block
- `replies`: string array of clickable options

### 3. QuickReplies Component

**File: `src/components/chat/QuickReplies.tsx` (NEW)**

Renders suggestion buttons below assistant messages:
- Horizontal flex-wrap of pill buttons
- Styled as outlined pills with primary accent
- On click: calls `sendMessage(reply)` directly
- Only shown on the LAST assistant message (not on historical ones)
- Hidden while streaming

### 4. Wire Into All Vizzy Chat Surfaces

**File: `src/components/layout/IntelligencePanel.tsx`**
- Import `parseQuickReplies` and `QuickReplies`
- Parse last assistant message to extract replies
- Render `QuickReplies` below the last message, wired to `sendMessage`

**File: `src/pages/LiveChat.tsx`**
- Same integration — parse + render quick replies on last assistant message

**File: `src/components/layout/LiveChatWidget.tsx`**
- Same integration

### 5. Voice Addendum Update

**File: `supabase/functions/_shared/vizzyIdentity.ts`**
- Add to `VIZZY_VOICE_ADDENDUM`: "When speaking, always end with 2-3 options: 'You can tell me to [option 1], [option 2], or [option 3].'"

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/_shared/vizzyIdentity.ts` | Add QUICK_REPLIES format instruction to core identity + voice addendum |
| `src/lib/parseQuickReplies.ts` | NEW — parser utility |
| `src/components/chat/QuickReplies.tsx` | NEW — clickable pill buttons component |
| `src/components/layout/IntelligencePanel.tsx` | Wire quick replies |
| `src/pages/LiveChat.tsx` | Wire quick replies |
| `src/components/layout/LiveChatWidget.tsx` | Wire quick replies |

## Impact
- 6 files (2 new, 4 updated)
- Every Vizzy response ends with tappable choices
- CEO can interact by clicking instead of typing
- No database or auth changes

