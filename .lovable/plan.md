

# Intelligent Live Agent for rebar.shop -- Unified with ERP

## Overview

Transform the current "dumb" website chat (which only answers FAQs from a static prompt) into a smart, tool-equipped AI agent that can:

1. **Search and find products** live from WooCommerce catalog
2. **Look up rebar sizes, weights, and specifications** from the ERP database
3. **Create quote requests** that land directly in the ERP quotes table
4. **Capture customer details** for follow-up by the sales team
5. **Check stock availability** from ERP inventory

## Current State

- `website-chat` edge function: Simple prompt-only chatbot, no tools, no database access
- `website-chat-widget` edge function: Serves JS widget for WordPress embedding
- The admin `admin-chat` has full tool access but requires authentication (admin role)

## Architecture

### New Edge Function: `website-agent`

A new public (no JWT) edge function that acts like a mini version of `admin-chat` but scoped for customers:

- **No auth required** (public-facing)
- **IP-based rate limiting** (10 msgs/min, same as current)
- **Read-only ERP tools** (no write access to machines, deliveries, etc.)
- **Quote creation tool** (the only "write" -- creates a quote request in the DB)

### Tools Available to Website Agent

| Tool | Type | Description |
|------|------|-------------|
| `search_products` | Read | Search WooCommerce products by name/keyword |
| `get_product_details` | Read | Get full product info (price, stock, description) |
| `lookup_rebar_specs` | Read | Look up bar sizes, weight per metre, diameter from `rebar_sizes` table |
| `check_availability` | Read | Check ERP inventory stock levels for specific bar codes |
| `create_quote_request` | Write | Create a new quote in the `quotes` table with customer details and items |

### System Prompt Upgrade

The agent will be prompted to:
- Act as a knowledgeable rebar sales assistant
- Proactively use tools to answer product/pricing questions with real data
- Guide customers through the quoting process (collect items, quantities, contact info)
- Create a quote request in the ERP when the customer is ready
- Use Australian English, be warm and professional

### Quote Flow

```text
Customer: "I need 200 metres of N16 and 100 metres of N20 cut and bent"
Agent: [calls lookup_rebar_specs for N16 & N20]
Agent: [calls search_products to find matching WC products]
Agent: "N16 is 16mm diameter, 1.58 kg/m. N20 is 20mm, 2.47 kg/m.
        For an accurate quote on cut & bend, I'll need:
        1. Your name and email
        2. Project name/address
        3. Bar bending schedule (if available)
        Want me to create a quote request for your team to review?"
Customer: "Yes, John Smith, john@builder.com, project at 42 Main St"
Agent: [calls create_quote_request]
Agent: "Done! Quote request #QR-2026-0042 has been submitted.
        Our team will review and send a formal quote within a few hours.
        You'll receive it at john@builder.com."
```

### Database: New `quote_requests` Table

A lightweight public-facing table (separate from internal `quotes`) to capture website leads:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| customer_name | text | Visitor's name |
| customer_email | text | Visitor's email |
| customer_phone | text | Optional phone |
| project_name | text | Project description |
| items | jsonb | Array of requested items |
| notes | text | Additional notes from chat |
| status | text | `new`, `reviewed`, `converted`, `declined` |
| source | text | Always `website_chat` |
| chat_transcript | jsonb | Conversation history for context |
| created_at | timestamptz | Auto |
| company_id | uuid | Default company |

This table will have:
- No RLS (service role insert from edge function)
- A notification trigger that creates an `activity_events` entry so the sales team sees it in ERP

### Widget Update

Update `website-chat-widget` to point to the new `website-agent` endpoint instead of `website-chat`.

### Notification to Sales Team

When a quote request is created, insert into `activity_events` so it appears in the ERP inbox/notifications for the sales team.

## Files to Create/Modify

1. **Create** `supabase/functions/website-agent/index.ts` -- New intelligent agent with tools
2. **Modify** `supabase/functions/website-chat-widget/index.ts` -- Point to `website-agent` 
3. **Modify** `supabase/config.toml` -- Add `[functions.website-agent]` with `verify_jwt = false`
4. **Database migration** -- Create `quote_requests` table + notification trigger

## Security Considerations

- No authentication required (public endpoint)
- IP-based rate limiting (10 messages per minute)
- Max conversation length enforced (10 messages)
- Read-only access to products and specs (no ERP mutations except quote creation)
- Quote creation uses service role key (server-side only)
- No sensitive data exposed (no customer lists, no financials, no admin tools)
- Input sanitization on all tool arguments

## Technical Details

### Tool Execution Pattern

The website agent follows the same pattern as `admin-chat`:
1. First AI call with tools enabled (stream, buffer for tool calls)
2. If tool calls detected, execute them in parallel
3. Follow-up AI call with tool results (using `gemini-3-flash-preview` for speed)
4. Stream final response to client

### WPClient Reuse

The agent imports and uses the existing `WPClient` from `_shared/wpClient.ts` for WooCommerce product lookups, ensuring consistency with the admin tools.

### Quote Number Generation

Auto-generate quote request numbers in format `QR-YYYY-NNNN` using a sequence or timestamp-based approach.

