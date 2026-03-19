

# Secure Vizzy's Phone Persona — No Confidential Info to Callers

## Problem
The current receptionist prompt tells Vizzy to "answer basic questions about orders, deliveries, and quotes using the context below" — this leaks confidential ERP data (pricing, lead values, delivery schedules) to external callers.

## Fix
Rewrite the `instructions` prompt in `vizzy-call-receptionist/index.ts` to:

1. **Remove all ERP data from the spoken prompt** — Vizzy will NOT share any order details, pricing, delivery dates, or quote info with callers
2. **Keep the ERP context only for internal note-taking** — Vizzy still receives it to identify who's calling and log accurate notes, but is strictly forbidden from sharing it
3. **New persona**: Vizzy acts like a classic office gatekeeper:
   - "Hi, this is Vizzy from Rebar Shop. Sattar is in the shop/in a meeting right now — how can I help you?"
   - Takes their name, number, what it's about
   - "OK, I'll let him know and he'll get back to you"
   - Never discusses numbers, pricing, order status, delivery dates

### File: `supabase/functions/vizzy-call-receptionist/index.ts`
- Replace the `instructions` string (lines 119-141) with a confidentiality-first prompt
- Keep the ERP context fetch logic intact (used for caller identification and internal summary only)
- Add explicit `CONFIDENTIALITY RULES` section forbidding disclosure of any business data

### No other files need changes
The `VizzyCallHandler.tsx` and post-call summary flow remain unchanged — summaries still include full ERP context for the CEO's eyes only.

