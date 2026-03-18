

## Vizzy Audit: Fix Real Data Access, Avatar UI, and Voice Intelligence

### Problems Identified

1. **Vizzy voice says "I'm unable to access" real data** — The voice engine (OpenAI Realtime) only receives a compressed briefing in its system prompt. When asked specific questions like "list customer transactions," the briefing doesn't contain that granular detail, so the AI deflects. The `vizzy-daily-brief` generates a high-level summary, not granular queryable data.

2. **Avatar doesn't fit in circle** — The `vizzy-avatar.png` image already contains orbital rings, dark background, and decorative elements baked into the PNG. When placed inside a circular container with `object-cover`, the actual face is tiny and the decorative elements get cropped oddly.

3. **Voice Vizzy lacks tool-calling capability** — Unlike the text-based `admin-chat` (which has 20+ tools for querying customers, employees, emails), the voice Vizzy can only reference whatever static text was injected into its system prompt at session start.

### Plan

**1. Fix Avatar — Extract Clean Face or Use Proper Sizing**
- Replace `object-cover` with `object-contain` + add a dark background fill in both `VizzyVoiceChat.tsx` and `FloatingVizzyButton.tsx`
- Better approach: since the avatar PNG has orbital rings baked in, scale the image so the face portion fills the circle. Use `object-cover` with `object-position: center 35%` to crop to the face, OR generate a clean cropped avatar
- For the floating button: the 64px circle needs the face to fill it — add `scale(1.8)` transform on the img to zoom into the face portion
- For the voice chat: the 180px orb already has its own orbital rings drawn in SVG/CSS, so the avatar's baked-in rings double up. Apply similar zoom/crop

**2. Enrich Voice Briefing with Granular Data**
- Update `vizzy-daily-brief` to include MORE detail in the briefing — specifically:
  - Top 20 customer names with their recent transaction amounts
  - Employee list with today's activity counts  
  - Open invoice details (customer name, amount, due date)
  - Active leads with customer names and values
- Update the `VIZZY_INSTRUCTIONS` prompt to explicitly state: "You have ALL the data below. When asked about customers, employees, transactions — search through the data provided. Never say you can't access data — the data IS below."
- Remove the instruction line about "I'd need to check the system" and replace with "Reference the data below directly"

**3. Add Customer + Transaction Data to Voice Context**
- In `vizzyFullContext.ts`, add a new section `CUSTOMER DIRECTORY` that lists top 50 active customers with names and recent order/invoice totals
- Add `TRANSACTION SUMMARY` section with recent invoices (customer, amount, date, status)
- This data is already queried partially (accounting_mirror) but not formatted with customer names for voice

**4. Strengthen Voice Prompt Against Deflection**
- In `useVizzyVoiceEngine.ts`, update `VIZZY_INSTRUCTIONS` RULES section:
  - Remove: "If the data doesn't cover something specific, say 'I'd need to check the system'"
  - Add: "NEVER say you cannot access data. All business data is provided below. Search through it and answer. If a specific detail isn't in the data, say 'That specific detail isn't in today's snapshot — I can get more detail through the text chat.'"

### Technical Details

**Files to modify:**
- `src/components/vizzy/VizzyVoiceChat.tsx` — fix avatar sizing in the 180px orb (zoom into face)
- `src/components/vizzy/FloatingVizzyButton.tsx` — fix avatar sizing in the 64px button (zoom into face)  
- `src/hooks/useVizzyVoiceEngine.ts` — update VIZZY_INSTRUCTIONS to stop deflecting, strengthen data-reference rules
- `supabase/functions/_shared/vizzyFullContext.ts` — add customer directory + transaction detail sections
- `supabase/functions/vizzy-daily-brief/index.ts` — increase context detail, tell compressor to keep customer/employee names

**No database changes needed.**

