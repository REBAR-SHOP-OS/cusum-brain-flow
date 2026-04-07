

# Unify Vizzy Branding Across All Chat Surfaces

## The Problem

The screenshot shows two different "Vizzy" chat interfaces on the same screen with inconsistent branding:

1. **Home page ChatInput** (top) — Says "CEO Portal", "Ask Vizzy anything...", has rich toolbar (emoji, voice, formatting)
2. **LiveChatWidget** (floating bubble, bottom-right) — Says "Live Chat" with a generic `MessageCircle` icon, empty state says "How can we help? Ask anything about your business"
3. **IntelligencePanel** (right sidebar) — Already branded as "Vizzy" with `Sparkles` icon ✓

The LiveChatWidget is the odd one out — it uses generic "Live Chat" branding instead of Vizzy identity.

## What Changes

### 1. `src/components/layout/LiveChatWidget.tsx` — Rebrand to Vizzy

**Header** (line 61-65):
- Change `MessageCircle` icon → `Sparkles` (matches IntelligencePanel)
- Change label from "Live Chat" → "Vizzy"

**Empty state** (line 82-86):
- Change `MessageCircle` icon → `Sparkles`
- Change "How can we help?" → "Vizzy"
- Change "Ask anything about your business" → "Your executive intelligence assistant."
- Add sample prompts matching IntelligencePanel style (e.g. "What's the biggest risk today?")

**Result**: Both the floating widget and the sidebar panel now look and feel like the same Vizzy.

### 2. No changes needed to:
- `IntelligencePanel.tsx` — already branded correctly as Vizzy
- `Home.tsx` / `ChatInput` — this is the main command input, not a "Vizzy chat" per se (it routes to agents based on input)
- `vizzyIdentity.ts` — backend identity is already unified
- `FloatingVizzyButton.tsx` — this is the trigger button, not the chat UI

## Impact
- 1 file changed (`LiveChatWidget.tsx`)
- ~10 lines modified
- Consistent Vizzy branding across all chat surfaces
- No database, auth, or routing changes

