

# Intelligent Live Agent for rebar.shop -- Unified with ERP

## Status: ✅ IMPLEMENTED

## Overview

Transform the current "dumb" website chat (which only answers FAQs from a static prompt) into a smart, tool-equipped AI agent that can:

1. **Search and find products** live from WooCommerce catalog
2. **Look up rebar sizes, weights, and specifications** from the ERP database
3. **Create quote requests** that land directly in the ERP quotes table
4. **Capture customer details** for follow-up by the sales team
5. **Check stock availability** from ERP inventory

## Implemented

### New Edge Function: `website-agent`
- Public endpoint (no JWT) with IP-based rate limiting (10 msgs/min)
- Tool-calling AI agent using `gemini-3-flash-preview`
- 5 tools: search_products, get_product_details, lookup_rebar_specs, check_availability, create_quote_request
- Parallel tool execution via Promise.all
- Two-pass streaming: buffer first call for tool detection, stream final response

### Database: `quote_requests` Table
- Stores website leads with quote_number (QR-YYYY-NNNN format)
- RLS: staff (admin/office/sales) can view and update
- Trigger creates `activity_events` entry to notify sales team in ERP

### Widget Updated
- `website-chat-widget` now points to `website-agent` instead of `website-chat`

### Config
- `[functions.website-agent]` added with `verify_jwt = false`
