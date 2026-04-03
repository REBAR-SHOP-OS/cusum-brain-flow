

# Interactive All-in-One Sales Bot for Both Platforms

## Vision
Create a visually striking, multi-mode sales concierge that goes far beyond a chat bubble. The bot combines three experiences in one widget: **Guided Quote Builder**, **AI Sales Chat**, and **Live Handoff** — with inline product cards, animated transitions, and a proactive engagement system.

## What Gets Built

### 1. New Edge Function: `sales-concierge` 
A dedicated AI-powered sales agent with structured tool calling for:
- **Product recommendation** — returns inline product cards with images, specs, pricing tiers
- **Instant quote estimation** — calculates rough pricing based on bar size, quantity, bending type
- **Lead capture** — collects name, email, project details and saves to `sales_contacts`
- **Live handoff** — flags conversation for human follow-up and notifies the sales team

The AI uses Lovable AI (gemini-3-flash-preview) with a specialized sales prompt that makes it behave like a top-performing salesperson — warm, knowledgeable, and goal-oriented (convert visitors to quote requests).

### 2. New Component: `InteractiveSalesConcierge.tsx`
A rich widget on the **Lovable landing page** with three tabs/modes:

**Mode A — Quick Quote (Visual Wizard)**
- Step 1: Select rebar type (visual cards with icons)
- Step 2: Choose size & quantity (sliders + inputs)  
- Step 3: Bending type (straight, L-shape, U-shape, stirrup — illustrated)
- Step 4: Delivery zone (map or dropdown)
- → Instant ballpark estimate + "Get Exact Quote" CTA

**Mode B — AI Sales Chat**
- Full streaming chat with the sales-concierge agent
- Inline rich cards: product recommendations appear as interactive cards within the chat
- Quick-reply chips: "Get a Quote", "See Products", "Talk to Someone"
- Typing indicators, smooth animations

**Mode C — Contact / Handoff**
- Simple form: Name, Email, Phone, Project Description
- "Request Callback" button
- Saves lead to database and triggers notification

**UI Design:**
- Glassmorphism card with gradient accent matching brand (#E97F0F orange)
- Animated entrance (slide-up + scale)
- Floating action button with attention-grabbing pulse + proactive teaser message
- Smooth tab transitions between modes
- Mobile-responsive (full-screen on mobile)

### 3. Updated Widget JS: `website-chat-widget` 
Update the existing WordPress widget to include the same sales concierge capabilities:
- Add quick-quote wizard as the **default first screen** (not just chat)
- Product card rendering in chat responses
- Quick-reply suggestion chips
- Lead capture form accessible via a tab
- Same AI sales agent backend

### 4. Landing Page Integration
Add the `InteractiveSalesConcierge` to `Landing.tsx`, replacing or enhancing the existing `PublicChatWidget` with the richer sales experience.

## Technical Architecture

```text
┌─────────────────────────┐
│   rebar.shop (WordPress) │
│   website-chat-widget JS │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐     ┌──────────────────┐
│  sales-concierge (Edge) │────▶│ Lovable AI       │
│  - AI chat + tools      │     │ gemini-3-flash   │
│  - quote estimation     │     └──────────────────┘
│  - lead capture (DB)    │
│  - product catalog      │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Lovable App (Landing)   │
│  InteractiveSalesConcierge│
└─────────────────────────┘
```

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/sales-concierge/index.ts` | **New** | AI sales agent with tool calling for quotes, products, leads |
| `src/components/landing/InteractiveSalesConcierge.tsx` | **New** | Multi-mode sales widget (wizard + chat + contact) |
| `src/pages/Landing.tsx` | **Edit** | Replace PublicChatWidget with InteractiveSalesConcierge |
| `supabase/functions/website-chat-widget/index.ts` | **Edit** | Add quick-quote wizard + product cards + lead capture to WordPress widget |

## Key Differentiators (What Makes It Unique)
- **Not just a chatbot** — it's a guided sales experience with visual product selection
- **Instant ballpark pricing** — visitors get rough estimates before committing to a quote request
- **Rich inline cards** — products appear as beautiful cards within the conversation, not plain text
- **Proactive engagement** — teaser messages based on page context ("Looking at stirrups? Get 10% off bulk orders!")
- **Seamless handoff** — AI knows when to pass to a human and captures all context

