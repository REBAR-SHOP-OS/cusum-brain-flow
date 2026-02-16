
# Proactive AI Greeting, Sales Notifications, and Assign-to-All-Users

## Overview

Three upgrades to the support chat system:

1. **Proactive AI greeting**: When a visitor lands on the website and opens the chat, the AI automatically sends a contextual welcome message based on the page they are viewing (e.g., "I see you're looking at N16 Deformed Bar -- would you like a quote?"). This replaces the static welcome text.

2. **Sales team notifications**: When a new visitor starts a chat, all sales team members receive a push notification ("New visitor on rebar.shop from Sydney -- viewing N16 Deformed Bar"). This ensures someone picks up the conversation quickly.

3. **Assign to any user**: The "Assign to me" button is replaced with a dropdown that lists all team members so you can assign conversations to anyone, not just yourself.

## What Changes

### 1. Proactive AI Welcome (Both Widgets)

**support-chat edge function** (`handleStart`):
- After creating the conversation, fire off an AI greeting using the same `triggerAiReply` logic but with a special "proactive greeting" prompt
- The AI sees the visitor's `current_page` and crafts a personalised welcome (e.g., "I see you're browsing our mesh products -- need help choosing the right size?")
- If the visitor is on a product page, the AI references that product specifically
- This message appears as a `bot` message immediately after "Conversation started"

**website-chat-widget** (`website-agent`):
- Update the widget JS so when the chat panel opens for the first time (no messages yet), it automatically sends a silent "init" message with the current page
- The website-agent responds with a contextual greeting instead of the generic welcome text

### 2. Notify Sales Team on New Visitor

**support-chat edge function** (`handleStart`):
- After creating the conversation, insert a notification into the `notifications` table for each sales-relevant team member
- The notification title: "New Website Visitor"
- The description includes visitor name, city, and current page
- The `link_to` points to `/support-inbox` so they can jump straight in
- This triggers the existing `push-on-notify` edge function which sends browser push alerts with sound

**Who gets notified**: All profiles with a matching `company_id` (the entire team gets the alert so whoever is available can respond)

### 3. Assign Dropdown with All Users

**SupportChatView.tsx**:
- Replace the "Assign to me" button with a dropdown (`Select`) listing all team members from `profiles`
- Show each person's name in the dropdown
- When selected, update `assigned_to` on the conversation
- The current assignee is shown as the selected value

### 4. AI Handoff to Human

When the AI detects the visitor wants to talk to a real person, it should:
- Respond warmly: "Let me connect you with one of our team members"
- The system already supports this since agents can jump in at any time
- Update the system prompt to instruct the AI: "If the visitor asks to speak with a person, let them know a team member will be with them shortly and that you've notified the sales team"

## Technical Details

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/support-chat/index.ts` | Add proactive AI greeting in `handleStart`, add sales team notifications, update AI prompt for handoff |
| `supabase/functions/website-chat-widget/index.ts` | Auto-send init message on panel open for contextual AI greeting |
| `supabase/functions/website-agent/index.ts` | Handle init/greeting message, update system prompt for handoff behaviour |
| `src/components/support/SupportChatView.tsx` | Replace "Assign to me" with full team member dropdown |

### Proactive Greeting Flow (support-chat widget)

```text
Visitor opens widget --> enters name --> clicks "Start Chat"
  --> handleStart creates conversation
  --> Inserts "Conversation started" system message
  --> Fires proactive AI greeting (bot sees current_page, crafts welcome)
  --> Inserts notification for all team members
  --> Bot greeting appears in widget within 2-3 seconds
```

### Proactive Greeting Flow (website-agent widget / rebar.shop)

```text
Visitor clicks chat bubble (no pre-chat form)
  --> Widget auto-sends { messages: [{role:"user", content:"[INIT]"}], current_page: "..." }
  --> website-agent detects [INIT], responds with page-contextual greeting
  --> Greeting streams into widget immediately
```

### Notification Insert (in handleStart)

```sql
INSERT INTO notifications (user_id, type, title, description, link_to, agent_name, agent_color, status)
SELECT user_id, 'support_visitor', 'New Website Visitor', 
       'Visitor from Sydney viewing /product/n16-deformed-bar',
       '/support-inbox', 'Support', '#10b981', 'pending'
FROM profiles WHERE company_id = '{company_id}'
```

This triggers the existing `push-on-notify` function which sends browser push notifications with the mockingjay sound.

### Team Member Dropdown (SupportChatView.tsx)

- Fetch all profiles for the company on mount
- Render a `Select` dropdown with "Unassigned" as default + all team members
- On change, update `support_conversations.assigned_to` and set status to "assigned"
- Show current assignee's name

### No Database Migrations Required

All tables (`notifications`, `profiles`, `support_conversations`, `support_messages`) already have the necessary columns. No schema changes needed.
