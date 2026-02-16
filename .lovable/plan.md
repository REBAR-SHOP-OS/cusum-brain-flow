

# Skip Pre-Chat Form: Help First, Collect Info Later

## Overview

Remove the name/email form that currently blocks visitors from chatting. Instead, the chat opens directly into a conversation with the AI assistant. Visitor details (name, email) are only collected later when the visitor is ready to get a quote or place an order -- the AI naturally asks for this information at the right moment.

## What Changes

### 1. Remove Pre-Chat Form from Widget (support-chat widget.js)

The generated widget JS currently shows a "Your name / Email / Start Chat" form before any conversation begins. This will be replaced with:

- Widget opens directly into the message view (no form)
- A conversation is auto-started on first open (visitor_name defaults to "Visitor")
- The AI proactive greeting fires immediately, welcoming them based on their current page
- Quick action chips are not affected (they remain in the website-chat-widget, which is separate)

### 2. Update AI System Prompt for Info Collection

Update the AI prompt in `triggerAiReply` to include instructions like:

- "When the visitor is ready to get a quote, place an order, or requests delivery, ask for their name and email so the team can follow up"
- "Do NOT ask for personal info upfront -- help them first, build trust, then collect details when relevant"

### 3. Store Collected Info via AI Tool or Message Parsing

When the visitor provides their name/email during conversation, the agent can update the conversation record. Add a simple approach:

- In `handleSend`, after inserting the visitor message, check if the conversation still has "Visitor" as the name
- The AI will be prompted to ask for details at the right time -- the agent in the support inbox can manually update the visitor name from the conversation

## Technical Details

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/support-chat/index.ts` | Remove pre-chat form from `generateWidgetJs`, auto-start conversation on widget open, update AI prompt for delayed info collection |

### Widget JS Changes (inside `generateWidgetJs`)

1. Remove the `#sw-pre-chat` div entirely (no name/email inputs, no "Start Chat" button)
2. Show `#sw-messages` and `#sw-input-area` immediately
3. On first panel open (bubble click), auto-call `handleStart` with `visitor_name: "Visitor"` and no email
4. The proactive AI greeting fires as before, giving the visitor an immediate welcome

### Updated Conversation Flow

```text
Visitor clicks chat bubble
  --> Panel opens (no form)
  --> Auto-starts conversation (name: "Visitor", no email)
  --> AI greeting appears within 2-3 seconds based on current page
  --> Visitor chats freely
  --> When visitor wants a quote, AI asks: "Happy to help! Could I grab your name and email so we can send that quote over?"
  --> Visitor provides info naturally in conversation
  --> Agent sees details in support inbox and can update the record
```

### AI Prompt Addition (in `triggerAiReply`)

Add to the system prompt:
- "Do NOT ask for the visitor's name or contact details upfront. Help them first with their questions about rebar, pricing, stock, and delivery."
- "When the visitor expresses intent to get a quote, place an order, or arrange delivery, THEN naturally ask for their name and email so the team can follow up."
- "Keep it conversational -- e.g. 'Happy to put that quote together! Could I grab your name and the best email to send it to?'"

### No Database Changes

No migrations needed. The `visitor_name` column already defaults and "Visitor" is an acceptable value.

