

# Redesign Website Chat Widget for a Unique Customer Experience

## Overview

Transform the external rebar.shop chat widget from a basic dark-themed panel into a premium, branded experience with smooth animations, smart quick-action chips, online agent indicators, a subtle notification badge, and a warm personality -- making every visitor feel welcomed and valued.

## Visual Redesign

### Chat Bubble
- Larger, more inviting bubble with a subtle pulse animation when no chat is active (draws attention)
- Branded gradient: warm orange-to-amber matching Rebar Shop identity
- Unread message badge (orange dot) when AI has responded and panel is closed
- Smooth morph transition when toggling between chat and close icons

### Chat Panel
- Modern glassmorphism-inspired design with warm dark theme (#111827 base)
- Branded header with Rebar Shop logo area, "Online" status indicator with green pulsing dot, and tagline "We typically reply in seconds"
- Rounded message bubbles with tails (user: orange gradient, bot: subtle glass card)
- Smooth slide-up + fade animation on open, slide-down on close
- Sound effect option: subtle "pop" on new bot message (optional, off by default)
- Powered-by footer with Rebar Shop branding

### Quick Action Chips (shown on empty state)
- Styled pill buttons that visitors can tap to start common conversations:
  - "Get a Quote"
  - "Check Stock"
  - "Delivery Areas"
  - "Talk to Sales"
- Chips disappear once first message is sent

### Typing Indicator
- Animated dots with a subtle wave effect (more polished than current bounce)
- Shows "Rebar Shop is typing..." text alongside dots

### Message Enhancements
- Timestamps on messages (e.g., "2:34 PM")
- Bot messages show a small Rebar Shop avatar icon
- Links in bot messages are styled as orange underlined text
- Smooth fade-in animation for each new message

## Notification & Engagement Features

### Proactive Teaser Bubble
- After 5 seconds on the page (if chat hasn't been opened), show a small speech bubble above the chat button: "Need help with rebar? We're online!"
- Auto-dismisses after 8 seconds or on click
- Only shows once per session (tracked via sessionStorage)

### Unread Badge
- When AI responds while panel is closed, show a red "1" badge on the bubble
- Clears when panel is opened

## Mobile Optimisations
- Full-width panel on mobile (< 480px) with larger touch targets
- Bottom sheet style with drag-to-close hint
- Input area stays above mobile keyboard

## Technical Details

### File Modified

| File | Change |
|------|--------|
| `supabase/functions/website-chat-widget/index.ts` | Complete CSS and JS redesign of the injected widget |

### Key CSS Changes
- Replace flat `#1a1a2e` background with modern gradient dark theme
- Add `@keyframes` for: bubble pulse, slide-up panel, fade-in messages, wave typing dots, teaser bubble pop-in
- Message bubbles with `border-radius` tails (CSS triangle or asymmetric radius)
- Glassmorphism on bot messages: `backdrop-filter: blur(8px); background: rgba(255,255,255,0.06)`
- Smooth transitions on all interactive elements
- Orange gradient for user messages: `linear-gradient(135deg, #E97F0F, #F59E0B)`

### Key JS Changes
- Add `sessionStorage` tracking for teaser bubble (show once per session)
- Add unread badge counter (increment on bot message when closed, clear on open)
- Add timestamp rendering on each message
- Add quick action chips that call `sendMessage()` with preset text
- Add bot avatar (inline SVG) next to assistant messages
- Proactive teaser: `setTimeout` at 5s, auto-dismiss at 13s, hide on bubble click
- Auto-resize panel height based on content (min 300px, max 500px)

### No Backend Changes
This is purely a frontend widget redesign. The chat still connects to the same `website-agent` endpoint. All changes are in the injected JavaScript/CSS served by the edge function.

### Animations Summary

| Element | Animation |
|---------|-----------|
| Bubble | Subtle pulse glow every 3s when idle |
| Panel | Slide up + fade in 250ms ease-out |
| Messages | Fade in + slight slide from bottom, 150ms |
| Typing dots | Smooth wave (translateY) with staggered delays |
| Teaser | Pop in from right with bounce, auto-dismiss fade out |
| Quick chips | Scale up on hover, fade out when first message sent |

